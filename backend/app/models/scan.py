from app.db.base import Base
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean

class ScanResult(Base):
    __tablename__ = "scan_results"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    expiry_date = Column(DateTime)
    is_expired = Column(Boolean, default=False)