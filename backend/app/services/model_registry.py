from typing import Optional, List
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.ai_model import AIModel, ModelPricing, AIProvider
from app.schemas.ai_model import AIModelCreate, AIModelUpdate, ModelPricingCreate, ModelPricingUpdate
from app.providers.base import BaseAIProvider
from app.providers import OpenAIProvider, AnthropicProvider, OllamaProvider, VLLMProvider
from app.utils.security import generate_slug


class ModelRegistry:
    """Service for managing AI models"""

    def __init__(self, db: AsyncSession):
        self.db = db

    def get_provider(self, model: AIModel) -> BaseAIProvider:
        """Get the appropriate provider for a model"""
        config = model.provider_config or {}

        if model.provider == AIProvider.OPENAI:
            return OpenAIProvider(config)
        elif model.provider == AIProvider.ANTHROPIC:
            return AnthropicProvider(config)
        elif model.provider == AIProvider.OLLAMA:
            return OllamaProvider(config)
        elif model.provider == AIProvider.VLLM:
            return VLLMProvider(config)
        elif model.provider == AIProvider.CUSTOM:
            # Custom providers use OpenAI-compatible API format
            # Requires base_url in provider_config
            return OpenAIProvider(config)
        else:
            raise ValueError(f"Unknown provider: {model.provider}")

    async def create_model(self, data: AIModelCreate) -> AIModel:
        """Create a new AI model"""
        # Generate slug if not provided
        slug = data.slug or generate_slug(data.name)

        # Ensure unique slug
        result = await self.db.execute(select(AIModel).where(AIModel.slug == slug))
        if result.scalar_one_or_none():
            import uuid
            slug = f"{slug}-{uuid.uuid4().hex[:8]}"

        model = AIModel(
            name=data.name,
            slug=slug,
            description=data.description,
            category=data.category,
            provider=data.provider,
            provider_model_id=data.provider_model_id,
            provider_config=data.provider_config,
            system_prompt=data.system_prompt,
            max_tokens=data.max_tokens,
            temperature=data.temperature,
            is_public=data.is_public,
        )
        self.db.add(model)
        await self.db.flush()

        # Create pricing if provided
        if data.pricing:
            pricing = ModelPricing(
                model_id=model.id,
                pricing_type=data.pricing.pricing_type,
                price_per_1k_input_tokens=data.pricing.price_per_1k_input_tokens,
                price_per_1k_output_tokens=data.pricing.price_per_1k_output_tokens,
                price_per_request=data.pricing.price_per_request,
                monthly_subscription_price=data.pricing.monthly_subscription_price,
                included_requests=data.pricing.included_requests,
                included_tokens=data.pricing.included_tokens,
            )
            self.db.add(pricing)

        await self.db.commit()
        # Re-fetch with pricing relationship loaded
        return await self.get_model(model.id)

    async def update_model(self, model_id: UUID, data: AIModelUpdate) -> Optional[AIModel]:
        """Update an AI model"""
        result = await self.db.execute(
            select(AIModel).where(AIModel.id == model_id).options(selectinload(AIModel.pricing))
        )
        model = result.scalar_one_or_none()
        if not model:
            return None

        update_data = data.model_dump(exclude_unset=True)

        # Handle slug update
        if "slug" in update_data:
            new_slug = generate_slug(update_data["slug"])
            result = await self.db.execute(
                select(AIModel).where(AIModel.slug == new_slug, AIModel.id != model_id)
            )
            if result.scalar_one_or_none():
                raise ValueError("Slug already taken")
            update_data["slug"] = new_slug

        for field, value in update_data.items():
            setattr(model, field, value)

        await self.db.commit()
        await self.db.refresh(model)
        return model

    async def update_pricing(
        self, model_id: UUID, data: ModelPricingCreate
    ) -> Optional[ModelPricing]:
        """Update or create pricing for a model"""
        result = await self.db.execute(
            select(ModelPricing).where(ModelPricing.model_id == model_id)
        )
        pricing = result.scalar_one_or_none()

        if pricing:
            for field, value in data.model_dump().items():
                setattr(pricing, field, value)
        else:
            pricing = ModelPricing(model_id=model_id, **data.model_dump())
            self.db.add(pricing)

        await self.db.commit()
        await self.db.refresh(pricing)
        return pricing

    async def get_model(self, model_id: UUID) -> Optional[AIModel]:
        """Get a model by ID"""
        result = await self.db.execute(
            select(AIModel)
            .where(AIModel.id == model_id)
            .options(selectinload(AIModel.pricing), selectinload(AIModel.data_sources))
        )
        return result.scalar_one_or_none()

    async def get_model_by_slug(self, slug: str) -> Optional[AIModel]:
        """Get a model by slug"""
        result = await self.db.execute(
            select(AIModel)
            .where(AIModel.slug == slug)
            .options(selectinload(AIModel.pricing), selectinload(AIModel.data_sources))
        )
        return result.scalar_one_or_none()

    async def list_models(
        self,
        public_only: bool = False,
        active_only: bool = True,
        category: str = None,
    ) -> List[AIModel]:
        """List models with filters"""
        query = select(AIModel).options(selectinload(AIModel.pricing), selectinload(AIModel.data_sources))

        if public_only:
            query = query.where(AIModel.is_public == True)
        if active_only:
            query = query.where(AIModel.is_active == True)
        if category:
            query = query.where(AIModel.category == category)

        query = query.order_by(AIModel.name)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def delete_model(self, model_id: UUID) -> bool:
        """Delete a model"""
        result = await self.db.execute(select(AIModel).where(AIModel.id == model_id))
        model = result.scalar_one_or_none()
        if not model:
            return False

        await self.db.delete(model)
        await self.db.commit()
        return True

    async def check_health(self, model_id: UUID) -> dict:
        """Check if a model's provider is healthy"""
        model = await self.get_model(model_id)
        if not model:
            return {"healthy": False, "error": "Model not found"}

        try:
            provider = self.get_provider(model)
            is_healthy = await provider.health_check()
            return {"healthy": is_healthy}
        except Exception as e:
            return {"healthy": False, "error": str(e)}
