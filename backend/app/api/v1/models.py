from typing import Annotated, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.model_registry import ModelRegistry
from app.schemas.ai_model import (
    AIModelCreate,
    AIModelUpdate,
    AIModelResponse,
    AIModelListResponse,
    ModelPricingCreate,
    ModelPricingResponse,
)
from app.api.deps import get_current_user, CurrentUser, require_platform_admin

router = APIRouter(prefix="/models", tags=["AI Models"])


@router.get("", response_model=List[AIModelListResponse])
async def list_models(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    category: Optional[str] = Query(None),
    active_only: bool = Query(True),
):
    """List available AI models"""
    registry = ModelRegistry(db)
    models = await registry.list_models(
        public_only=not current_user.is_platform_admin,
        active_only=active_only,
        category=category,
    )
    return [AIModelListResponse.model_validate(m) for m in models]


@router.get("/{model_id}", response_model=AIModelResponse)
async def get_model(
    model_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a specific AI model"""
    registry = ModelRegistry(db)
    model = await registry.get_model(model_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    if not model.is_public and not current_user.is_platform_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Model not accessible")
    return AIModelResponse.model_validate(model)


@router.get("/slug/{slug}", response_model=AIModelResponse)
async def get_model_by_slug(
    slug: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a model by slug"""
    registry = ModelRegistry(db)
    model = await registry.get_model_by_slug(slug)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    if not model.is_public and not current_user.is_platform_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Model not accessible")
    return AIModelResponse.model_validate(model)


@router.post("", response_model=AIModelResponse)
async def create_model(
    data: AIModelCreate,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new AI model (platform admin only)"""
    registry = ModelRegistry(db)
    model = await registry.create_model(data)
    return AIModelResponse.model_validate(model)


@router.patch("/{model_id}", response_model=AIModelResponse)
async def update_model(
    model_id: UUID,
    data: AIModelUpdate,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update an AI model (platform admin only)"""
    registry = ModelRegistry(db)
    try:
        model = await registry.update_model(model_id, data)
        if not model:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
        return AIModelResponse.model_validate(model)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{model_id}/pricing", response_model=ModelPricingResponse)
async def update_model_pricing(
    model_id: UUID,
    data: ModelPricingCreate,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update model pricing (platform admin only)"""
    registry = ModelRegistry(db)
    pricing = await registry.update_pricing(model_id, data)
    if not pricing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    return ModelPricingResponse.model_validate(pricing)


@router.delete("/{model_id}")
async def delete_model(
    model_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete an AI model (platform admin only)"""
    registry = ModelRegistry(db)
    success = await registry.delete_model(model_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    return {"message": "Model deleted"}


@router.get("/{model_id}/health")
async def check_model_health(
    model_id: UUID,
    current_user: Annotated[CurrentUser, Depends(require_platform_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Check if a model's provider is healthy (platform admin only)"""
    registry = ModelRegistry(db)
    return await registry.check_health(model_id)
