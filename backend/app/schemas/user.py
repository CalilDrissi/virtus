from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.MEMBER


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: UUID
    organization_id: UUID
    role: UserRole
    is_platform_admin: bool
    is_active: bool
    last_login_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class APIKeyBase(BaseModel):
    name: str
    scopes: List[str] = ["read", "write"]


class APIKeyCreate(APIKeyBase):
    expires_in_days: Optional[int] = None  # None = never expires
    subscription_id: Optional[UUID] = None  # Associate with specific subscription


class APIKeyResponse(APIKeyBase):
    id: UUID
    organization_id: UUID
    subscription_id: Optional[UUID] = None
    key_prefix: str
    is_active: bool
    last_used_at: Optional[datetime]
    expires_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class APIKeyWithSecret(APIKeyResponse):
    key: str  # Full key, only shown on creation
