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
)
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

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    response.set_cookie(
        key="refreshToken",
        value=refresh_token,
        httponly=True,
        secure=False,  # TODO: set True in prod (isProduction check)
        samesite="strict",
        max_age=7 * 24 * 60 * 60,
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
        user_id = decode_token(refresh_token, expected_type="refresh")
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

    new_access_token = create_access_token(user.id)
    new_refresh_token = create_refresh_token(user.id)

    response.set_cookie(
        key="refreshToken",
        value=new_refresh_token,
        httponly=True,
        secure=False,
        samesite="strict",
        max_age=7 * 24 * 60 * 60,
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
):
    response.delete_cookie(key="refreshToken", httponly=True, samesite="strict")

    return None
