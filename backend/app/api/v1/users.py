import os
import aiofiles
from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.api.deps import get_current_user, CurrentUser, require_org_admin
from app.utils.security import get_password_hash
from app.config import settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_AVATAR_SIZE_MB = 5

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserResponse])
async def list_users(
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all users in the organization"""
    result = await db.execute(
        select(User)
        .where(User.organization_id == current_user.org_id)
        .order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.post("", response_model=UserResponse)
async def create_user(
    data: UserCreate,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new user in the organization"""
    # Check if email exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        organization_id=current_user.org_id,
        email=data.email,
        password_hash=get_password_hash(data.password),
        full_name=data.full_name,
        role=data.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a user by ID"""
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == current_user.org_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse.model_validate(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    data: UserUpdate,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a user"""
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == current_user.org_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent demoting the last owner
    if data.role and data.role != "owner" and user.role == "owner":
        result = await db.execute(
            select(User).where(
                User.organization_id == current_user.org_id,
                User.role == "owner",
                User.id != user_id,
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last owner",
            )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_org_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a user"""
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == current_user.org_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Prevent deleting yourself
    if current_user.user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself",
        )

    # Prevent deleting the last owner
    if user.role == "owner":
        result = await db.execute(
            select(User).where(
                User.organization_id == current_user.org_id,
                User.role == "owner",
                User.id != user_id,
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last owner",
            )

    await db.delete(user)
    await db.commit()
    return {"message": "User deleted"}


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
):
    """Upload user avatar image"""
    # Validate content type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )

    # Read file and check size
    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_AVATAR_SIZE_MB:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {MAX_AVATAR_SIZE_MB}MB",
        )

    # Get user
    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Create avatar directory
    avatar_dir = os.path.join(settings.UPLOAD_DIR, "avatars", str(current_user.org_id))
    os.makedirs(avatar_dir, exist_ok=True)

    # Generate filename with user ID and original extension
    ext = os.path.splitext(file.filename or "avatar.jpg")[1] or ".jpg"
    filename = f"{current_user.user_id}{ext}"
    filepath = os.path.join(avatar_dir, filename)

    # Delete old avatar if exists with different extension
    for old_ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
        old_path = os.path.join(avatar_dir, f"{current_user.user_id}{old_ext}")
        if old_path != filepath and os.path.exists(old_path):
            os.remove(old_path)

    # Save file
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    # Update user avatar_url
    avatar_url = f"/uploads/avatars/{current_user.org_id}/{filename}"
    user.avatar_url = avatar_url
    await db.commit()
    await db.refresh(user)

    return UserResponse.model_validate(user)


@router.delete("/me/avatar", response_model=UserResponse)
async def delete_avatar(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete user avatar"""
    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.avatar_url:
        # Delete file from disk
        filepath = os.path.join(settings.UPLOAD_DIR, user.avatar_url.lstrip("/uploads/"))
        if os.path.exists(filepath):
            os.remove(filepath)

        # Clear avatar_url
        user.avatar_url = None
        await db.commit()
        await db.refresh(user)

    return UserResponse.model_validate(user)
