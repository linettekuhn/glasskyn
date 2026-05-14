from pydantic import BaseModel


class PresignedUploadRequest(BaseModel):
    file_name: str
    content_type: str


class PresignedUploadResponse(BaseModel):
    upload_url: str
    file_key: str
    public_url: str


class PresignedDownloadResponse(BaseModel):
    download_url: str