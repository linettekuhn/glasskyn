from typing import Optional
from pydantic import BaseModel


class PreferenceUpdate(BaseModel):
    water_reminder_enabled: Optional[bool] = None
    water_reminder_time: Optional[str] = None
    routine_digest_enabled: Optional[bool] = None


class PreferenceOut(BaseModel):
    water_reminder_enabled: bool
    water_reminder_time: str
    routine_digest_enabled: bool

    model_config = {"from_attributes": True}
