from typing import Annotated, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.category import ModelCategory
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.api.deps import get_current_user, CurrentUser, require_platform_admin
from app.utils.security import generate_slug

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=List[CategoryResponse])
async def list_categories(
    db: Annotated[AsyncSession, Depends(get_db)],
    active_only: bool = True,
):
    """List all model categories (public endpoint)"""
    query = select(ModelCategory).order_by(ModelCategory.sort_order, ModelCategory.name)
    if active_only:
        query = query.where(ModelCategory.is_active == True)
    result = await db.execute(query)
    categories = result.scalars().all()
    return [CategoryResponse.model_validate(c) for c in categories]


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a category by ID"""
    result = await db.execute(select(ModelCategory).where(ModelCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return CategoryResponse.model_validate(category)


@router.post("", response_model=CategoryResponse)
async def create_category(
    data: CategoryCreate,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new category (admin only)"""
    # Generate slug if not properly formatted
    slug = generate_slug(data.slug)

    # Check if slug exists
    result = await db.execute(select(ModelCategory).where(ModelCategory.slug == slug))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this slug already exists",
        )

    category = ModelCategory(
        slug=slug,
        name=data.name,
        description=data.description,
        icon=data.icon,
        color=data.color,
        sort_order=data.sort_order,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return CategoryResponse.model_validate(category)


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a category (admin only)"""
    result = await db.execute(select(ModelCategory).where(ModelCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle slug update
    if "slug" in update_data:
        new_slug = generate_slug(update_data["slug"])
        # Check if slug exists (excluding current category)
        result = await db.execute(
            select(ModelCategory).where(
                ModelCategory.slug == new_slug,
                ModelCategory.id != category_id,
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category with this slug already exists",
            )
        update_data["slug"] = new_slug

    for field, value in update_data.items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)
    return CategoryResponse.model_validate(category)


@router.delete("/{category_id}")
async def delete_category(
    category_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a category (admin only)"""
    result = await db.execute(select(ModelCategory).where(ModelCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    # Check if category is in use
    from app.models.ai_model import AIModel
    models_result = await db.execute(
        select(AIModel).where(AIModel.category == category.slug).limit(1)
    )
    if models_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete category that is in use by models",
        )

    await db.delete(category)
    await db.commit()
    return {"message": "Category deleted"}
