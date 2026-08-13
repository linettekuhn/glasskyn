from datetime import datetime, timezone, timedelta
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie, Header
from app.schemas.auth import (
    RegisterResponse,
    RegisterRequest,
    LoginResponse,
    LoginRequest,
    UserOut,
    RefreshResponse,
    UserUpdate,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from sqlalchemy.orm import Session
from app.middleware.auth import get_db, get_current_user
from app.models.user import User
from app.models.alert import Alert
from app.models.chat import ChatMessage, ChatSession
from app.models.device_token import DeviceToken
from app.models.product import Product
from app.models.routine import SkinProfile, Routine, RoutineStep
from app.models.routine_step_completion import RoutineStepCompletion
from app.models.scan import ScanResult
from app.models.user_preference import UserPreference
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_refresh_token,
    generate_reset_code,
    hash_reset_code,
)
from app.core import config
from app.models.refresh_token import RefreshToken
from app.models.password_reset_token import PasswordResetToken
from app.services.email import send_password_reset_code
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

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/forgot-password", status_code=202)
async def forgot_password(
    body: ForgotPasswordRequest, db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == body.email).first()

    # always return 202 regardless of whether the email exists (no enumeration)
    if not user:
        return None

    # invalidate any prior unused codes for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.is_used == False,
    ).update({"is_used": True})
    db.commit()

    code = generate_reset_code()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=config.PASSWORD_RESET_CODE_EXPIRE_MINUTES
    )
    db_token = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_code(code),
        expires_at=expires_at,
    )
    db.add(db_token)
    db.commit()

    send_password_reset_code(user.email, code)

    return None


@router.post("/reset-password", status_code=204)
async def reset_password(
    body: ResetPasswordRequest, db: Session = Depends(get_db)
):
    code_hash = hash_reset_code(body.code.strip())
    db_token = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == code_hash,
            PasswordResetToken.is_used == False,
        )
        .first()
    )

    if not db_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset code"
        )

    if db_token.expires_at < datetime.now(timezone.utc):
        db_token.is_used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset code has expired",
        )

    user = db.get(User, db_token.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User not found"
        )

    user.hashed_password = hash_password(body.new_password)
    db_token.is_used = True
    # revoke all refresh tokens so other sessions are signed out
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.is_revoked == False,
    ).update({"is_revoked": True})
    db.commit()
    return None


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias="refreshToken"),
    x_refresh_token: str | None = Header(default=None, alias="x-refresh-token"),
    db: Session = Depends(get_db),
):
    token = refresh_token or x_refresh_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token provided"
        )

    try:
        payload = decode_token(token, expected_type="refresh")
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

    token_hash = hash_refresh_token(token)
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
        refresh_token=new_refresh_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias="refreshToken"),
    x_refresh_token: str | None = Header(default=None, alias="x-refresh-token"),
    db: Session = Depends(get_db),
):
    token = refresh_token or x_refresh_token
    if token:
        token_hash = hash_refresh_token(token)
        db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.is_revoked == False,
        ).update({"is_revoked": True})
        db.commit()

    response.delete_cookie(key="refreshToken", httponly=True, samesite="strict")

    return None


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updates = body.model_dump(exclude_unset=True)

    new_email = updates.get("email")
    if new_email and new_email != current_user.email:
        existing = db.query(User).filter(User.email == new_email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

    for field, value in updates.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password", status_code=204)
async def change_password(
    body: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.hashed_password = hash_password(body.new_password)
    # revoke all refresh tokens so other sessions are signed out
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.is_revoked == False,
    ).update({"is_revoked": True})
    db.commit()
    return None


@router.delete("/me", status_code=204)
async def delete_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_id = current_user.id

    routine_ids = [
        row[0]
        for row in db.query(Routine.id).filter(Routine.user_id == user_id).all()
    ]

    if routine_ids:
        db.query(RoutineStepCompletion).filter(
            RoutineStepCompletion.routine_id.in_(routine_ids)
        ).delete(synchronize_session=False)
        db.query(RoutineStep).filter(
            RoutineStep.routine_id.in_(routine_ids)
        ).delete(synchronize_session=False)
    db.query(RoutineStepCompletion).filter(
        RoutineStepCompletion.user_id == user_id
    ).delete(synchronize_session=False)
    db.query(Routine).filter(Routine.user_id == user_id).delete(
        synchronize_session=False
    )

    db.query(ScanResult).filter(ScanResult.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(Alert).filter(Alert.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(ChatMessage).filter(ChatMessage.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(ChatSession).filter(ChatSession.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(SkinProfile).filter(SkinProfile.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(UserPreference).filter(UserPreference.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(DeviceToken).filter(DeviceToken.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(Product).filter(Product.user_id == user_id).delete(
        synchronize_session=False
    )

    db.delete(current_user)
    db.commit()
    return None
