from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from app.models.ai_model import AIProvider, PricingType


class ModelPricingBase(BaseModel):
    pricing_type: PricingType
    price_per_1k_input_tokens: Decimal = Decimal("0")
    price_per_1k_output_tokens: Decimal = Decimal("0")
    price_per_request: Decimal = Decimal("0")
    monthly_subscription_price: Decimal = Decimal("0")
    included_requests: int = 0
    included_tokens: int = 0


class ModelPricingCreate(ModelPricingBase):
    pass


class ModelPricingUpdate(BaseModel):
    pricing_type: Optional[PricingType] = None
    price_per_1k_input_tokens: Optional[Decimal] = None
    price_per_1k_output_tokens: Optional[Decimal] = None
    price_per_request: Optional[Decimal] = None
    monthly_subscription_price: Optional[Decimal] = None
    included_requests: Optional[int] = None
    included_tokens: Optional[int] = None


class ModelPricingResponse(ModelPricingBase):
    id: UUID
    model_id: UUID
    stripe_product_id: Optional[str]
    stripe_price_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AIModelBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "general"
    provider: AIProvider
    provider_model_id: str
    system_prompt: Optional[str] = None
    max_tokens: int = 4096
    temperature: Decimal = Decimal("0.7")


class AIModelCreate(AIModelBase):
    slug: Optional[str] = None
    provider_config: Dict[str, Any] = {}
    is_public: bool = True
    pricing: Optional[ModelPricingCreate] = None


class AIModelUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    provider: Optional[AIProvider] = None
    provider_model_id: Optional[str] = None
    provider_config: Optional[Dict[str, Any]] = None
    system_prompt: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[Decimal] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None
    icon_url: Optional[str] = None


class DataSourceInfo(BaseModel):
    """Minimal data source info for model responses"""
    id: UUID
    name: str
    type: str

    class Config:
        from_attributes = True


class AIModelResponse(AIModelBase):
    id: UUID
    slug: str
    provider_config: Dict[str, Any] = {}
    is_public: bool
    is_active: bool
    icon_url: Optional[str]
    created_at: datetime
    updated_at: datetime
    pricing: Optional[ModelPricingResponse] = None
    data_sources: List[DataSourceInfo] = []

    class Config:
        from_attributes = True


class AIModelListResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str]
    category: str
    provider: AIProvider
    provider_model_id: str
    provider_config: Dict[str, Any] = {}
    icon_url: Optional[str]
    is_public: bool
    is_active: bool
    pricing: Optional[ModelPricingResponse] = None
    data_sources: List[DataSourceInfo] = []

    class Config:
        from_attributes = True


class ModelDataSourcesUpdate(BaseModel):
    """Request body for updating model data sources"""
    data_source_ids: List[UUID]
