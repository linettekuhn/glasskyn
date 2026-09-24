from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ConcernPoint(BaseModel):
    x: float
    y: float


class ConcernIn(BaseModel):
    uuid: str
    number: int
    x: float
    y: float
    concern_id: str | None = None
    status: str
    carried_uuid: str | None = None
    resolved: bool = False


class CheckInRequest(BaseModel):
    image_file_key: str
    captured_at: datetime | None = None
    face_landmarks: dict[str, ConcernPoint] | None = None
    concerns: list[ConcernIn]


class ConcernOut(BaseModel):
    id: int
    uuid: str | None
    user_id: int
    label: str | None
    status: str | None
    created_session_id: int
    resolved_session_id: int | None
    anchor: dict | None
    history: list
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class SessionOut(BaseModel):
    id: int
    user_id: int
    timestamp: datetime
    image_url: str
    face_landmarks: dict[str, ConcernPoint] | None
    concerns: list[ConcernOut] = []

    model_config = {"from_attributes": True}


class CheckInResponse(BaseModel):
    session_id: int
    concerns: list[ConcernOut]


class DeleteSkinDataResponse(BaseModel):
    deleted_sessions: int
    deleted_concerns: int