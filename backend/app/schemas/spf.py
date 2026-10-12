from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SpfApplyIn(BaseModel):
    applied_at: datetime


class SpfUndoIn(BaseModel):
    restore_at: Optional[datetime] = None
    remove_log_at: Optional[datetime] = None
    restore_rows: list[datetime] = []
    clear_log_after: Optional[datetime] = None


class SpfStatusOut(BaseModel):
    last_applied_at: Optional[datetime]
    recent_applied_at: list[datetime]

    model_config = {"from_attributes": True}
