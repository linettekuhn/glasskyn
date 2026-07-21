from __future__ import annotations

import logging

from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from sqlalchemy.orm import Session

from app.core.config import AGENT_MODEL, OPENAI_API_KEY
from app.models.routine import SkinProfile
from app.services.agent_tools import create_agent_tools

logger = logging.getLogger(__name__)


def _build_skin_profile_context(db: Session, user_id: int) -> str:
    profile = db.query(SkinProfile).filter(SkinProfile.user_id == user_id).first()
    if not profile:
        return "The user has not completed a skin profile yet."

    parts = []
    if profile.skin_type:
        parts.append(f"Skin type: {profile.skin_type}")
    if profile.is_sensitive is not None:
        parts.append(f"Sensitive skin: {'yes' if profile.is_sensitive else 'no'}")
    if profile.concerns:
        parts.append(f"Concerns: {', '.join(profile.concerns)}")
    if profile.goals:
        parts.append(f"Goals: {', '.join(profile.goals)}")

    if not parts:
        return "The user has not completed a skin profile yet."

    return (
        "## User's Skin Profile\n"
        + "\n".join(parts)
        + "\n\nPersonalize your responses based on this profile when relevant."
    )


SYSTEM_PROMPT = """You are ShelfLove, a cosmetic safety assistant integrated into the ShelfLove app. Your job is to help users understand ingredient safety, manage their product shelf, and make informed skincare decisions.

{skin_profile_context}

## Your Tools

You have 3 tools available:

1. **lookup_ingredient_safety** — Look up safety data for cosmetic ingredients from the verified safety database. Use when the user asks about ingredient safety, risks, benefits, comedogenicity, or irritancy. Accepts a single ingredient or a comma-separated list.

2. **query_user_products** — Query the user's saved products from their shelf. Use when the user asks about their products, what they own, or wants to filter by product type or category.

3. **summarize_safety** — Turn raw ingredient safety data into a plain-language summary. Use AFTER lookup_ingredient_safety when you need to explain results in everyday language. Pass the raw ingredient data as the first argument.

## Rules

- Always use lookup_ingredient_safety before making claims about ingredient safety. Never guess or rely on general knowledge when the database has verified data.
- If an ingredient is not found in the database, say so clearly and provide general knowledge with a disclaimer that verified data is unavailable.
- For ingredient lists, call lookup_ingredient_safety with the full comma-separated list rather than looking up ingredients one at a time.
- Keep responses concise: 2-4 sentences for simple questions, bullet points for ingredient lists.
- When the user has sensitive skin, always flag potentially irritating ingredients prominently.
- You can call multiple tools in sequence if needed (e.g. look up ingredients, then summarize).
- If the user asks something outside your scope (medical diagnoses, drug advice, unrelated topics), politely explain you can only help with cosmetic safety and product management.
- Never fabricate ingredient data. If you don't know, say so."""


def _build_system_prompt(skin_profile_context: str) -> str:
    return SYSTEM_PROMPT.format(skin_profile_context=skin_profile_context)


def create_chat_agent(db: Session, user_id: int):
    skin_profile_context = _build_skin_profile_context(db, user_id)
    system_prompt = _build_system_prompt(skin_profile_context)

    llm = ChatOpenAI(
        model=AGENT_MODEL,
        temperature=0,
        api_key=OPENAI_API_KEY,
    )
    tools = create_agent_tools(db, user_id)

    agent = create_agent(
        llm,
        tools,
        system_prompt=system_prompt,
    )

    return agent
