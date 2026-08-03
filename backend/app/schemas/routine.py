from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import datetime as _dt


# --- Skin Profile ---

class SkinProfileCreate(BaseModel):
    skin_type: Optional[str] = None
    is_sensitive: Optional[bool] = None
    concerns: Optional[List[str]] = None
    goals: Optional[List[str]] = None


class SkinProfileUpdate(BaseModel):
    skin_type: Optional[str] = None
    is_sensitive: Optional[bool] = None
    concerns: Optional[List[str]] = None
    goals: Optional[List[str]] = None


class SkinProfileOut(BaseModel):
    id: int
    user_id: int
    skin_type: Optional[str] = None
    is_sensitive: Optional[bool] = None
    concerns: list = []
    goals: list = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Routine ---

class RoutineStepCreate(BaseModel):
    step_order: int
    product_id: Optional[int] = None
    step_type: str
    time_of_day: str
    frequency: str = "daily"


class RoutineStepOut(BaseModel):
    id: int
    routine_id: int
    step_order: int
    product_id: Optional[int] = None
    step_type: str
    time_of_day: str
    frequency: str
    completed_today: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class RoutineStepUpdate(BaseModel):
    step_order: Optional[int] = None
    product_id: Optional[int] = None
    step_type: Optional[str] = None
    time_of_day: Optional[str] = None
    frequency: Optional[str] = None


class StepCompleteIn(BaseModel):
    completed: bool
    date: Optional[_dt.date] = None


class CalendarDayOut(BaseModel):
    date: _dt.date
    completed: bool


class RoutineCreate(BaseModel):
    name: str
    source: str = "manual"
    routine_type: str = "skincare"
    steps: Optional[List[RoutineStepCreate]] = None


class RoutineUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    steps: Optional[List[RoutineStepCreate]] = None


class RoutineOut(BaseModel):
    id: int
    user_id: int
    name: str
    source: str
    routine_type: str = "skincare"
    is_active: bool = False
    steps: List[RoutineStepOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Routine Templates ---

class RoutineTemplateStepOut(BaseModel):
    id: int
    template_id: int
    step_order: int
    step_type: str
    time_of_day: str
    frequency: str
    suggested_product_category: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RoutineTemplateOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    routine_type: str = "skincare"
    skin_type_tags: list = []
    concern_tags: list = []
    is_active: bool = True
    seed_version: int = 1
    steps: List[RoutineTemplateStepOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateCloneRequest(BaseModel):
    template_id: int
    name: Optional[str] = None
