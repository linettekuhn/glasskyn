import json
import logging
import time
from openai import OpenAI
from app.core.config import OPENAI_API_KEY, OPENAI_MODEL

logger = logging.getLogger(__name__)

_client: OpenAI | None = None
_rate_history: list[float] = []

MAX_OCR_CHARS = 2000
LLM_RATE_LIMIT_RPM = 10
LLM_TIMEOUT_SECS = 10


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=OPENAI_API_KEY, timeout=LLM_TIMEOUT_SECS)
    return _client


def _check_rate_limit() -> None:
    now = time.time()
    cutoff = now - 60
    _rate_history[:] = [t for t in _rate_history if t > cutoff]
    if len(_rate_history) >= LLM_RATE_LIMIT_RPM:
        raise RuntimeError(
            f"LLM rate limit exceeded: max {LLM_RATE_LIMIT_RPM} requests per minute"
        )
    _rate_history.append(now)


def extract_name_brand(merged_text: str | None) -> dict:
    if not merged_text or not merged_text.strip():
        logger.info("No OCR text provided to LLM, skipping")
        return {"product_name": None, "brand": None, "product_type": None}

    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set, skipping LLM extraction")
        return {"product_name": None, "brand": None, "product_type": None}

    truncated = merged_text.strip()[:MAX_OCR_CHARS]
    logger.info(
        "LLM extraction called: %d chars (truncated from %d)",
        len(truncated),
        len(merged_text),
    )

    try:
        _check_rate_limit()
    except RuntimeError as e:
        logger.warning("Rate limit hit, skipping LLM: %s", e)
        return {"product_name": None, "brand": None, "product_type": None}

    client = _get_client()

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract the product name, brand, and product type from the OCR text. "
                        'Return JSON with keys "product_name", "brand", and "product_type". '
                        "product_type must be one of: cleanser, toner, serum, moisturizer, "
                        "exfoliant, mask, spot_treatment, spf, oil, other. "
                        "Use null if unknown."
                    ),
                },
                {"role": "user", "content": truncated},
            ],
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=150,
        )

        usage = response.usage
        if usage:
            logger.info(
                "LLM token usage: %d prompt + %d completion = %d total",
                usage.prompt_tokens,
                usage.completion_tokens,
                usage.total_tokens,
            )

        content = response.choices[0].message.content
        if not content:
            logger.warning("LLM returned empty content")
            return {"product_name": None, "brand": None, "product_type": None}

        result = json.loads(content)

        product_name = result.get("product_name") or None
        brand = result.get("brand") or None
        product_type = result.get("product_type") or None

        valid_types = {"cleanser", "toner", "serum", "moisturizer", "exfoliant", "mask", "spot_treatment", "spf", "oil", "other"}
        if product_type and product_type not in valid_types:
            product_type = None

        logger.info("LLM extracted: product_name=%s, brand=%s, product_type=%s", product_name, brand, product_type)
        return {"product_name": product_name, "brand": brand, "product_type": product_type}

    except Exception as e:
        logger.error("LLM extraction failed: %s", e)
        return {"product_name": None, "brand": None, "product_type": None}
