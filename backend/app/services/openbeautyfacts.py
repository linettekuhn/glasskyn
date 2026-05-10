import time
import httpx
from app.core.config import (
    OBF_API_BASE_URL,
    OBF_USER_AGENT,
    OBF_CACHE_TTL_SECONDS,
    OBF_RATE_LIMIT_RPM,
)

FIELDS = "product_name,brands,categories,image_url,quantity,ingredients_text"

_cache: dict[str, tuple[float, dict]] = {}
_rate_history: list[float] = []


class RateLimitError(Exception):
    pass


class BarcodeCache:
    @staticmethod
    def get(barcode: str) -> dict | None:
        entry = _cache.get(barcode)
        if entry is None:
            return None
        timestamp, data = entry
        if time.time() - timestamp > OBF_CACHE_TTL_SECONDS:
            del _cache[barcode]
            return None
        return data

    @staticmethod
    def set(barcode: str, data: dict) -> None:
        _cache[barcode] = (time.time(), data)


def _check_rate_limit() -> None:
    now = time.time()
    cutoff = now - 60
    _rate_history[:] = [t for t in _rate_history if t > cutoff]
    if len(_rate_history) >= OBF_RATE_LIMIT_RPM:
        raise RateLimitError(
            f"Rate limit exceeded: max {OBF_RATE_LIMIT_RPM} requests per minute"
        )
    _rate_history.append(now)


async def lookup_product(barcode: str) -> dict | None:
    cached = BarcodeCache.get(barcode)
    if cached is not None:
        return cached

    _check_rate_limit()

    url = f"{OBF_API_BASE_URL}/api/v2/product/{barcode}.json"
    headers = {"User-Agent": OBF_USER_AGENT}

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers, params={"fields": FIELDS})

    if resp.status_code != 200:
        return None

    data = resp.json()
    if data.get("status") != 1:
        return None

    product = data["product"]
    product["barcode"] = data.get("code", barcode)

    BarcodeCache.set(barcode, product)
    return product
