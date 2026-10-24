from app.db.base import Base
from sqlalchemy import Column, ForeignKey, Integer, String, Text, DateTime, UniqueConstraint
from sqlalchemy.sql import func


class SkinNudge(Base):
    __tablename__ = "skin_nudges"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(
        Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    seen_at = Column(DateTime(timezone=True), nullable=True)
    dismissed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "session_id", name="uq_skin_nudges_user_session"),
    )
