from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.db.session import SessionLocal
from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import decode_token
from jose import JWTError


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# checks for bearer token on request and extracts token or returns 401 if missing
http_bearer = HTTPBearer()


# middleware to get user
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(credentials.credentials, expected_type="access")
        user_id = int(payload["sub"])
    except JWTError:
        raise credentials_exception

    user = db.get(User, user_id)

    if user is None:
        raise credentials_exception

    return user
