import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.middleware.auth import get_current_user, get_db
from app.models.user import User
from app.models.scan import ScanResult
from app.schemas.upload import (
    PresignedUploadRequest,
    PresignedUploadResponse,
    PresignedDownloadResponse,
    ProcessMultiRequest,
    ProcessMultiResponse,
    ProcessPaoRequest,
    ProcessPaoResponse,
)
from app.services import storage
from app.services import vision as vision_service
from app.services.openbeautyfacts import lookup_product
from app.services.extraction import extract_all, extract_pao
from app.services.llm import extract_name_brand


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["uploads"])


class ProcessImageRequest(BaseModel):
    file_key: str
    barcode: str | None = None


class ProcessImageResponse(BaseModel):
    name: str | None = None
    brand: str | None = None
    category: str | None = None
    barcode: str | None = None
    raw_ocr_text: str | None = None
    scan_id: int | None = None
    pao_months: int | None = None
    expiry_date: str | None = None
    category_method: str | None = None
    extraction_method: str | None = None


@router.post(
    "/presigned-url",
    response_model=PresignedUploadResponse,
    status_code=201,
)
def generate_upload_url(
    body: PresignedUploadRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        result = storage.generate_presigned_upload_url(
            file_name=body.file_name,
            content_type=body.content_type,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{file_key:path}/url", response_model=PresignedDownloadResponse)
def generate_download_url(
    file_key: str,
    current_user: User = Depends(get_current_user),
):
    result = storage.generate_presigned_download_url(file_key=file_key)
    return result


@router.post("/process", response_model=ProcessImageResponse)
async def process_uploaded_image(
    body: ProcessImageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logger.info(f"[DEBUG] process_uploaded_image called with file_key={body.file_key}, barcode={body.barcode}")
    
    # Run OCR on the uploaded image
    try:
        download_info = storage.generate_presigned_download_url(body.file_key)
        image_url = download_info["download_url"]
    except Exception as e:
        logger.error(f"[DEBUG] Failed to generate download URL: {e}")
        image_url = None
    
    raw_ocr_text = None
    if image_url:
        logger.info(f"[DEBUG] Running OCR on image")
        try:
            ocr_result = await asyncio.to_thread(vision_service.detect_text, image_url)
            raw_ocr_text = ocr_result.get("raw_text")
            logger.info(f"[DEBUG] OCR extracted {len(raw_ocr_text or '')} characters")
        except Exception as e:
            logger.error(f"[DEBUG] OCR failed: {e}")
    else:
        logger.error("[DEBUG] Skipping OCR — no valid image URL")
    
    # Run extraction on OCR text
    extraction = extract_all(raw_ocr_text)
    logger.info(f"[DEBUG] Extraction result: pao_months={extraction['pao_months']}, method={extraction['extraction_method']}")

    # Create scan result record with extraction data
    scan = ScanResult(
        user_id=current_user.id,
        image_s3_key=body.file_key,
        raw_ocr_text=raw_ocr_text,
        pao_months=extraction["pao_months"],
        expiry_date=extraction["expiry_date"],
        category=extraction["category"],
        category_method=extraction["category_method"],
        extraction_method=extraction["extraction_method"],
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    logger.info(f"[DEBUG] Created ScanResult id={scan.id}")
    
    # If barcode was detected, try to lookup product info
    name = None
    brand = None
    if body.barcode:
        logger.info(f"[DEBUG] Attempting barcode lookup for: {body.barcode}")
        try:
            result = await lookup_product(body.barcode)
            logger.info(f"[DEBUG] Barcode lookup result: {result}")
            name = result.get("product_name") if result else None
            brand = result.get("brands") if result else None
        except Exception as e:
            logger.error(f"[DEBUG] Barcode lookup failed: {e}")
    
    # Extract to plain locals (Pylance sees SQLAlchemy Column types otherwise)
    _category: str | None = scan.category  # type: ignore[assignment]
    _scan_id: int | None = scan.id  # type: ignore[assignment]
    _pao: int | None = scan.pao_months  # type: ignore[assignment]
    _expiry: str | None = str(scan.expiry_date) if scan.expiry_date is not None else None  # type: ignore[arg-type]
    _cat_method: str | None = scan.category_method  # type: ignore[assignment]
    _ext_method: str | None = scan.extraction_method  # type: ignore[assignment]

    return ProcessImageResponse(
        name=name,
        brand=brand,
        category=_category,
        barcode=body.barcode,
        raw_ocr_text=raw_ocr_text,
        scan_id=_scan_id,
        pao_months=_pao,
        expiry_date=_expiry,
        category_method=_cat_method,
        extraction_method=_ext_method,
    )


@router.post("/process-multi", response_model=ProcessMultiResponse)
async def process_multi_images(
    body: ProcessMultiRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logger.info(
        "process-multi: front=%s back=%s barcode=%s",
        body.front_file_key,
        body.back_file_key,
        body.barcode,
    )

    # Generate download URLs for both images
    front_url = None
    back_url = None
    try:
        front_info = storage.generate_presigned_download_url(body.front_file_key)
        front_url = front_info["download_url"]
        back_info = storage.generate_presigned_download_url(body.back_file_key)
        back_url = back_info["download_url"]
    except Exception as e:
        logger.error("Failed to generate download URLs: %s", e)

    # Run OCR on both images
    async def run_ocr(url: str | None) -> str | None:
        if not url:
            return None
        try:
            result = await asyncio.to_thread(vision_service.detect_text, url)
            return result.get("raw_text")
        except Exception as e:
            logger.error("OCR failed for %s: %s", url, e)
            return None

    front_text, back_text = await asyncio.gather(
        run_ocr(front_url), run_ocr(back_url),
    )

    # Merge raw text
    merged_parts = []
    if front_text:
        merged_parts.append(front_text)
    if back_text:
        merged_parts.append(back_text)
    merged_text = "\n---\n".join(merged_parts) if merged_parts else None

    logger.info(
        "OCR complete: front=%d back=%d merged=%d chars",
        len(front_text or ""),
        len(back_text or ""),
        len(merged_text or ""),
    )

    # Run extraction on merged text
    extraction = extract_all(merged_text)

    # Create scan result record
    scan = ScanResult(
        user_id=current_user.id,
        image_s3_key=body.front_file_key,
        back_image_s3_key=body.back_file_key,
        raw_ocr_text=merged_text,
        pao_months=extraction["pao_months"],
        expiry_date=extraction["expiry_date"],
        category=extraction["category"],
        category_method=extraction["category_method"],
        extraction_method=extraction["extraction_method"],
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    logger.info("Created ScanResult id=%s", scan.id)

    # Determine product name and brand
    product_name = None
    brand = None
    name_brand_method = None

    if body.barcode:
        logger.info("Barcode provided: %s", body.barcode)
        try:
            obf_result = await lookup_product(body.barcode)
            if obf_result:
                product_name = obf_result.get("product_name")
                brand = obf_result.get("brands")
                name_brand_method = "barcode_lookup"
                logger.info(
                    "Barcode hit: name=%s brand=%s", product_name, brand
                )
            else:
                logger.info("Barcode miss, falling back to LLM")
        except Exception as e:
            logger.error("Barcode lookup failed: %s", e)

    if not name_brand_method:
        logger.info("Attempting LLM extraction")
        llm_result = extract_name_brand(merged_text)
        product_name = llm_result["product_name"]
        brand = llm_result["brand"]
        if product_name or brand:
            name_brand_method = "llm_extraction"
            logger.info(
                "LLM extracted: name=%s brand=%s", product_name, brand
            )
        else:
            logger.info("LLM returned nulls, leaving fields blank")

    # Update scan result with name/brand info
    scan.product_name = product_name  # type: ignore[assignment]
    scan.brand = brand  # type: ignore[assignment]
    scan.name_brand_method = name_brand_method  # type: ignore[assignment]
    db.commit()

    # Extract to plain locals (Pylance sees SQLAlchemy Column types otherwise)
    _scan_id: int | None = scan.id  # type: ignore[assignment]
    _category: str | None = scan.category  # type: ignore[assignment]
    _cat_method: str | None = scan.category_method  # type: ignore[assignment]
    _pao: int | None = scan.pao_months  # type: ignore[assignment]
    _expiry: str | None = str(scan.expiry_date) if scan.expiry_date is not None else None  # type: ignore[arg-type]
    _ext_method: str | None = scan.extraction_method  # type: ignore[assignment]

    return ProcessMultiResponse(
        scan_id=_scan_id,
        product_name=product_name,
        brand=brand,
        name_brand_method=name_brand_method,
        category=_category,
        category_method=_cat_method,
        pao_months=_pao,
        expiry_date=_expiry,
        extraction_method=_ext_method,
    )


@router.post("/process-pao", response_model=ProcessPaoResponse)
async def process_pao_image(
    body: ProcessPaoRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logger.info(
        "process-pao: file_key=%s scan_id=%s", body.file_key, body.scan_id
    )

    # Verify scan exists and belongs to user
    scan = db.query(ScanResult).filter(
        ScanResult.id == body.scan_id,
        ScanResult.user_id == current_user.id,
    ).first()
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )

    # Generate download URL
    pao_url = None
    try:
        download_info = storage.generate_presigned_download_url(body.file_key)
        pao_url = download_info["download_url"]
    except Exception as e:
        logger.error("Failed to generate download URL: %s", e)

    # Run OCR on PAO image
    pao_text = None
    if pao_url:
        try:
            ocr_result = await asyncio.to_thread(
                vision_service.detect_text, pao_url
            )
            pao_text = ocr_result.get("raw_text")
            logger.info(
                "PAO OCR extracted %d chars", len(pao_text or "")
            )
        except Exception as e:
            logger.error("PAO OCR failed: %s", e)

    # Run PAO extraction only
    pao_result = extract_pao(pao_text)

    if pao_result["pao_months"] is not None:
        scan.pao_months = pao_result["pao_months"]  # type: ignore[assignment]
        scan.extraction_method = pao_result["extraction_method"]  # type: ignore[assignment]
        db.commit()
        logger.info(
            "PAO found: %d months (method: %s)",
            pao_result["pao_months"],
            pao_result["extraction_method"],
        )
    else:
        logger.info("PAO not found in PAO image")

    # Extract to plain locals (Pylance sees SQLAlchemy Column types otherwise)
    _pao: int | None = scan.pao_months  # type: ignore[assignment]
    _ext_method: str | None = scan.extraction_method  # type: ignore[assignment]

    return ProcessPaoResponse(
        pao_months=_pao,
        extraction_method=_ext_method,
    )