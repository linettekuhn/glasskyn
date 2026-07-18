from __future__ import annotations

import logging

from app.services.ingredient_normalization import normalize_ingredients
from app.services.vector_store import get_collection, query_ingredients

logger = logging.getLogger(__name__)

HIGH_CONFIDENCE = 0.8
LOW_CONFIDENCE = 0.5
MAX_DISTANCE = 1.5


def _confidence_from_distance(distance: float) -> float:
    return max(0.0, 1.0 - (distance / MAX_DISTANCE))


def _exact_lookup(doc_id: str) -> dict | None:
    collection = get_collection()
    result = collection.get(ids=[doc_id], include=["documents", "metadatas"])
    if not result["ids"]:
        logger.warning("Exact lookup failed for: %s", doc_id)
        return None
    return {
        "id": result["ids"][0],
        "document": result["documents"][0],
        "metadata": result["metadatas"][0],
        "confidence": 1.0,
        "match_type": "exact",
    }


def _fuzzy_lookup(raw_text: str, min_confidence: float) -> dict | None:
    results = query_ingredients(raw_text, n_results=1)
    if not results:
        return None
    top = results[0]
    distance = top["distance"]
    confidence = _confidence_from_distance(distance)
    if confidence < min_confidence:
        logger.debug(
            "Fuzzy lookup below threshold for '%s': dist=%.3f conf=%.3f",
            raw_text, distance, confidence,
        )
        return None
    return {
        "id": top["id"],
        "document": top["document"],
        "metadata": top["metadata"],
        "confidence": round(confidence, 3),
        "match_type": "semantic",
    }


def retrieve_safety_records(
    raw_ingredient_text: str,
    min_confidence: float = LOW_CONFIDENCE,
) -> dict:
    normalized = normalize_ingredients(raw_ingredient_text)

    matched: list[dict] = []
    not_found: list[dict] = []

    for item in normalized:
        ingredient_id = item.get("id")

        if ingredient_id:
            record = _exact_lookup(ingredient_id)
            if record:
                record["raw_text"] = item["raw_text"]
                record["canonical_name"] = item.get("canonical_name")
                matched.append(record)
            else:
                not_found.append({"raw_text": item["raw_text"], "confidence": 0})
        else:
            record = _fuzzy_lookup(item["raw_text"], min_confidence)
            if record:
                record["raw_text"] = item["raw_text"]
                record["canonical_name"] = record["metadata"].get("ingredient_name")
                matched.append(record)
            else:
                not_found.append({"raw_text": item["raw_text"], "confidence": 0})

    scores = [m["metadata"]["safety_score"] for m in matched if m.get("metadata")]
    risks = sum(m["metadata"].get("known_risks_count", 0) for m in matched if m.get("metadata"))

    stats = {
        "total": len(normalized),
        "matched": len(matched),
        "not_found": len(not_found),
        "avg_safety_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "total_known_risks": risks,
    }

    return {"matched": matched, "not_found": not_found, "stats": stats}


def retrieve_single(
    ingredient_name: str,
    min_confidence: float = LOW_CONFIDENCE,
) -> dict | None:
    record = _exact_lookup(ingredient_name.lower().replace(" ", "_"))
    if record:
        record["canonical_name"] = ingredient_name
        return record

    return _fuzzy_lookup(ingredient_name, min_confidence)
