from app.db.base import Base
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func


class SkinSession(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    image_url = Column(String, nullable=False)
    face_landmarks = Column(JSONB, nullable=True)


class SkinConcern(Base):
    __tablename__ = "concerns"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    label = Column(String, nullable=True)
    created_session_id = Column(
        Integer, ForeignKey("sessions.id"), nullable=False, index=True
    )
    resolved_session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    anchor = Column(JSONB, nullable=True)
    history = Column(JSONB, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )