from app.db.base import Base
from sqlalchemy import Column, Integer, ForeignKey, String, DateTime

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(Integer, ForeignKey("scan_results.id"))
    alert_type = Column(String) # e.g., "Email" or "Push"
    sent_at = Column(DateTime, nullable=True)