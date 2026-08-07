from typing import Optional
from pydantic import BaseModel


class PreferenceUpdate(BaseModel):
    water_reminder_enabled: Optional[bool] = None
    water_reminder_time: Optional[str] = None
    timezone: Optional[str] = None
    units: Optional[str] = None
    water_goal_ml: Optional[int] = None
    water_weight_lb: Optional[float] = None
    water_activity_level: Optional[str] = None
    water_climate: Optional[str] = None
    routine_digest_am_time: Optional[str] = None
    routine_digest_pm_time: Optional[str] = None
    home_routine_id: Optional[int] = None


class PreferenceOut(BaseModel):
    water_reminder_enabled: bool
    water_reminder_time: str
    timezone: Optional[str]
    units: str
    water_goal_ml: Optional[int]
    water_weight_lb: Optional[float]
    water_activity_level: Optional[str]
    water_climate: Optional[str]
    routine_digest_am_time: Optional[str]
    routine_digest_pm_time: Optional[str]
    home_routine_id: Optional[int]

    model_config = {"from_attributes": True}
