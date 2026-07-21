from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ChatMessageOut(BaseModel):
    id: int
    session_id: str
    role: str
    content: Optional[str] = None
    tool_calls: Optional[list] = None
    tool_call_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    session_id: str
    messages: List[ChatMessageOut]
