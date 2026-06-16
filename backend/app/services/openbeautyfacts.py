import time
import base64
import httpx
from app.core.config import (
    OBF_API_BASE_URL,
    OBF_USER_AGENT,
    OBF_CACHE_TTL_SECONDS,
    OBF_RATE_LIMIT_RPM,
    OBF_AUTH_USERNAME,
    OBF_AUTH_PASSWORD,
)

FIELDS = "product_name,brands,categories,categories_hierarchy,image_url,quantity,ingredients_text"

EXCLUDED_CATEGORIES = {
    "open-beauty-facts",
    "non-food-products",
    "incorrect-product-type",
    "unknown",
    "missing-category",
    "all-products",
    "categories-known",
}


def _parse_categories(product: dict) -> str:
    hierarchy = product.get("categories_hierarchy") or []
    meaningful = [
        c for c in hierarchy if c.split(":", 1)[-1] not in EXCLUDED_CATEGORIES
    ]
    if not meaningful:
        return ""
    leaf = meaningful[-1]
    name = leaf.split(":", 1)[-1] if ":" in leaf else leaf
    return name.replace("-", " ").title()


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

    if OBF_AUTH_USERNAME and OBF_AUTH_PASSWORD:
        credentials = f"{OBF_AUTH_USERNAME}:{OBF_AUTH_PASSWORD}"
        encoded = base64.b64encode(credentials.encode()).decode()
        headers["Authorization"] = f"Basic {encoded}"

    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        resp = await client.get(
            url,
            headers=headers,
            params={"fields": FIELDS, "product_type": "all"},
        )

    if resp.status_code != 200:
        return None

    data = resp.json()
    if data.get("status") != 1:
        return None

    product = data["product"]
    product["barcode"] = data.get("code", barcode)
    product["categories"] = _parse_categories(product)

    BarcodeCache.set(barcode, product)
    return product
