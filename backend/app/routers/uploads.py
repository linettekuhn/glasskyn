from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.upload import (
    PresignedUploadRequest,
    PresignedUploadResponse,
    PresignedDownloadResponse,
)
from app.services import storage

router = APIRouter(prefix="/uploads", tags=["uploads"])


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