"""Shared skin-progress aggregation for the agent tool and the nudge.

Pure service code: takes ``(db, user_id, ...)`` and returns plain dicts.
No LangChain imports. Both ``agent_tools.get_skin_progress`` and
``services.skin_nudge`` call into this module.

Privacy: every query filters on ``user_id`` passed by the caller (which
must come from the request closure, never from LLM input).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.models.skin import SkinConcern, SkinSession
from app.models.user_preference import UserPreference
from app.services.skin_zones import VALID_ZONES, zone_for_concern

logger = logging.getLogger(__name__)

DEFAULT_SESSION_WINDOW = 10
DEFAULT_DAYS_WINDOW = 90
MAX_CONCERNS = 40
TREND_DAYS = 30


def get_user_timezone(db: Session, user_id: int) -> Optional[str]:
    try:
        prefs = (
            db.query(UserPreference)
            .filter(UserPreference.user_id == user_id)
            .first()
        )
        tz = prefs.timezone if prefs else None
        return tz.strip() if isinstance(tz, str) and tz.strip() else None
    except Exception:
        return None


def _resolve_tz(tz_name: Optional[str]):
    if tz_name:
        try:
            return ZoneInfo(tz_name)
        except (ZoneInfoNotFoundError, ValueError, KeyError):
            logger.debug("Invalid timezone %r, falling back to UTC", tz_name)
    return timezone.utc


def _as_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def calendar_day_diff(
    start: Optional[datetime],
    end: Optional[datetime],
    tz_name: Optional[str] = None,
) -> Optional[int]:
    """Calendar-day difference in the user's timezone (fallback UTC).

    Mirrors frontend ``calendarDayDiff`` (local day keys, 11pm -> 8am = 1).
    Returns None when either date is missing.
    """
    if start is None or end is None:
        return None
    tz = _resolve_tz(tz_name)
    try:
        s = _as_aware(start).astimezone(tz).date()
        e = _as_aware(end).astimezone(tz).date()
        return (e - s).days
    except Exception:
        return None


def _local_day_key(dt: Optional[datetime], tz_name: Optional[str]) -> str:
    if dt is None:
        return "?"
    tz = _resolve_tz(tz_name)
    try:
        return _as_aware(dt).astimezone(tz).date().isoformat()
    except Exception:
        return "?"


def _now(tz_name: Optional[str]) -> datetime:
    return datetime.now(_resolve_tz(tz_name))


def get_skin_progress_summary(
    db: Session,
    user_id: int,
    zone: Optional[str] = None,
    status: Optional[str] = None,
    days_back: int = 30,
) -> dict:
    """Aggregate the user's skin-progress history.

    Returns a plain dict (also used for text formatting via
    :func:`format_skin_progress`). On invalid filter input returns
    ``{"error": "..."}`` instead of raising.
    """
    zone_filter = zone.strip().lower() if isinstance(zone, str) and zone.strip() else None
    if zone_filter is not None and zone_filter not in VALID_ZONES:
        return {"error": f"Unknown area '{zone}'. Try one of: {', '.join(VALID_ZONES)}."}

    status_filter: Optional[str] = None
    if isinstance(status, str) and status.strip():
        s = status.strip().lower()
        if s in ("active", "ongoing"):
            status_filter = "active"
        elif s in ("resolved", "no longer marked", "healed"):
            status_filter = "resolved"
        else:
            return {"error": "Unknown status. Try 'active' or 'resolved'."}

    try:
        window_days = int(days_back)
    except (TypeError, ValueError):
        window_days = 30
    # days_back can only narrow the window, never exceed 90.
    window_days = max(1, min(window_days, DEFAULT_DAYS_WINDOW))

    tz_name = get_user_timezone(db, user_id)
    now = _now(tz_name)

    sessions: list[SkinSession] = (
        db.query(SkinSession)
        .filter(SkinSession.user_id == user_id)
        .order_by(SkinSession.timestamp.desc(), SkinSession.id.desc())
        .all()
    )
    if not sessions:
        return {"has_sessions": False, "session_count": 0}

    session_by_id = {s.id: s for s in sessions}

    cutoff = now - timedelta(days=window_days)
    in_window = [
        s
        for s in sessions
        if _as_aware(s.timestamp) is not None
        and _as_aware(s.timestamp) >= _as_aware(cutoff)
    ]
    # Whichever of last N sessions or last `window_days` is smaller.
    window_sessions = in_window[:DEFAULT_SESSION_WINDOW]
    if not window_sessions:
        # All sessions are older than the window: show the most recent ones
        # so the tool still answers instead of going empty.
        window_sessions = sessions[:DEFAULT_SESSION_WINDOW]
    window_ids = {s.id for s in window_sessions}

    concerns: list[SkinConcern] = (
        db.query(SkinConcern)
        .filter(SkinConcern.user_id == user_id)
        .order_by(SkinConcern.id.desc())
        .all()
    )

    def _first_seen_ts(c: SkinConcern) -> Optional[datetime]:
        created = session_by_id.get(c.created_session_id)
        if created is not None and created.timestamp is not None:
            return created.timestamp
        # Creation session was deleted: fall back to the earliest
        # surviving history entry (history is appended chronologically).
        earliest = None
        for h in c.history or []:
            s = session_by_id.get((h or {}).get("session_id"))
            if s is not None and s.timestamp is not None:
                if earliest is None or s.timestamp < earliest:
                    earliest = s.timestamp
        return earliest

    def _resolved_ts(c: SkinConcern) -> Optional[datetime]:
        if c.resolved_session_id is None:
            return None
        s = session_by_id.get(c.resolved_session_id)
        # Dangling pointer (resolution session deleted): treat as
        # unresolved-with-unknown-date, never crash.
        return s.timestamp if s is not None else None

    def _is_resolved(c: SkinConcern) -> bool:
        return c.resolved_session_id is not None and session_by_id.get(
            c.resolved_session_id
        ) is not None

    def _sessions_seen(c: SkinConcern) -> int:
        return sum(
            1 for h in (c.history or []) if session_by_id.get((h or {}).get("session_id")) is not None
        )

    def _latest_touch_id(c: SkinConcern) -> int:
        touches = [
            (h or {}).get("session_id")
            for h in (c.history or [])
            if session_by_id.get((h or {}).get("session_id")) is not None
        ]
        if touches:
            return max(t for t in touches if isinstance(t, int))
        return c.created_session_id or 0

    trend_cutoff = now - timedelta(days=TREND_DAYS)
    new_30 = 0
    healed_30 = 0
    resolved_ever = 0
    active_total = 0
    for c in concerns:
        first = _first_seen_ts(c)
        resolved_ts = _resolved_ts(c)
        resolved = _is_resolved(c)
        if resolved:
            resolved_ever += 1
        else:
            active_total += 1
        if first is not None and _as_aware(first) >= _as_aware(trend_cutoff):
            new_30 += 1
        if resolved_ts is not None and _as_aware(resolved_ts) >= _as_aware(trend_cutoff):
            healed_30 += 1

    # Session-over-session: latest check-in vs the one before it.
    is_baseline = len(sessions) < 2
    prev_new = 0
    prev_healed = 0
    if not is_baseline:
        latest_id = sessions[0].id
        for c in concerns:
            if c.created_session_id == latest_id:
                prev_new += 1
            if c.resolved_session_id == latest_id:
                prev_healed += 1

    # Display set: concerns touching the window, newest first, capped.
    visible = [
        c
        for c in concerns
        if c.created_session_id in window_ids
        or any(
            session_by_id.get((h or {}).get("session_id")) is not None
            and (h or {}).get("session_id") in window_ids
            for h in (c.history or [])
        )
    ]
    if zone_filter is not None:
        visible = [c for c in visible if zone_for_concern(c) == zone_filter]
    if status_filter is not None:
        want_resolved = status_filter == "resolved"
        visible = [c for c in visible if _is_resolved(c) == want_resolved]

    visible.sort(key=_latest_touch_id, reverse=True)
    truncated = max(0, len(visible) - MAX_CONCERNS)
    visible = visible[:MAX_CONCERNS]

    items: list[dict] = []
    by_zone: dict[str, int] = {z: 0 for z in VALID_ZONES}
    for c in visible:
        z = zone_for_concern(c)
        by_zone[z] = by_zone.get(z, 0) + 1
        first = _first_seen_ts(c)
        resolved = _is_resolved(c)
        resolved_ts = _resolved_ts(c)
        end = resolved_ts if resolved else now
        days_open = calendar_day_diff(first, end, tz_name)
        items.append(
            {
                "id": c.id,
                "label": c.label or "mark",
                "zone": z,
                "resolved": resolved,
                "status_label": "no longer marked" if resolved else "ongoing",
                "days_open": days_open if days_open is not None and days_open >= 0 else 0,
                "sessions_seen": _sessions_seen(c),
                "first_seen": _local_day_key(first, tz_name),
                "created_session_id": c.created_session_id,
            }
        )

    start_key = _local_day_key(min((s.timestamp for s in window_sessions)), tz_name)
    end_key = _local_day_key(max((s.timestamp for s in window_sessions)), tz_name)

    return {
        "has_sessions": True,
        "session_count": len(window_sessions),
        "total_sessions": len(sessions),
        "start": start_key,
        "end": end_key,
        "window_days": window_days,
        "active": active_total,
        "resolved_ever": resolved_ever,
        "new_30": new_30,
        "healed_30": healed_30,
        "net_30": new_30 - healed_30,
        "by_zone": by_zone,
        "concerns": items,
        "truncated": truncated,
        "prev_new": prev_new,
        "prev_healed": prev_healed,
        "is_baseline": is_baseline,
        "zone_filter": zone_filter,
        "status_filter": status_filter,
    }


def format_skin_progress(summary: dict[str, Any]) -> str:
    """Render the compact text block returned to the LLM / user."""
    if not isinstance(summary, dict):
        return "No skin check-ins yet."
    if summary.get("error"):
        return str(summary["error"])
    if not summary.get("has_sessions"):
        return "No skin check-ins yet."
    concerns = summary.get("concerns", [])
    if not concerns:
        return "No concerns match that filter."

    lines = [
        f"Skin overview (last {summary['session_count']} sessions, "
        f"{summary['start']} to {summary['end']}):",
        f"Ongoing: {summary['active']} | No longer marked (ever): "
        f"{summary['resolved_ever']} | New in last 30 days: {summary['new_30']} | "
        f"No longer marked in last 30 days: {summary['healed_30']}",
    ]
    if summary.get("is_baseline"):
        lines.append("Baseline so far: only one check-in yet.")
    else:
        lines.append(
            f"Since previous check-in: +{summary['prev_new']} new, "
            f"{summary['prev_healed']} no longer marked"
        )
    by_zone = summary.get("by_zone", {})
    lines.append(
        "By area: "
        + ", ".join(f"{z} {by_zone.get(z, 0)}" for z in VALID_ZONES)
    )
    for item in concerns:
        lines.append(
            f"- {item['label']} | {item['zone']} | open {item['days_open']}d | "
            f"{item['status_label']} | seen in {item['sessions_seen']} sessions"
        )
    if summary.get("truncated"):
        lines.append(f"(+{summary['truncated']} more not shown)")
    lines.append("Note: this reflects only what the user marked; it cannot diagnose.")
    return "\n".join(lines)
