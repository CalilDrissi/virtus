from datetime import datetime, timedelta
from typing import Optional, Tuple
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, APIKey
from app.models.organization import Organization
from app.schemas.auth import Token, RegisterRequest
from app.schemas.user import UserCreate, APIKeyCreate, APIKeyWithSecret
from app.utils.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_api_key,
    verify_api_key,
    generate_slug,
)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate user by email and password"""
        result = await self.db.execute(
            select(User).where(User.email == email, User.is_active == True)
        )
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.password_hash):
            return None

        # Update last login
        user.last_login_at = datetime.utcnow()
        await self.db.commit()

        return user

    async def create_tokens(self, user: User) -> Token:
        """Create access and refresh tokens for a user"""
        token_data = {
            "sub": str(user.id),
            "org_id": str(user.organization_id),
            "is_platform_admin": user.is_platform_admin,
        }

        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return Token(access_token=access_token, refresh_token=refresh_token)

    async def refresh_tokens(self, refresh_token: str) -> Optional[Token]:
        """Refresh access token using refresh token"""
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            return None

        user_id = payload.get("sub")
        if not user_id:
            return None

        result = await self.db.execute(
            select(User).where(User.id == UUID(user_id), User.is_active == True)
        )
        user = result.scalar_one_or_none()

        if not user:
            return None

        return await self.create_tokens(user)

    async def register(self, data: RegisterRequest) -> Tuple[User, Organization, Token]:
        """Register a new user and organization"""
        # Check if email exists
        result = await self.db.execute(select(User).where(User.email == data.email))
        if result.scalar_one_or_none():
            raise ValueError("Email already registered")

        # Create organization
        slug = generate_slug(data.organization_name)
        # Ensure unique slug
        result = await self.db.execute(select(Organization).where(Organization.slug == slug))
        if result.scalar_one_or_none():
            slug = f"{slug}-{datetime.utcnow().timestamp():.0f}"

        org = Organization(
            name=data.organization_name,
            slug=slug,
        )
        self.db.add(org)
        await self.db.flush()

        # Create user as owner
        user = User(
            organization_id=org.id,
            email=data.email,
            password_hash=get_password_hash(data.password),
            full_name=data.full_name,
            role="owner",
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        await self.db.refresh(org)

        tokens = await self.create_tokens(user)
        return user, org, tokens

    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """Get user by ID"""
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def create_api_key(
        self, organization_id: UUID, data: APIKeyCreate, subscription_id: Optional[UUID] = None
    ) -> APIKeyWithSecret:
        """Create a new API key for an organization, optionally scoped to a subscription"""
        key, key_hash, key_prefix = generate_api_key()

        expires_at = None
        if data.expires_in_days:
            expires_at = datetime.utcnow() + timedelta(days=data.expires_in_days)

        # Use subscription_id from data if provided, otherwise use parameter
        final_subscription_id = data.subscription_id or subscription_id

        api_key = APIKey(
            organization_id=organization_id,
            subscription_id=final_subscription_id,
            key_hash=key_hash,
            key_prefix=key_prefix,
            name=data.name,
            scopes=data.scopes,
            expires_at=expires_at,
        )
        self.db.add(api_key)
        await self.db.commit()
        await self.db.refresh(api_key)

        return APIKeyWithSecret(
            id=api_key.id,
            organization_id=api_key.organization_id,
            subscription_id=api_key.subscription_id,
            key_prefix=api_key.key_prefix,
            name=api_key.name,
            scopes=api_key.scopes,
            is_active=api_key.is_active,
            last_used_at=api_key.last_used_at,
            expires_at=api_key.expires_at,
            created_at=api_key.created_at,
            key=key,  # Only returned on creation
        )

    async def validate_api_key(self, key: str) -> Optional[Tuple[APIKey, Organization]]:
        """Validate an API key and return the key and organization"""
        if not key.startswith("vrt_"):
            return None

        # Get all potentially matching keys by prefix
        key_prefix = key[:12]
        result = await self.db.execute(
            select(APIKey)
            .where(APIKey.key_prefix == key_prefix, APIKey.is_active == True)
        )
        api_keys = result.scalars().all()

        for api_key in api_keys:
            if verify_api_key(key, api_key.key_hash):
                # Check expiration
                if api_key.expires_at and api_key.expires_at < datetime.utcnow():
                    return None

                # Update last used
                api_key.last_used_at = datetime.utcnow()
                await self.db.commit()

                # Get organization
                result = await self.db.execute(
                    select(Organization).where(Organization.id == api_key.organization_id)
                )
                org = result.scalar_one_or_none()
                if org:
                    return api_key, org

        return None

    async def list_api_keys(
        self, organization_id: UUID, subscription_id: Optional[UUID] = None
    ) -> list[APIKey]:
        """List API keys for an organization, optionally filtered by subscription"""
        query = select(APIKey).where(APIKey.organization_id == organization_id)

        if subscription_id is not None:
            query = query.where(APIKey.subscription_id == subscription_id)

        query = query.order_by(APIKey.created_at.desc())
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def revoke_api_key(self, key_id: UUID, organization_id: UUID) -> bool:
        """Revoke an API key"""
        result = await self.db.execute(
            select(APIKey).where(
                APIKey.id == key_id,
                APIKey.organization_id == organization_id,
            )
        )
        api_key = result.scalar_one_or_none()
        if not api_key:
            return False

        api_key.is_active = False
        await self.db.commit()
        return True
