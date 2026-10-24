"""Template-based skin check-in nudges (v1: no LLM, no push).

Uses the shared aggregation in ``services.skin_progress``. Called as a
FastAPI BackgroundTask after POST /skin/check-in commits, with its own DB
session — never the request-scoped one.
"""
from __future__ import annotations

import logging
from typing import Optional

from app.db.session import SessionLocal
from app.models.skin_nudge import SkinNudge
from app.models.user_preference import UserPreference
from app.services.skin_progress import get_skin_progress_summary

logger = logging.getLogger(__name__)

_ZONE_PHRASES = {
    "forehead": "your forehead",
    "cheeks": "your cheeks",
    "nose": "your nose",
    "chin": "your chin",
    "jawline": "your jawline",
    "other": "other areas",
}

_ZONE_ORDER = ["forehead", "cheeks", "nose", "chin", "jawline", "other"]


def _marks(n: int) -> str:
    return "1 mark" if n == 1 else f"{n} marks"


def _zones_phrase(by_zone: dict, zones: Optional[list[str]] = None) -> str:
    """Natural join of zones with nonzero counts ('cheeks and chin')."""
    selected = zones if zones is not None else [z for z in _ZONE_ORDER if (by_zone or {}).get(z, 0) > 0]
    selected = [z for z in _ZONE_ORDER if z in set(selected)]
    if not selected:
        return "the marked areas"
    phrases = [_ZONE_PHRASES.get(z, z) for z in selected]
    if len(phrases) == 1:
        return phrases[0]
    if len(phrases) == 2:
        return f"{phrases[0]} and {phrases[1]}"
    return f"{', '.join(phrases[:-1])} and {phrases[-1]}"


def build_nudge_text(summary: dict) -> Optional[str]:
    """Build neutral, observational nudge copy from a progress summary."""
    if not isinstance(summary, dict) or summary.get("error"):
        return None
    if not summary.get("has_sessions"):
        return None
    if summary.get("is_baseline"):
        return "Baseline saved. Future check-ins will show changes here."

    prev_new = summary.get("prev_new", 0) or 0
    prev_healed = summary.get("prev_healed", 0) or 0
    by_zone = summary.get("by_zone", {}) or {}
    ongoing = sum(by_zone.get(z, 0) for z in _ZONE_ORDER)

    if prev_new == 0 and prev_healed == 0:
        if ongoing == 0:
            return "No change since your last check-in. Nothing currently marked."
        return (
            f"No change since your last check-in. "
            f"{ongoing} ongoing in {_zones_phrase(by_zone)}."
        )

    parts: list[str] = []
    if prev_new > 0:
        # Attribute new marks to the zones that currently have marks.
        parts.append(f"{_marks(prev_new)} noted on {_zones_phrase(by_zone)}")
    if prev_healed > 0:
        parts.append(f"{_marks(prev_healed)} no longer marked")
    body = " and ".join(parts)
    # Capitalize first letter.
    body = body[0].upper() + body[1:] if body else body
    tail = f" {ongoing} ongoing." if ongoing else ""
    return f"{body} since your last check-in.{tail}"


def create_nudge_for_session(user_id: int, session_id: int) -> None:
    """Insert one nudge row for (user_id, session_id). Never raises."""
    db = SessionLocal()
    try:
        prefs = (
            db.query(UserPreference)
            .filter(UserPreference.user_id == user_id)
            .first()
        )
        # Default TRUE when no preference row exists yet.
        if prefs is not None and prefs.skin_nudge_enabled is False:
            return

        existing = (
            db.query(SkinNudge)
            .filter(
                SkinNudge.user_id == user_id,
                SkinNudge.session_id == session_id,
            )
            .first()
        )
        if existing is not None:
            return

        summary = get_skin_progress_summary(db, user_id, days_back=90)
        text = build_nudge_text(summary)
        if not text:
            return

        db.add(SkinNudge(user_id=user_id, session_id=session_id, text=text))
        db.commit()
    except Exception as e:
        logger.warning(
            "Skipping skin nudge: user=%s session=%s (%s)", user_id, session_id, e
        )
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()
