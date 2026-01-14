from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.subscription import SubscriptionStatus
from app.schemas.ai_model import AIModelListResponse, DataSourceInfo


class SubscriptionBase(BaseModel):
    model_id: UUID


class SubscriptionCreate(SubscriptionBase):
    pass


class SubscriptionResponse(SubscriptionBase):
    id: UUID
    organization_id: UUID
    status: SubscriptionStatus
    stripe_subscription_id: Optional[str]
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    cancelled_at: Optional[datetime]
    created_at: datetime
    model: Optional[AIModelListResponse] = None
    data_sources: List[DataSourceInfo] = []

    class Config:
        from_attributes = True


class SubscriptionWithUsage(SubscriptionResponse):
    usage_this_period: int  # tokens or requests depending on pricing type
    cost_this_period: float


class SubscriptionDataSourcesUpdate(BaseModel):
    """Request body for updating subscription data sources"""
    data_source_ids: List[UUID]
