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
)
from app.services import storage
from app.services import vision as vision_service
from app.services.openbeautyfacts import lookup_product


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
    
    # Create scan result record
    scan = ScanResult(
        user_id=current_user.id,
        image_s3_key=body.file_key,
        raw_ocr_text=raw_ocr_text,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    logger.info(f"[DEBUG] Created ScanResult id={scan.id}")
    
    # If barcode was detected, try to lookup product info
    name = None
    brand = None
    category = None
    if body.barcode:
        logger.info(f"[DEBUG] Attempting barcode lookup for: {body.barcode}")
        try:
            result = lookup_product(body.barcode)
            logger.info(f"[DEBUG] Barcode lookup result: {result}")
            name = result.get("product_name")
            brand = result.get("brands")
            category = result.get("categories")
        except Exception as e:
            logger.error(f"[DEBUG] Barcode lookup failed: {e}")
    
    return ProcessImageResponse(
        name=name,
        brand=brand,
        category=category,
        barcode=body.barcode,
        raw_ocr_text=raw_ocr_text,
        scan_id=scan.id,
    )