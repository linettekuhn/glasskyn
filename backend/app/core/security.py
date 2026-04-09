from datetime import timedelta, datetime, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
from app.core import config
from typing import Optional

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# takes plain string, retuyrns a bcrypt hash string
def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


# compares hash and plain passwords, returns true if they match
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_token(data: dict, expires_delta: timedelta) -> str:
    # copy payload
    payload = data.copy()

    # add expiry key
    expire = datetime.now(timezone.utc) + expires_delta
    payload.update({"exp": expire})

    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def create_access_token(user_id: int) -> str:
    return create_token(
        data={"sub": str(user_id)},
        expires_delta=timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: int) -> str:
    return create_token(
        data={"sub": str(user_id), "type": "refresh"},
        expires_delta=timedelta(minutes=config.REFRESH_TOKEN_EXPIRE_MINUTES),
    )


# returns the user_id if the token is valid, raises JWTError otherwise
def decode_token(token: str) -> Optional[int]:
    payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])

    user_id: Optional[int] = payload.get("sub")
    if user_id is None:
        raise JWTError("No subject in token")

    return int(user_id)
