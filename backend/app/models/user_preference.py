from app.db.base import Base
from sqlalchemy import Column, Integer, Float, ForeignKey, Boolean, String, DateTime
from sqlalchemy.sql import func


class UserPreference(Base):
    __tablename__ = "user_preferences"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    water_reminder_enabled = Column(Boolean, default=True, nullable=False)
    water_reminder_time = Column(String, default="12:00", nullable=False)
    units = Column(String, default="imperial", nullable=False)
    water_goal_ml = Column(Integer, nullable=True)
    water_weight_lb = Column(Float, nullable=True)
    water_activity_level = Column(String, nullable=True)
    water_climate = Column(String, nullable=True)
    routine_digest_am_time = Column(String, default="08:00", nullable=True)
    routine_digest_pm_time = Column(String, default="20:00", nullable=True)
    home_routine_id = Column(Integer, ForeignKey("routines.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
