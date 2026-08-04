from typing import Optional
from pydantic import BaseModel, EmailStr


# expected body on POST /auth/register
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


# expected body on PATCH /auth/me
class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None


# expected body on POST /auth/change-password
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# expected body on POST /auth/login
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# user schema
class UserOut(BaseModel):
    id: int
    name: str
    email: str
    # read attributes of SQLAlchemy ORM object directly
    model_config = {"from_attributes": True}


# response schemas
class RegisterResponse(BaseModel):
    id: int
    name: str
    email: str
    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut
