from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
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
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# middleware to get user
def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        user_id = decode_token(token)
    except JWTError:
        raise credentials_exception

    user = db.get(User, user_id)

    if user is None:
        raise credentials_exception

    return user
