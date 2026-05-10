import os
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET: str = os.environ.get("JWT_SECRET", "fallback")
JWT_ALGORITHM: str = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

REFRESH_TOKEN_EXPIRE_MINUTES: int = 7 * 24 * 60

OBF_API_BASE_URL: str = os.environ.get(
    "OBF_API_BASE_URL", "https://world.openbeautyfacts.org"
)
OBF_USER_AGENT: str = os.environ.get(
    "OBF_USER_AGENT", "CosmeticExpiryScanner/1.0 (your@email.com)"
)
OBF_CACHE_TTL_SECONDS: int = int(os.environ.get("OBF_CACHE_TTL_SECONDS", "3600"))
OBF_RATE_LIMIT_RPM: int = int(os.environ.get("OBF_RATE_LIMIT_RPM", "10"))
