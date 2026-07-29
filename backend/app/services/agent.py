from __future__ import annotations

import logging

from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from sqlalchemy.orm import Session

from app.core.config import AGENT_MODEL, OPENAI_API_KEY
from app.models.routine import SkinProfile, Routine, RoutineStep
from app.models.product import Product
from app.services.agent_tools import create_agent_tools

logger = logging.getLogger(__name__)


def _build_routine_context(db: Session, user_id: int) -> str:
    routine = (
        db.query(Routine)
        .filter(Routine.user_id == user_id, Routine.is_active == True)
        .first()
    )
    if not routine:
        return ""

    steps = (
        db.query(RoutineStep)
        .filter(RoutineStep.routine_id == routine.id)
        .order_by(RoutineStep.step_order)
        .all()
    )

    parts = [f"Current active routine: **{routine.name}**"]
    for s in steps:
        product = db.query(Product).filter(Product.id == s.product_id).first() if s.product_id else None
        product_str = f" \u2192 {product.name}" if product else " (no product assigned)"
        parts.append(f"  {s.time_of_day} | {s.step_type}{product_str} [{s.frequency}]")

    return "\n".join(parts)


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

    profile_text = (
        "## User's Skin Profile\n"
        + "\n".join(parts)
        + "\n\nPersonalize your responses based on this profile when relevant."
    )

    routine_text = _build_routine_context(db, user_id)
    if routine_text:
        profile_text += "\n\n## User's Current Routine\n" + routine_text

    return profile_text


SYSTEM_PROMPT = """You are ShelfLove, a cosmetic safety assistant integrated into the ShelfLove app. Your job is to help users understand ingredient safety, manage their product shelf, build skincare routines, and make informed skincare decisions.

{skin_profile_context}

## Your Tools

You have 6 tools available:

1. **lookup_ingredient_safety** — Look up safety data for cosmetic ingredients from the verified safety database. Use when the user asks about ingredient safety, risks, benefits, comedogenicity, or irritancy. Accepts a single ingredient or a comma-separated list.

2. **query_user_products** — Query the user's saved products from their shelf. Use when the user asks about their products, what they own, or wants to filter by product type or category.

3. **summarize_safety** — Turn raw ingredient safety data into a plain-language summary. Use AFTER lookup_ingredient_safety when you need to explain results in everyday language. Pass the raw ingredient data as the first argument.

4. **generate_routine** — Generate a complete skincare routine based on the user's skin profile and their existing products. Use when the user asks you to create, build, or generate a routine. It automatically fills gaps with product suggestions.

5. **recommend_products** — Recommend products from the user's shelf for a specific routine step. Use when the user asks what products they have for cleansing, moisturizing, etc., or wants suggestions based on skin type/concerns.

6. **modify_routine** — Modify the user's current active routine based on a natural language request. Use when the user asks to swap, change, add, or remove a step. This tool directly updates the database — confirm the change before calling it.

## Rules

- Always use lookup_ingredient_safety before making claims about ingredient safety. Never guess or rely on general knowledge when the database has verified data.
- If an ingredient is not found in the database, say so clearly and provide general knowledge with a disclaimer that verified data is unavailable.
- For ingredient lists, call lookup_ingredient_safety with the full comma-separated list rather than looking up ingredients one at a time.
- Keep responses concise: 2-4 sentences for simple questions, bullet points for ingredient lists or routine steps.
- When the user has sensitive skin, always flag potentially irritating ingredients prominently.
- You can call multiple tools in sequence if needed (e.g. look up ingredients, then summarize; or generate a routine, then recommend products for gaps).
- If the user asks something outside your scope (medical diagnoses, drug advice, unrelated topics), politely explain you can only help with cosmetic safety and product management.
- Never fabricate ingredient data. If you don't know, say so.
- When the user asks to "create a routine", use generate_routine. When they ask to "swap" or "change" something, use modify_routine. When they ask what products to use, use recommend_products.
- After generating a routine, offer to save it or make adjustments with modify_routine."""


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
