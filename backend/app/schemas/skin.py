from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


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
    # Client-set when the user dragged this carried circle during marking:
    # the appended history entry is stored user_corrected so it is never
    # flagged for Adjust. (Cross-photo coords can't be diffed server-side —
    # each photo is its own coordinate space — so the client must say so.)
    moved: bool = False


class CheckInRequest(BaseModel):
    image_file_key: str
    captured_at: datetime | None = None
    face_landmarks: dict[str, ConcernPoint] | None = None
    concerns: list[ConcernIn]
    moisture_rating: int | None = Field(default=None, ge=1, le=5)
    texture_rating: int | None = Field(default=None, ge=1, le=5)
    tone_rating: int | None = Field(default=None, ge=1, le=5)
    notes: str | None = Field(default=None, max_length=500)


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
    moisture_rating: int | None = None
    texture_rating: int | None = None
    tone_rating: int | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


class CheckInResponse(BaseModel):
    session_id: int
    concerns: list[ConcernOut]


class DeleteSkinDataResponse(BaseModel):
    deleted_sessions: int
    deleted_concerns: int


class DeleteSessionResponse(BaseModel):
    session_id: int
    """ Concerns that originated in this session and were removed with it. """
    deleted_concerns: int
    """ Concerns whose resolution pointer or history was trimmed. """
    updated_concerns: int


class ConcernPositionUpdate(BaseModel):
    x: float
    y: float


class ConcernPositionResponse(BaseModel):
    concern: ConcernOut
    # True only when the correction rewrote the concern-level anchor (first
    # appearance + finite landmarks). The client picks its toast copy and
    # future-capture expectations from this — it cannot infer it locally.
    anchor_updated: bool