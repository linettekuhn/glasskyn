from app.db.base import Base
from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.sql import func


class SpfApplication(Base):
    __tablename__ = "spf_applications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    applied_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
