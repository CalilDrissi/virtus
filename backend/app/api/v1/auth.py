from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.auth import AuthService
from app.schemas.auth import Token, LoginRequest, RefreshTokenRequest, RegisterRequest
from app.schemas.user import UserResponse, APIKeyCreate, APIKeyWithSecret, APIKeyResponse
from app.api.deps import get_current_user, CurrentUser, require_org_admin

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=dict)
async def register(
    data: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Register a new user and organization"""
    auth_service = AuthService(db)
    try:
        user, org, tokens = await auth_service.register(data)
        return {
            "user": UserResponse.model_validate(user),
            "organization": {
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
            },
            "tokens": tokens,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login", response_model=Token)
async def login(
    data: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Login with email and password"""
    auth_service = AuthService(db)
    user = await auth_service.authenticate_user(data.email, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return await auth_service.create_tokens(user)


@router.post("/refresh", response_model=Token)
async def refresh_token(
    data: RefreshTokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Refresh access token"""
    auth_service = AuthService(db)
    tokens = await auth_service.refresh_tokens(data.refresh_token)
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    return tokens


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Get current user information"""
    if current_user.is_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint requires user authentication, not API key",
        )
    return UserResponse.model_validate(current_user.user)


# API Keys
@router.post("/api-keys", response_model=APIKeyWithSecret)
async def create_api_key(
    data: APIKeyCreate,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new API key for the organization"""
    auth_service = AuthService(db)
    return await auth_service.create_api_key(current_user.org_id, data)


@router.get("/api-keys", response_model=list[APIKeyResponse])
async def list_api_keys(
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all API keys for the organization"""
    auth_service = AuthService(db)
    keys = await auth_service.list_api_keys(current_user.org_id)
    return [APIKeyResponse.model_validate(k) for k in keys]


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Revoke an API key"""
    from uuid import UUID
    auth_service = AuthService(db)
    success = await auth_service.revoke_api_key(UUID(key_id), current_user.org_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    return {"message": "API key revoked"}
