from app.db.base import Base
from sqlalchemy import Column, Integer, ForeignKey, Date, DateTime, UniqueConstraint
from sqlalchemy.sql import func


class RoutineStepCompletion(Base):
    __tablename__ = "routine_step_completions"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "step_id", "completed_on", name="uq_user_step_date"
        ),
    )
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id", ondelete="CASCADE"), nullable=False, index=True)
    step_id = Column(Integer, ForeignKey("routine_steps.id", ondelete="CASCADE"), nullable=False)
    completed_on = Column(Date, nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), server_default=func.now())
