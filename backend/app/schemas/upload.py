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


class ProcessMultiRequest(BaseModel):
    front_file_key: str
    back_file_key: str
    barcode: str | None = None


class ProcessMultiResponse(BaseModel):
    scan_id: int | None = None
    product_name: str | None = None
    brand: str | None = None
    name_brand_method: str | None = None
    product_type: str | None = None
    category: str | None = None
    category_method: str | None = None
    pao_months: int | None = None
    expiry_date: str | None = None
    extraction_method: str | None = None


class ProcessPaoRequest(BaseModel):
    file_key: str
    scan_id: int


class ProcessPaoResponse(BaseModel):
    pao_months: int | None = None
    extraction_method: str | None = None