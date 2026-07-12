from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.product import ProductOut, ProductCreate, ProductUpdate
from app.schemas.openbeautyfacts import BarcodeLookupResult
from app.middleware.auth import get_db, get_current_user
from app.models.user import User
from app.models.product import Product
from app.models.scan import ScanResult
from app.services.openbeautyfacts import lookup_product, RateLimitError
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

    # returns fiels client actually sent
    updates = body.model_dump(exclude_unset=True)

    # dynamically set each updated attribute
    for field, value in updates.items():
        setattr(product, field, value)

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
