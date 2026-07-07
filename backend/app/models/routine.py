from app.db.base import Base
from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func


class SkinProfile(Base):
    __tablename__ = "skin_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    skin_type = Column(String, nullable=True)
    is_sensitive = Column(Boolean, nullable=True)
    concerns = Column(JSONB, default=list)
    goals = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Routine(Base):
    __tablename__ = "routines"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    source = Column(String, nullable=False, default="manual")
    routine_type = Column(String, nullable=False, default="skincare")
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RoutineStep(Base):
    __tablename__ = "routine_steps"
    id = Column(Integer, primary_key=True, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id", ondelete="CASCADE"), nullable=False)
    step_order = Column(Integer, nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    step_type = Column(String, nullable=False)
    time_of_day = Column(String, nullable=False)
    frequency = Column(String, nullable=False, default="daily")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RoutineTemplate(Base):
    __tablename__ = "routine_templates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    routine_type = Column(String, nullable=False, default="skincare")
    skin_type_tags = Column(JSONB, default=list)
    concern_tags = Column(JSONB, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RoutineTemplateStep(Base):
    __tablename__ = "routine_template_steps"
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("routine_templates.id", ondelete="CASCADE"), nullable=False)
    step_order = Column(Integer, nullable=False)
    step_type = Column(String, nullable=False)
    time_of_day = Column(String, nullable=False)
    frequency = Column(String, nullable=False, default="daily")
    suggested_product_category = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
