from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from sqlalchemy.orm import Session

from app.core.config import OPENAI_API_KEY, CHAT_HISTORY_WINDOW, CHAT_SUMMARY_INTERVAL
from app.middleware.auth import get_current_user, get_db
from app.models.chat import ChatMessage, ChatSession
from app.models.routine import Routine, SkinProfile
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse, ChatMessageOut
from app.services.agent import create_chat_agent, summarize_conversation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


def _routine_confirmation(db: Session, user_id: int) -> str:
    profile = (
        db.query(SkinProfile)
        .filter(SkinProfile.user_id == user_id)
        .first()
    )
    if not profile:
        return (
            "I've created a personalized routine for you. "
            "I'll take you to the edit routine page to confirm or make changes."
        )

    focus_parts = []
    if profile.skin_type:
        focus_parts.append(f"{profile.skin_type} skin")
    if profile.concerns:
        focus_parts.append(" and ".join(profile.concerns))
    if profile.goals:
        focus_parts.append(" and ".join(profile.goals))

    focus = ", and ".join(focus_parts)
    return (
        f"I've created a routine focused on your {focus}. "
        "I'll take you to the edit routine page to confirm or make changes."
    )


def _messages_to_text(messages: list) -> str:
    lines = []
    for msg in messages:
        if isinstance(msg, HumanMessage):
            lines.append(f"User: {msg.content}")
        elif isinstance(msg, AIMessage):
            if msg.content:
                lines.append(f"Assistant: {msg.content}")
            elif msg.tool_calls:
                names = ", ".join(
                    tc.get("name", "") if isinstance(tc, dict) else getattr(tc, "name", "")
                    for tc in msg.tool_calls
                )
                lines.append(f"Assistant called tool: {names}")
        elif isinstance(msg, ToolMessage):
            lines.append(f"Tool result: {msg.content}")
    return "\n".join(lines)


def _sanitize_tool_pairs(messages: list) -> list:
    """Drop tool messages whose tool_call_id was not declared by the preceding
    assistant message, and strip tool_calls from any assistant message that has
    no matching tool result. OpenAI rejects both patterns."""
    result = []
    pending: set = set()
    last_ai = None
    for msg in messages:
        if isinstance(msg, HumanMessage):
            if pending and last_ai is not None:
                last_ai.tool_calls = []
            pending = set()
            last_ai = None
            result.append(msg)
        elif isinstance(msg, AIMessage):
            if pending and last_ai is not None:
                last_ai.tool_calls = []
            pending = {
                tc.get("id") for tc in msg.tool_calls if isinstance(tc, dict)
            }
            last_ai = msg
            result.append(msg)
        elif isinstance(msg, ToolMessage):
            if msg.tool_call_id in pending:
                pending.discard(msg.tool_call_id)
                result.append(msg)
            else:
                logger.warning(
                    "Dropping orphaned tool message (tool_call_id=%s)", msg.tool_call_id
                )

    if pending and last_ai is not None:
        last_ai.tool_calls = []
        if not last_ai.content:
            result.pop()
    return result


def _langchain_to_db_messages(
    langchain_messages: list,
    session_id: str,
    user_id: int,
) -> list[ChatMessage]:
    langchain_messages = _sanitize_tool_pairs(langchain_messages)
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
    return _sanitize_tool_pairs(result)


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
        .order_by(ChatMessage.id)
        .all()
    )

    history = _db_to_langchain_messages(history_records)

    session_row = (
        db.query(ChatSession)
        .filter(
            ChatSession.session_id == session_id,
            ChatSession.user_id == current_user.id,
        )
        .first()
    )

    conversation_summary = session_row.summary if session_row else None
    summarized_count = session_row.summarized_count if session_row else 0

    recent_msgs = history
    overflow_msgs = []
    windowed = len(history) > CHAT_HISTORY_WINDOW
    if windowed:
        cut = len(history) - CHAT_HISTORY_WINDOW
        overflow_msgs = history[:cut]
        recent_msgs = history[cut:]
        while recent_msgs and not isinstance(recent_msgs[0], HumanMessage):
            overflow_msgs.append(recent_msgs.pop(0))

        if summarized_count < len(overflow_msgs):
            new_overflow = overflow_msgs[summarized_count:]
            if len(new_overflow) >= CHAT_SUMMARY_INTERVAL:
                conversation_summary = summarize_conversation(
                    conversation_summary or "",
                    _messages_to_text(new_overflow),
                )
                summarized_count = len(overflow_msgs)

    agent_input = [*recent_msgs, HumanMessage(content=body.message)]

    try:
        agent = create_chat_agent(
            db, current_user.id, conversation_summary or ""
        )
        result = agent.invoke({"messages": agent_input})
    except Exception as e:
        logger.error("Agent invocation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process message",
        )

    all_messages = result.get("messages", [])
    new_db_messages = _langchain_to_db_messages(
        all_messages[len(agent_input) - 1 :], session_id, current_user.id,
    )

    saved = []
    for msg in new_db_messages:
        db.add(msg)
        db.flush()
        saved.append(msg)

    routine_generated = any(
        msg.tool_calls
        and any(
            (tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None))
            == "generate_routine"
            for tc in msg.tool_calls
        )
        for msg in saved
    )

    if routine_generated:
        for msg in reversed(saved):
            if msg.role == "assistant" and msg.content:
                msg.content = _routine_confirmation(db, current_user.id)
                break

    routine_id = None
    if routine_generated:
        newest_routine = (
            db.query(Routine)
            .filter(
                Routine.user_id == current_user.id,
                Routine.is_active == True,
            )
            .order_by(Routine.id.desc())
            .first()
        )
        routine_id = newest_routine.id if newest_routine else None

    if windowed:
        if session_row is None:
            session_row = ChatSession(
                session_id=session_id,
                user_id=current_user.id,
                summary=conversation_summary,
                summarized_count=summarized_count,
            )
            db.add(session_row)
        else:
            session_row.summary = conversation_summary
            session_row.summarized_count = summarized_count

    db.commit()

    return ChatResponse(
        session_id=session_id,
        messages=[ChatMessageOut.model_validate(m) for m in saved],
        routine_generated=routine_generated,
        routine_id=routine_id,
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
        .order_by(ChatMessage.id)
        .all()
    )
    return [ChatMessageOut.model_validate(m) for m in messages]


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id,
        ChatMessage.user_id == current_user.id,
    ).delete()
    db.query(ChatSession).filter(
        ChatSession.session_id == session_id,
        ChatSession.user_id == current_user.id,
    ).delete()
    db.commit()
    return None
