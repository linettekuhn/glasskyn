from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from sqlalchemy.orm import Session

from app.core.config import OPENAI_API_KEY
from app.middleware.auth import get_current_user, get_db
from app.models.chat import ChatMessage
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse, ChatMessageOut
from app.services.agent import create_chat_agent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


def _langchain_to_db_messages(
    langchain_messages: list,
    session_id: str,
    user_id: int,
    existing_ids: set[int],
) -> list[ChatMessage]:
    db_messages = []
    for msg in langchain_messages:
        if isinstance(msg, HumanMessage):
            db_messages.append(ChatMessage(
                session_id=session_id,
                user_id=user_id,
                role="user",
                content=msg.content,
            ))
        elif isinstance(msg, AIMessage):
            tool_calls = None
            if msg.tool_calls:
                tool_calls = msg.tool_calls
            db_messages.append(ChatMessage(
                session_id=session_id,
                user_id=user_id,
                role="assistant",
                content=msg.content,
                tool_calls=tool_calls,
            ))
        elif isinstance(msg, ToolMessage):
            db_messages.append(ChatMessage(
                session_id=session_id,
                user_id=user_id,
                role="tool",
                content=msg.content,
                tool_call_id=msg.tool_call_id,
            ))
    return db_messages


def _db_to_langchain_messages(messages: list[ChatMessage]) -> list:
    result = []
    for msg in messages:
        if msg.role == "user":
            result.append(HumanMessage(content=msg.content or ""))
        elif msg.role == "assistant":
            result.append(AIMessage(
                content=msg.content or "",
                tool_calls=msg.tool_calls or [],
            ))
        elif msg.role == "tool":
            result.append(ToolMessage(
                content=msg.content or "",
                tool_call_id=msg.tool_call_id or "",
            ))
    return result


@router.post("", response_model=ChatResponse)
async def send_message(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent unavailable: OPENAI_API_KEY not configured",
        )

    session_id = body.session_id.strip()
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="session_id cannot be empty",
        )

    history_records = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.session_id == session_id,
            ChatMessage.user_id == current_user.id,
        )
        .order_by(ChatMessage.created_at)
        .all()
    )

    history = _db_to_langchain_messages(history_records)
    history.append(HumanMessage(content=body.message))

    try:
        agent = create_chat_agent(db, current_user.id)
        result = agent.invoke({"messages": history})
    except Exception as e:
        logger.error("Agent invocation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process message",
        )

    existing_ids = {r.id for r in history_records}
    all_messages = result.get("messages", [])
    new_db_messages = _langchain_to_db_messages(
        all_messages, session_id, current_user.id, existing_ids,
    )

    saved = []
    for msg in new_db_messages:
        db.add(msg)
        db.flush()
        saved.append(msg)

    db.commit()

    return ChatResponse(
        session_id=session_id,
        messages=[ChatMessageOut.model_validate(m) for m in saved],
    )


@router.get("/{session_id}/messages", response_model=list[ChatMessageOut])
def get_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    messages = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.session_id == session_id,
            ChatMessage.user_id == current_user.id,
        )
        .order_by(ChatMessage.created_at)
        .all()
    )
    if not messages:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    return [ChatMessageOut.model_validate(m) for m in messages]


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deleted = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.session_id == session_id,
            ChatMessage.user_id == current_user.id,
        )
        .delete()
    )
    if deleted == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    db.commit()
    return None
