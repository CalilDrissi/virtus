from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.api.deps import get_current_user, CurrentUser, require_org_admin
from app.utils.security import get_password_hash

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
