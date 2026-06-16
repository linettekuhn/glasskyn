from pydantic import BaseModel
from typing import Optional


class BarcodeLookupResult(BaseModel):
    product_name: Optional[str] = None
    brands: Optional[str] = None
    categories: Optional[str] = None
    image_url: Optional[str] = None
    quantity: Optional[str] = None
    ingredients_text: Optional[str] = None
    barcode: str

    model_config = {"from_attributes": True}
