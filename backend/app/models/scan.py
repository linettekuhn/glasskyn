from app.db.base import Base
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean, Text, String
from sqlalchemy.sql import func


class ScanResult(Base):
    __tablename__ = "scan_results"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    image_s3_key = Column(String, nullable=True)
    back_image_s3_key = Column(String, nullable=True)
    raw_ocr_text = Column(Text, nullable=True)
    pao_months = Column(Integer, nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    is_expired = Column(Boolean, default=False)
    category = Column(String, nullable=True)
    category_method = Column(String, nullable=True)
    extraction_method = Column(String, nullable=True)
    product_name = Column(String, nullable=True)
    brand = Column(String, nullable=True)
    name_brand_method = Column(String, nullable=True)
    scan_date = Column(DateTime(timezone=True), server_default=func.now())