import os
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET: str = os.environ.get("JWT_SECRET", "fallback")
JWT_ALGORITHM: str = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

REFRESH_TOKEN_EXPIRE_MINUTES: int = 7 * 24 * 60
