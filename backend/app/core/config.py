import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Resolve the backend root directory (two levels up from this file)
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

ENVIRONMENT: str = os.environ.get("ENVIRONMENT", "development")
IS_PRODUCTION: bool = ENVIRONMENT == "production"

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
OBF_AUTH_USERNAME: str = os.environ.get("OBF_AUTH_USERNAME", "")
OBF_AUTH_PASSWORD: str = os.environ.get("OBF_AUTH_PASSWORD", "")

GOOGLE_APPLICATION_CREDENTIALS: str = os.environ.get(
    "GOOGLE_APPLICATION_CREDENTIALS",
    str(BACKEND_DIR / "credentials" / "shelf-love-353bbeca17ab.json"),
)

AWS_ACCESS_KEY_ID: str = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY: str = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION: str = os.environ.get("AWS_REGION", "us-east-1")
S3_BUCKET_NAME: str = os.environ.get("S3_BUCKET_NAME", "")

OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL: str = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
AGENT_MODEL: str = os.environ.get("AGENT_MODEL", "gpt-4o-mini")

CHAT_HISTORY_WINDOW: int = int(os.environ.get("CHAT_HISTORY_WINDOW", "20"))
CHAT_SUMMARY_INTERVAL: int = int(os.environ.get("CHAT_SUMMARY_INTERVAL", "5"))

CHROMADB_PATH: str = str(BACKEND_DIR / "data" / "chromadb")
EMBEDDING_MODEL: str = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")

EXPIRY_ALERT_WINDOW_DAYS: int = int(os.environ.get("EXPIRY_ALERT_WINDOW_DAYS", "30"))
EXPIRY_CHECK_HOUR: int = int(os.environ.get("EXPIRY_CHECK_HOUR", "9"))
EXPIRY_CHECK_MINUTE: int = int(os.environ.get("EXPIRY_CHECK_MINUTE", "0"))
REMINDER_AM_TIME: str = os.environ.get("REMINDER_AM_TIME", "08:00")
REMINDER_PM_TIME: str = os.environ.get("REMINDER_PM_TIME", "20:00")
WATER_REMINDER_TIME: str = os.environ.get("WATER_REMINDER_TIME", "12:00")
