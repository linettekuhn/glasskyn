from __future__ import annotations

import json
import logging

import openai
from sqlalchemy.orm import Session

from app.core.config import OPENAI_API_KEY, OPENAI_MODEL
from app.models.routine import SkinProfile
from app.schemas.ingredient_analysis import (
    IngredientAnalysisResponse,
    MatchedIngredient,
    NotFoundIngredient,
    AnalysisStats,
)
from app.services.rag_retrieval import retrieve_safety_records, LOW_CONFIDENCE

logger = logging.getLogger(__name__)

_client: openai.OpenAI | None = None
_rate_history: list[float] = []

LLM_RATE_LIMIT_RPM = 10
LLM_TIMEOUT_SECS = 30
MAX_RETRIES = 1


def _get_client() -> openai.OpenAI:
    global _client
    if _client is None:
        _client = openai.OpenAI(api_key=OPENAI_API_KEY, timeout=LLM_TIMEOUT_SECS)
    return _client


def _check_rate_limit() -> None:
    import time
    now = time.time()
    cutoff = now - 60
    _rate_history[:] = [t for t in _rate_history if t > cutoff]
    if len(_rate_history) >= LLM_RATE_LIMIT_RPM:
        raise RuntimeError(
            f"LLM rate limit exceeded: max {LLM_RATE_LIMIT_RPM} requests per minute"
        )
    _rate_history.append(now)


def _compute_score(stats: dict) -> float | None:
    if stats["matched"] == 0:
        return None
    return round(stats["avg_safety_score"], 1)


def _compute_flags(matched: list[dict], not_found: list[dict]) -> list[str]:
    flags = []
    for m in matched:
        meta = m.get("metadata", {})
        name = m.get("canonical_name") or meta.get("ingredient_name") or m.get("id", "?")
        score = meta.get("safety_score", 0)
        if score >= 4:
            risks = json.loads(meta.get("known_risks", "[]")) if meta else []
            reason = risks[0] if risks else ("high safety concern" if score >= 6 else "moderate safety concern")
            flags.append(f"{name}: {reason}")
    if not_found:
        for nf in not_found:
            flags.append(f"{nf['raw_text']}: no verified safety data")
    return flags


def get_user_skin_type(user_id: int, db: Session) -> str | None:
    profile = db.query(SkinProfile).filter(SkinProfile.user_id == user_id).first()
    return profile.skin_type if profile else None


def _build_rag_system_prompt(skin_type: str | None, matched: list[dict], not_found: list[dict]) -> str:
    skin_ctx = f"The user has {skin_type} skin." if skin_type else "The user's skin type is unknown."

    matched_lines = []
    for m in matched:
        meta = m.get("metadata", {})
        name = m.get("canonical_name") or meta.get("ingredient_name") or m.get("id", "?")
        score = meta.get("safety_score", "?")
        risks = json.loads(meta.get("known_risks", "[]")) if meta else []
        risks_count = len(risks)
        conf = m.get("confidence", 1.0)
        mtype = m.get("match_type", "?")
        conf_note = "" if conf >= 0.8 else " (approximate match — treat as uncertain)"
        matched_lines.append(f"- {name}: safety_score={score}, risks={risks_count}, match={mtype}{conf_note}")

    not_found_names = [nf["raw_text"] for nf in not_found]
    not_found_section = ""
    if not_found_names:
        not_found_section = (
            "\n\nIngredients with NO safety data available:\n"
            + "\n".join(f"- {n}" for n in not_found_names)
            + "\nFor these ingredients, provide your best general knowledge analysis "
            "and note that verified data is unavailable."
        )

    return (
        f"You are a cosmetic safety expert analyzing a product's ingredient list.\n"
        f"{skin_ctx}\n\n"
        "Based on the verified safety data below, provide:\n"
        "1. A safety summary in plain language (2-4 sentences)\n"
        "2. Key concerns for the user's skin type (if any)\n"
        "3. Notable benefits (if any)\n\n"
        "Verified safety data:\n"
        + "\n".join(matched_lines)
        + not_found_section
        + "\n\n"
        'Respond in JSON: {"analysis": "markdown summary"}'
    )


def _build_llm_only_system_prompt(skin_type: str | None, ingredient_text: str) -> str:
    skin_ctx = f"The user has {skin_type} skin." if skin_type else "The user's skin type is unknown."

    return (
        f"You are a cosmetic safety expert analyzing a product's ingredient list.\n"
        f"{skin_ctx}\n\n"
        "No verified safety database results are available for these ingredients. "
        "Provide your best general-knowledge analysis based on cosmetic chemistry principles.\n"
        "Include a disclaimer that this analysis is not from a verified safety database.\n\n"
        f"Ingredients: {ingredient_text}\n\n"
        'Respond in JSON: {"analysis": "markdown summary with disclaimer"}'
    )


def _call_llm(messages: list[dict]) -> dict | None:
    try:
        _check_rate_limit()
    except RuntimeError as e:
        logger.warning("Rate limit hit: %s", e)
        return None

    client = _get_client()

    for attempt in range(1 + MAX_RETRIES):
        try:
            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0,
                max_tokens=500,
            )

            content = response.choices[0].message.content
            if not content:
                logger.warning("LLM returned empty content")
                return None

            usage = response.usage
            if usage:
                logger.info(
                    "RAG LLM usage: %d prompt + %d completion = %d total",
                    usage.prompt_tokens,
                    usage.completion_tokens,
                    usage.total_tokens,
                )

            return json.loads(content)

        except (openai.APITimeoutError, openai.RateLimitError) as e:
            logger.warning("LLM call failed (attempt %d/%d): %s", attempt + 1, MAX_RETRIES + 1, e)
            if attempt < MAX_RETRIES:
                continue
            return None
        except Exception as e:
            logger.error("LLM call failed: %s", e)
            return None

    return None


def _format_response(
    method: str,
    matched: list[dict],
    not_found: list[dict],
    stats: dict,
    llm_result: dict | None,
) -> IngredientAnalysisResponse:
    formatted_matched = []
    for m in matched:
        meta = m.get("metadata", {})
        formatted_matched.append(MatchedIngredient(
            ingredient_name=m.get("canonical_name") or meta.get("ingredient_name") or m.get("id", "?"),
            raw_text=m.get("raw_text", "?"),
            safety_score=meta.get("safety_score", 0),
            known_risks=json.loads(meta.get("known_risks", "[]")) if meta else [],
            benefits=json.loads(meta.get("benefits", "[]")) if meta else [],
            confidence=m.get("confidence", 0),
            match_type=m.get("match_type", "?"),
        ))

    formatted_not_found = [
        NotFoundIngredient(raw_text=nf["raw_text"], confidence=nf.get("confidence", 0))
        for nf in not_found
    ]

    return IngredientAnalysisResponse(
        method=method,
        analysis=llm_result.get("analysis") if llm_result else None,
        matched=formatted_matched,
        not_found=formatted_not_found,
        stats=AnalysisStats(**stats),
        overall_safety_score=_compute_score(stats),
        flags=_compute_flags(matched, not_found),
        source_attribution=["EWG Skin Deep", "INCIDecoder", "ChromaDB"] if method == "rag" else [],
    )


def analyze_ingredient_text(
    ingredient_text: str,
    skin_type: str | None,
    db: Session,
) -> IngredientAnalysisResponse:
    if not ingredient_text or not ingredient_text.strip():
        return IngredientAnalysisResponse(
            method="no_data",
            analysis="No ingredient list provided. Please scan the back label of your product.",
            stats=AnalysisStats(total=0, matched=0, not_found=0, avg_safety_score=0, total_known_risks=0),
        )

    result = retrieve_safety_records(ingredient_text, min_confidence=LOW_CONFIDENCE)
    matched = result["matched"]
    not_found = result["not_found"]
    stats = result["stats"]

    if stats["total"] == 0:
        return _format_response("no_data", matched, not_found, stats, None)

    coverage = stats["matched"] / stats["total"] if stats["total"] > 0 else 0

    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set, returning retrieval-only results")
        return _format_response("rag_no_llm", matched, not_found, stats, None)

    if coverage < 0.5:
        logger.info("Low coverage (%.0f%%), falling back to llm_only", coverage * 100)
        messages = [
            {"role": "system", "content": _build_llm_only_system_prompt(skin_type, ingredient_text)},
            {"role": "user", "content": f"Analyze these ingredients: {ingredient_text}"},
        ]
        llm_result = _call_llm(messages)
        return _format_response("llm_only", matched, not_found, stats, llm_result)

    messages = [
        {"role": "system", "content": _build_rag_system_prompt(skin_type, matched, not_found)},
        {"role": "user", "content": "Analyze this product's ingredients for safety."},
    ]
    llm_result = _call_llm(messages)

    if llm_result is None:
        return _format_response("unavailable", matched, not_found, stats, None)

    return _format_response("rag", matched, not_found, stats, llm_result)
