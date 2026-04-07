from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Date

Base = declarative_base()

class CosmeticItem(Base):
    __tablename__ = "cosmetic_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    brand = Column(String)
    expiry_date = Column(Date)