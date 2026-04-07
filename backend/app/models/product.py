from app.db.base import Base
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    brand = Column(String)
    category = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())