import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.upload import (
    PresignedUploadRequest,
    PresignedUploadResponse,
    PresignedDownloadResponse,
)
from app.services import storage
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
):
    logger.info(f"[DEBUG] process_uploaded_image called with file_key={body.file_key}, barcode={body.barcode}")
    
    # TODO: Future phases - implement OCR and classifier
    # - Phase 4: Use Google Vision API for OCR
    # - Phase 7: Use PyTorch classifier for category detection
    
    # If barcode was detected, try to lookup product info
    if body.barcode:
        logger.info(f"[DEBUG] Attempting barcode lookup for: {body.barcode}")
        try:
            result = lookup_product(body.barcode)
            logger.info(f"[DEBUG] Barcode lookup result: {result}")
            return ProcessImageResponse(
                name=result.get("product_name"),
                brand=result.get("brands"),
                category=result.get("categories"),
                barcode=body.barcode,
            )
        except Exception as e:
            logger.error(f"[DEBUG] Barcode lookup failed: {e}")
            # Barcode lookup failed, return barcode only
            pass
    
    logger.info(f"[DEBUG] Returning empty response (no barcode found)")
    return ProcessImageResponse(
        name=None,
        brand=None,
        category=None,
        barcode=body.barcode,
    )