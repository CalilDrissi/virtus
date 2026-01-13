from typing import Optional, Annotated
from uuid import UUID
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.services.auth import AuthService
from app.utils.security import decode_token

security = HTTPBearer(auto_error=False)


class CurrentUser:
    """Holds current user and organization context"""
    def __init__(
        self,
        user: Optional[User] = None,
        organization: Optional[Organization] = None,
        is_api_key: bool = False,
        scopes: list[str] = None,
    ):
        self.user = user
        self.organization = organization
        self.is_api_key = is_api_key
        self.scopes = scopes or []

    @property
    def org_id(self) -> UUID:
        return self.organization.id if self.organization else None

    @property
    def user_id(self) -> Optional[UUID]:
        return self.user.id if self.user else None

    @property
    def is_platform_admin(self) -> bool:
        return self.user.is_platform_admin if self.user else False


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)] = None,
    x_api_key: Annotated[Optional[str], Header(alias="X-API-Key")] = None,
) -> CurrentUser:
    """Get current user from JWT token or API key"""

    # Try API key first
    if x_api_key:
        auth_service = AuthService(db)
        result = await auth_service.validate_api_key(x_api_key)
        if result:
            api_key, org = result
            return CurrentUser(
                organization=org,
                is_api_key=True,
                scopes=api_key.scopes,
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    # Try JWT token
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Get user
    result = await db.execute(
        select(User).where(User.id == UUID(user_id), User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Get organization
    result = await db.execute(
        select(Organization).where(Organization.id == user.organization_id)
    )
    org = result.scalar_one_or_none()

    return CurrentUser(user=user, organization=org)


async def get_optional_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)] = None,
    x_api_key: Annotated[Optional[str], Header(alias="X-API-Key")] = None,
) -> Optional[CurrentUser]:
    """Get current user if authenticated, None otherwise"""
    try:
        return await get_current_user(db, credentials, x_api_key)
    except HTTPException:
        return None


def require_platform_admin(current_user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
    """Require platform admin access"""
    if not current_user.is_platform_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin access required",
        )
    return current_user


def require_org_admin(current_user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
    """Require organization admin or owner access"""
    if current_user.is_api_key:
        if "admin" not in current_user.scopes and "write" not in current_user.scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin scope required",
            )
    elif current_user.user and current_user.user.role not in ["owner", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_scope(scope: str):
    """Factory for scope requirement dependency"""
    def check_scope(current_user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if current_user.is_api_key and scope not in current_user.scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Scope '{scope}' required",
            )
        return current_user
    return check_scope
