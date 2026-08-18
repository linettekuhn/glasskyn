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

_INCI_MARKER_RE = re.compile(
    r"\b(?:ingredients?|ingrédients?|ingredient\s*list|lista\s*de?\s*ingredientes?)\s*[:/\-]?\s*",
    re.IGNORECASE,
)

_MIN_INCI_TOKENS = 4
_MAX_TOKEN_LENGTH = 50

_OCR_DOTS_RE = re.compile(r"\.{2,}")

_DRUG_FACTS_HEADER_RE = re.compile(
    r"\bDrug\s*Facts\b",
    re.IGNORECASE,
)

_INCI_SUFFIX_RE = re.compile(
    r"(?:"
    r"(?:acrylate|crosspolymer|polymer)"
    r"|(?:sulfate|betaine|glucoside|stearate|benzoate|salicylate"
    r"|octinoxate|octisalate|octocrylene|homosalate|oxybenzone|avobenzone"
    r"|tocopherol|retinol|niacinamide|panthenol|allantoin|adenosine"
    r"|hyaluronate|phenoxyethanol|carbomer|xanthan)"
    r"|[- ](?:acid|alcohol|extract|oil|peroxide|oxide|dioxide|starch|gum|silica)"
    r"|(?:ate|ide|yl|ol|in|ane|ose|one|ene|ase)\b"
    r")",
    re.IGNORECASE,
)

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


def _build_ingredient_index(dataset_path: Path | None = None) -> set[str]:
    path = dataset_path or DATASET_PATH
    with open(path, encoding="utf-8") as f:
        dataset = json.load(f)
    names: set[str] = set()
    for record in dataset:
        names.add(record["ingredient_name"].lower())
        for alias in record.get("aliases", []):
            names.add(alias.lower())
    return names


_INGREDIENT_INDEX: set[str] | None = None


def _get_ingredient_index() -> set[str]:
    global _INGREDIENT_INDEX
    if _INGREDIENT_INDEX is None:
        _INGREDIENT_INDEX = _build_ingredient_index()
    return _INGREDIENT_INDEX


def _normalize_unicode(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    for pattern, replacement in _NORMALIZATIONS:
        text = pattern.sub(replacement, text)
    return text


def _strip_prefix(text: str) -> str:
    return _PREFIX_RE.sub("", text).strip()


def _clean_token(token: str) -> str:
    token = _normalize_unicode(token)
    token = _OCR_DOTS_RE.sub(" ", token)
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


def _is_valid_ingredient_token(cleaned: str, ingredient_index: set[str]) -> bool:
    if len(cleaned) > _MAX_TOKEN_LENGTH or len(cleaned) < 2:
        return False
    if re.fullmatch(r"[\d\s.,/%\-:]+", cleaned):
        return False
    if "." in cleaned or ":" in cleaned:
        return False
    word_count = len(cleaned.split())
    if word_count > 5:
        return False

    lower = cleaned.lower()

    if lower in ingredient_index:
        return True

    for name in ingredient_index:
        if len(name) > 3 and name in lower:
            return True
        if len(lower) > 3 and lower in name:
            return True

    if _INCI_SUFFIX_RE.search(lower):
        return True

    return False


def _extract_inci_section(raw_text: str, ingredient_index: set[str]) -> str | None:
    normalized = _normalize_unicode(raw_text)

    marker_match = _INCI_MARKER_RE.search(normalized)
    if marker_match:
        return normalized[marker_match.end():]

    normalized = _OCR_DOTS_RE.sub(" ", normalized)

    header_match = _DRUG_FACTS_HEADER_RE.search(normalized)
    if header_match:
        normalized = normalized[:header_match.start()]

    if not marker_match and not header_match:
        return None

    candidates = _SPLIT_RE.split(normalized)
    candidates = [c.strip() for c in candidates if c.strip()]

    best_section: str | None = None
    best_count = 0

    for i, token in enumerate(candidates):
        cleaned = _clean_token(token)
        if not cleaned or not _is_valid_ingredient_token(cleaned, ingredient_index):
            continue
        count = 0
        j = i
        while j < len(candidates):
            cleaned_j = _clean_token(candidates[j])
            if not cleaned_j or not _is_valid_ingredient_token(cleaned_j, ingredient_index):
                break
            count += 1
            j += 1
        if count >= best_count:
            best_count = count
            best_section = ", ".join(candidates[i:j])

    if best_section and best_count >= _MIN_INCI_TOKENS:
        return best_section

    return None


def _match_token(
    token: str, alias_map: dict[str, dict], ingredient_index: set[str]
) -> dict:
    if _is_color_index(token):
        return {"canonical_name": None, "id": None, "raw_text": token, "match_type": "skipped", "confidence": 0}

    cleaned = _clean_token(token)
    if not cleaned:
        return {"canonical_name": None, "id": None, "raw_text": token, "match_type": "skipped", "confidence": 0}

    if not _is_valid_ingredient_token(cleaned, ingredient_index):
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

    ingredient_index = _get_ingredient_index()

    inci_text = _extract_inci_section(raw_text, ingredient_index)
    if inci_text is None:
        return []

    alias_map = _get_alias_map()
    tokens = _split_ingredients(inci_text)

    seen_canonical: set[str] = set()
    results: list[dict] = []

    for token in tokens:
        result = _match_token(token, alias_map, ingredient_index)

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
    global _ALIAS_MAP, _INGREDIENT_INDEX
    _ALIAS_MAP = _build_alias_map(dataset_path)
    _INGREDIENT_INDEX = _build_ingredient_index(dataset_path)
    return _ALIAS_MAP
