from pydantic import BaseModel, field_validator, Field
from typing import Optional, Literal
from datetime import datetime

ProductCategory = Literal["skincare", "makeup", "haircare"]


# request schemas
class ProductCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    category: Optional[ProductCategory] = None
    image_s3_key: Optional[str] = None
    icon: Optional[str] = None
    pao_months: Optional[int] = Field(default=None, ge=1, le=120)
    product_type: Optional[str] = None
    scan_id: Optional[int] = None

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, str):
            normalized = v.lower().strip()
            if normalized in ("skincare", "makeup", "haircare"):
                return normalized
        return None

    @field_validator("pao_months", mode="before")
    @classmethod
    def normalize_pao(cls, v):
        if v is None or v == "":
            return None
        try:
            val = int(v)
            if 1 <= val <= 120:
                return val
        except (ValueError, TypeError):
            pass
        return None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[ProductCategory] = None
    image_s3_key: Optional[str] = None
    icon: Optional[str] = None
    pao_months: Optional[int] = Field(default=None, ge=1, le=120)
    product_type: Optional[str] = None

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, str):
            normalized = v.lower().strip()
            if normalized in ("skincare", "makeup", "haircare"):
                return normalized
        return None


# response schemas
class ProductOut(BaseModel):
    id: int
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    image_s3_key: Optional[str] = None
    image_url: Optional[str] = None
    icon: Optional[str] = None
    pao_months: Optional[int] = None
    product_type: Optional[str] = None
    created_at: datetime
    user_id: int

    model_config = {"from_attributes": True}
