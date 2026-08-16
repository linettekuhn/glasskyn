from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.schemas.product import ProductOut, ProductCreate, ProductUpdate
from app.schemas.openbeautyfacts import BarcodeLookupResult
from app.schemas.ingredient_analysis import IngredientAnalysisResponse
from app.middleware.auth import get_db, get_current_user
from app.models.user import User
from app.models.product import Product
from app.models.scan import ScanResult
from app.services.openbeautyfacts import lookup_product, RateLimitError
from app.services.expiry import compute_expiry_date
from app.services.ingredient_analysis import (
    analyze_ingredient_text,
    get_user_skin_type,
)
from sqlalchemy.sql import func
from typing import List

router = APIRouter(prefix="/products", tags=["products"])


@router.post("", response_model=ProductOut, status_code=201)
def create_product(
    body: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # build ORM object
    product = Product(
        name=body.name,
        brand=body.brand,
        category=body.category,
        icon=body.icon,
        pao_months=body.pao_months,
        product_type=body.product_type,
        opened_date=body.opened_date,
        expiry_date=body.expiry_date
        or compute_expiry_date(body.opened_date, body.pao_months),
        user_id=current_user.id,
    )

    # add to db
    db.add(product)
    db.commit()
    db.refresh(product)

    # link scan result to product if scan_id was provided
    if body.scan_id:
        scan = db.query(ScanResult).filter(
            ScanResult.id == body.scan_id,
            ScanResult.user_id == current_user.id,
        ).first()
        if scan:
            scan.product_id = product.id
            db.commit()

    return product


@router.get("", response_model=List[ProductOut])
def get_products(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    products = db.query(Product).filter(Product.user_id == current_user.id).all()
    return products


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    body: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.user_id == current_user.id)
        .first()
    )

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )

    # returns fields client actually sent
    updates = body.model_dump(exclude_unset=True)
    explicit_expiry = "expiry_date" in updates

    # dynamically set each updated attribute
    for field, value in updates.items():
        setattr(product, field, value)

    # Expiry precedence:
    # - explicit non-null expiry_date wins (literal mode) — never recompute
    # - otherwise recompute from PAO/opened only when those changed, so a
    #   brand-only edit doesn't clobber a literal expiry
    if not (explicit_expiry and updates["expiry_date"] is not None):
        if "opened_date" in updates or "pao_months" in updates:
            product.expiry_date = compute_expiry_date(
                product.opened_date, product.pao_months
            )

    db.commit()
    db.refresh(product)

    return product


@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.user_id == current_user.id)
        .first()
    )

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )

    db.delete(product)
    db.commit()

    return None


class ProductScanTextResponse(BaseModel):
    raw_ocr_text: str | None = None
    scan_date: str | None = None


@router.get("/{product_id}/scan-text", response_model=ProductScanTextResponse)
def get_product_scan_text(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.user_id == current_user.id)
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )

    scan = (
        db.query(ScanResult)
        .filter(ScanResult.product_id == product_id)
        .order_by(ScanResult.scan_date.desc())
        .first()
    )

    return ProductScanTextResponse(
        raw_ocr_text=scan.raw_ocr_text if scan else None,
        scan_date=scan.scan_date.isoformat() if scan and scan.scan_date else None,
    )


@router.get("/{product_id}/analysis", response_model=IngredientAnalysisResponse)
def get_product_analysis(
    product_id: int,
    refresh: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.user_id == current_user.id)
        .first()
    )
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )

    scan = (
        db.query(ScanResult)
        .filter(ScanResult.product_id == product_id)
        .order_by(ScanResult.scan_date.desc())
        .first()
    )

    skin_type = get_user_skin_type(current_user.id, db)

    if (
        scan
        and not refresh
        and scan.ingredient_analysis is not None
        and scan.ingredient_analysis_skin_type == skin_type
    ):
        return IngredientAnalysisResponse(**scan.ingredient_analysis)

    raw_ocr_text = scan.raw_ocr_text if scan else None
    if not raw_ocr_text or not raw_ocr_text.strip():
        return IngredientAnalysisResponse(
            analysis="No ingredient list provided. Please scan the back label of your product.",
            stats={
                "total": 0,
                "matched": 0,
                "not_found": 0,
                "avg_safety_score": 0,
                "total_known_risks": 0,
            },
            flags=[],
        )

    result = analyze_ingredient_text(raw_ocr_text, skin_type, db)

    if scan:
        scan.ingredient_analysis = result.model_dump(mode="json")
        scan.ingredient_analysis_skin_type = skin_type
        scan.ingredient_analysis_updated_at = func.now()
        db.commit()

    return result


@router.get("/lookup/{barcode}", response_model=BarcodeLookupResult)
async def lookup_product_by_barcode(
    barcode: str,
    current_user: User = Depends(get_current_user),
):
    try:
        result = await lookup_product(barcode)
    except RateLimitError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Try again later.",
        )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return result
