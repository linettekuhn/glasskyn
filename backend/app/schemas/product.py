from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# request schemas
class ProductCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None


# response schemas
class ProductOut(BaseModel):
    id: int
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    created_at: datetime
    user_id: int

    model_config = {"from_attributes": True}
