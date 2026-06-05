from datetime import datetime, timezone, timedelta
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from app.schemas.auth import (
    RegisterResponse,
    RegisterRequest,
    LoginResponse,
    LoginRequest,
    UserOut,
    RefreshResponse,
)
from sqlalchemy.orm import Session
from app.middleware.auth import get_db
from app.models.user import User
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_refresh_token,
)
from app.core import config
from app.models.refresh_token import RefreshToken
from jose import JWTError

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(body: RegisterRequest, db: Session = Depends(get_db)):
    # check if email already exists
    existing = db.query(User).filter(User.email == body.email).first()

    # throw excpetion if email is already stored
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # create ORM object
    new_user = User(
        name=body.name, email=body.email, hashed_password=hash_password(body.password)
    )

    # add to database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    # lookup user by email
    user = db.query(User).filter(User.email == body.email).first()

    # verify user exists and password matches
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    family_id = str(uuid.uuid4())
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id, family_id)

    token_hash = hash_refresh_token(refresh_token)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=config.REFRESH_TOKEN_EXPIRE_MINUTES)
    db_refresh_token = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        family_id=family_id,
        expires_at=expires_at,
    )
    db.add(db_refresh_token)
    db.commit()

    response.set_cookie(
        key="refreshToken",
        value=refresh_token,
        httponly=True,
        secure=config.IS_PRODUCTION,
        samesite="strict",
        max_age=config.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
    )

    return LoginResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias="refreshToken"),
    db: Session = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token provided"
        )

    try:
        payload = decode_token(refresh_token, expected_type="refresh")
        user_id = int(payload["sub"])
        family_id = payload.get("family_id", "")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = db.get(User, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    token_hash = hash_refresh_token(refresh_token)
    stored_token = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.is_revoked == False,
    ).first()

    if not stored_token:
        # token hash not found → possible token reuse (theft)
        # revoke entire family if we can identify it
        if family_id:
            db.query(RefreshToken).filter(
                RefreshToken.family_id == family_id,
                RefreshToken.is_revoked == False,
            ).update({"is_revoked": True})
            db.commit()

        response.delete_cookie(key="refreshToken", httponly=True, samesite="strict")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
        )

    # revoke current token (rotation)
    stored_token.is_revoked = True

    new_access_token = create_access_token(user.id)
    new_refresh_token = create_refresh_token(user.id, stored_token.family_id)
    new_token_hash = hash_refresh_token(new_refresh_token)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=config.REFRESH_TOKEN_EXPIRE_MINUTES)

    new_stored_token = RefreshToken(
        user_id=user.id,
        token_hash=new_token_hash,
        family_id=stored_token.family_id,
        expires_at=expires_at,
    )
    db.add(new_stored_token)
    db.commit()

    response.set_cookie(
        key="refreshToken",
        value=new_refresh_token,
        httponly=True,
        secure=config.IS_PRODUCTION,
        samesite="strict",
        max_age=config.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
    )

    return RefreshResponse(
        access_token=new_access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias="refreshToken"),
    db: Session = Depends(get_db),
):
    if refresh_token:
        token_hash = hash_refresh_token(refresh_token)
        db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.is_revoked == False,
        ).update({"is_revoked": True})
        db.commit()

    response.delete_cookie(key="refreshToken", httponly=True, samesite="strict")

    return None
