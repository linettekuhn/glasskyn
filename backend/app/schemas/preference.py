from typing import Optional
from pydantic import BaseModel


class PreferenceUpdate(BaseModel):
    water_reminder_enabled: Optional[bool] = None
    water_reminder_time: Optional[str] = None
    routine_digest_am_time: Optional[str] = None
    routine_digest_pm_time: Optional[str] = None
    home_routine_id: Optional[int] = None


class PreferenceOut(BaseModel):
    water_reminder_enabled: bool
    water_reminder_time: str
    routine_digest_am_time: Optional[str]
    routine_digest_pm_time: Optional[str]
    home_routine_id: Optional[int]

    model_config = {"from_attributes": True}
