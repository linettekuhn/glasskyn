from app.db.base import Base
from sqlalchemy import Column, Integer, ForeignKey, Date, DateTime, UniqueConstraint
from sqlalchemy.sql import func


class WaterIntake(Base):
    __tablename__ = "water_intakes"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_water_intake_user_date"),
    )
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    ml = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
