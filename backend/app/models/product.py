from datetime import date

from app.db.base import Base
from sqlalchemy import Column, Date, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.config import S3_BUCKET_NAME, AWS_REGION


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    brand = Column(String)
    category = Column(String)
    image_s3_key = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    pao_months = Column(Integer, nullable=True)
    product_type = Column(String, nullable=True)
    opened_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="products")

    @property
    def image_url(self) -> str | None:
        if not self.image_s3_key:
            return None
        return f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{self.image_s3_key}"

    @property
    def days_until_expiry(self) -> int | None:
        if not self.expiry_date:
            return None
        return (self.expiry_date - date.today()).days
