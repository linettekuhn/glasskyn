from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

from app.core.config import BACKEND_DIR

DATASET_PATH = BACKEND_DIR / "data" / "ingredients" / "dataset.json"

_PREFIX_RE = re.compile(
    r"^\s*(?:ingredients?|ingrédients?|ingredient\s*list|lista\s*de?\s*ingredientes?)"
    r"(?:\s*[:\-(]|\s*$)",
    re.IGNORECASE,
)

_SPLIT_RE = re.compile(r"[,;\n]+")

_DASH_SPLIT_RE = re.compile(r"[\u2010-\u2015]+")

_PARENTHETICAL_RE = re.compile(r"\s*\([^)]*\)")

_PERCENTAGE_RE = re.compile(r"\s*\d+(?:\.\d+)?\s*%")

_TRAILING_GARBAGE_RE = re.compile(r"[\s,.\-;:]+$")

_COLOR_INDEX_RE = re.compile(r"^(?:CI\s*\d{5}|C\.I\.\s*\d{5})$", re.IGNORECASE)

_NON_INGREDIENT_RE = re.compile(
    r"^(?:CI\s|D&C\s|FD&C\s|FDC\s|E\d{3,4}\b|proprietary\s)",
    re.IGNORECASE,
)

_MULTI_SPACE_RE = re.compile(r"\s+")

_STAR_RE = re.compile(r"[*•●]")

_NORMALIZATIONS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"[\u00A0\u2000-\u200B\u202F\u205F\u3000]"), " "),
    (re.compile(r"[\u2010\u2011\u2012\u2013\u2014\u2015]"), "-"),
    (re.compile(r"[\u2018\u2019\u201A\u201B]"), "'"),
    (re.compile(r"[\u201C\u201D\u201E\u201F]"), '"'),
]


def _build_alias_map(dataset_path: Path | None = None) -> dict[str, dict]:
    path = dataset_path or DATASET_PATH
    with open(path, encoding="utf-8") as f:
        dataset = json.load(f)

    alias_map: dict[str, dict] = {}

    for record in dataset:
        canonical = record["ingredient_name"].lower()
        alias_map[canonical] = record

        for alias in record.get("aliases", []):
            key = alias.lower()
            if key not in alias_map:
                alias_map[key] = record

    return alias_map


_ALIAS_MAP: dict[str, dict] | None = None


def _get_alias_map() -> dict[str, dict]:
    global _ALIAS_MAP
    if _ALIAS_MAP is None:
        _ALIAS_MAP = _build_alias_map()
    return _ALIAS_MAP


def _normalize_unicode(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    for pattern, replacement in _NORMALIZATIONS:
        text = pattern.sub(replacement, text)
    return text


def _strip_prefix(text: str) -> str:
    return _PREFIX_RE.sub("", text).strip()


def _clean_token(token: str) -> str:
    token = _normalize_unicode(token)
    token = _STAR_RE.sub("", token)
    token = _PARENTHETICAL_RE.sub("", token)
    token = _PERCENTAGE_RE.sub("", token)
    token = _TRAILING_GARBAGE_RE.sub("", token)
    token = _MULTI_SPACE_RE.sub(" ", token).strip()
    return token


def _split_ingredients(raw_text: str) -> list[str]:
    text = _strip_prefix(raw_text)
    text = _DASH_SPLIT_RE.sub("\n", text)
    text = _normalize_unicode(text)
    return [t.strip() for t in _SPLIT_RE.split(text) if t.strip()]


def _is_color_index(token: str) -> bool:
    return bool(_COLOR_INDEX_RE.match(token)) or bool(_NON_INGREDIENT_RE.match(token))


def _match_token(
    token: str, alias_map: dict[str, dict]
) -> dict:
    if _is_color_index(token):
        return {"canonical_name": None, "id": None, "raw_text": token, "match_type": "skipped", "confidence": 0}

    cleaned = _clean_token(token)
    if not cleaned:
        return {"canonical_name": None, "id": None, "raw_text": token, "match_type": "skipped", "confidence": 0}

    lower = cleaned.lower()

    if lower in alias_map:
        record = alias_map[lower]
        if lower == record["ingredient_name"].lower():
            return {"canonical_name": record["ingredient_name"], "id": record["id"], "raw_text": token, "match_type": "exact", "confidence": 1.0}
        return {"canonical_name": record["ingredient_name"], "id": record["id"], "raw_text": token, "match_type": "alias", "confidence": 1.0}

    canonical_keys = {r["ingredient_name"].lower() for r in alias_map.values()}

    for key, record in alias_map.items():
        if key in canonical_keys:
            continue
        if len(key) > 3 and key in lower:
            return {"canonical_name": record["ingredient_name"], "id": record["id"], "raw_text": token, "match_type": "partial", "confidence": 0.9}

    for key, record in alias_map.items():
        if key not in canonical_keys:
            continue
        if len(lower) > 3 and lower in key:
            return {"canonical_name": record["ingredient_name"], "id": record["id"], "raw_text": token, "match_type": "partial", "confidence": 0.9}

    return {"canonical_name": None, "id": None, "raw_text": token, "match_type": "not_found", "confidence": 0}


def normalize_ingredients(raw_text: str | None) -> list[dict]:
    if not raw_text or not raw_text.strip():
        return []

    alias_map = _get_alias_map()
    tokens = _split_ingredients(raw_text)

    seen_canonical: set[str] = set()
    results: list[dict] = []

    for token in tokens:
        result = _match_token(token, alias_map)

        if result["match_type"] == "skipped":
            continue

        canonical = result.get("canonical_name")
        if canonical:
            key = canonical.lower()
            if key in seen_canonical:
                continue
            seen_canonical.add(key)

        results.append(result)

    return results


def reload_dataset(dataset_path: Path) -> dict[str, dict]:
    global _ALIAS_MAP
    _ALIAS_MAP = _build_alias_map(dataset_path)
    return _ALIAS_MAP
