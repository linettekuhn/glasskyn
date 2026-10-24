"""Region-to-zone mapping for skin concerns.

Mirrors frontend/src/utils/skin-regions.ts exactly. The stored
``concern.anchor["region"]`` (pinned at creation via ``compute_anchor``)
is the only input — never recompute. The two tables must stay in sync.
"""
from __future__ import annotations

from typing import Any

VALID_ZONES: tuple[str, ...] = (
    "forehead",
    "cheeks",
    "nose",
    "chin",
    "jawline",
    "other",
)

_FOREHEAD = {"forehead"}
_CHEEKS = {"left_cheek", "right_cheek", "under_eye_left", "under_eye_right"}
_NOSE = {"nose"}
_CHIN = {"chin"}
_JAWLINE = {"jawline_left", "jawline_right"}


def _normalize_region(region: Any) -> str:
    if isinstance(region, str):
        return region.strip().lower()
    return ""


def zone_for_region(region: Any) -> str:
    """Map a stored anchor region to its user-facing zone."""
    r = _normalize_region(region)
    if r in _FOREHEAD:
        return "forehead"
    if r in _CHEEKS:
        return "cheeks"
    if r in _NOSE:
        return "nose"
    if r in _CHIN:
        return "chin"
    if r in _JAWLINE:
        return "jawline"
    return "other"


def zone_for_concern(concern: Any) -> str:
    """Zone for a concern from its stored (pinned) anchor. Never recomputed."""
    anchor = getattr(concern, "anchor", None)
    if isinstance(concern, dict):
        anchor = concern.get("anchor")
    region = None
    if isinstance(anchor, dict):
        region = anchor.get("region")
    return zone_for_region(region)


def is_valid_zone(zone: Any) -> bool:
    return isinstance(zone, str) and zone.strip().lower() in VALID_ZONES
