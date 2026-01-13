from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.usage import UsageRecord
from app.models.subscription import Subscription
from app.models.ai_model import AIModel, ModelPricing, PricingType


class UsageTracker:
    """Service for tracking API usage"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def record_usage(
        self,
        organization_id: UUID,
        model_id: UUID,
        input_tokens: int,
        output_tokens: int,
        subscription_id: UUID = None,
    ) -> UsageRecord:
        """Record usage for billing"""
        # Calculate cost
        cost = await self._calculate_cost(model_id, input_tokens, output_tokens)

        usage = UsageRecord(
            organization_id=organization_id,
            subscription_id=subscription_id,
            model_id=model_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            request_count=1,
            cost=cost,
        )

        self.db.add(usage)
        await self.db.commit()
        await self.db.refresh(usage)

        return usage

    async def _calculate_cost(
        self, model_id: UUID, input_tokens: int, output_tokens: int
    ) -> Decimal:
        """Calculate cost based on model pricing"""
        result = await self.db.execute(
            select(ModelPricing).where(ModelPricing.model_id == model_id)
        )
        pricing = result.scalar_one_or_none()

        if not pricing:
            return Decimal("0")

        if pricing.pricing_type == PricingType.PER_REQUEST:
            return pricing.price_per_request

        # Token-based pricing
        input_cost = (Decimal(input_tokens) / 1000) * pricing.price_per_1k_input_tokens
        output_cost = (
            Decimal(output_tokens) / 1000
        ) * pricing.price_per_1k_output_tokens

        return input_cost + output_cost

    async def get_usage_summary(
        self,
        organization_id: UUID,
        period_start: datetime = None,
        period_end: datetime = None,
    ) -> dict:
        """Get usage summary for an organization"""
        if not period_start:
            period_start = datetime.utcnow().replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
        if not period_end:
            period_end = datetime.utcnow()

        # Aggregate usage
        result = await self.db.execute(
            select(
                func.sum(UsageRecord.input_tokens).label("total_input"),
                func.sum(UsageRecord.output_tokens).label("total_output"),
                func.sum(UsageRecord.request_count).label("total_requests"),
                func.sum(UsageRecord.cost).label("total_cost"),
            ).where(
                UsageRecord.organization_id == organization_id,
                UsageRecord.recorded_at >= period_start,
                UsageRecord.recorded_at <= period_end,
            )
        )
        row = result.one()

        # Get by-model breakdown
        model_result = await self.db.execute(
            select(
                UsageRecord.model_id,
                func.sum(UsageRecord.input_tokens).label("input_tokens"),
                func.sum(UsageRecord.output_tokens).label("output_tokens"),
                func.sum(UsageRecord.request_count).label("requests"),
                func.sum(UsageRecord.cost).label("cost"),
            )
            .where(
                UsageRecord.organization_id == organization_id,
                UsageRecord.recorded_at >= period_start,
                UsageRecord.recorded_at <= period_end,
            )
            .group_by(UsageRecord.model_id)
        )
        model_rows = model_result.all()

        # Get model names
        by_model = []
        for model_row in model_rows:
            model_name = "Unknown"
            if model_row.model_id:
                model_result = await self.db.execute(
                    select(AIModel).where(AIModel.id == model_row.model_id)
                )
                model = model_result.scalar_one_or_none()
                if model:
                    model_name = model.name

            by_model.append(
                {
                    "model_id": str(model_row.model_id) if model_row.model_id else None,
                    "model_name": model_name,
                    "input_tokens": model_row.input_tokens or 0,
                    "output_tokens": model_row.output_tokens or 0,
                    "requests": model_row.requests or 0,
                    "cost": float(model_row.cost or 0),
                }
            )

        return {
            "period_start": period_start,
            "period_end": period_end,
            "total_input_tokens": row.total_input or 0,
            "total_output_tokens": row.total_output or 0,
            "total_requests": row.total_requests or 0,
            "total_cost": float(row.total_cost or 0),
            "by_model": by_model,
        }

    async def get_subscription_usage(
        self, subscription_id: UUID
    ) -> dict:
        """Get usage for a specific subscription in current period"""
        result = await self.db.execute(
            select(Subscription)
            .where(Subscription.id == subscription_id)
            .options(selectinload(Subscription.model))
        )
        subscription = result.scalar_one_or_none()

        if not subscription:
            return None

        period_start = subscription.current_period_start or datetime.utcnow().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )

        result = await self.db.execute(
            select(
                func.sum(UsageRecord.input_tokens + UsageRecord.output_tokens).label(
                    "total_tokens"
                ),
                func.sum(UsageRecord.request_count).label("total_requests"),
                func.sum(UsageRecord.cost).label("total_cost"),
            ).where(
                UsageRecord.subscription_id == subscription_id,
                UsageRecord.recorded_at >= period_start,
            )
        )
        row = result.one()

        return {
            "subscription_id": str(subscription_id),
            "model_name": subscription.model.name if subscription.model else "Unknown",
            "period_start": period_start,
            "total_tokens": row.total_tokens or 0,
            "total_requests": row.total_requests or 0,
            "total_cost": float(row.total_cost or 0),
        }

    async def check_usage_limits(
        self, subscription_id: UUID
    ) -> dict:
        """Check if subscription is within usage limits"""
        result = await self.db.execute(
            select(Subscription)
            .where(Subscription.id == subscription_id)
            .options(selectinload(Subscription.model))
        )
        subscription = result.scalar_one_or_none()

        if not subscription or not subscription.model:
            return {"allowed": False, "reason": "Subscription not found"}

        # Get pricing
        result = await self.db.execute(
            select(ModelPricing).where(ModelPricing.model_id == subscription.model_id)
        )
        pricing = result.scalar_one_or_none()

        if not pricing:
            return {"allowed": True}  # No pricing = no limits

        # Get current usage
        usage = await self.get_subscription_usage(subscription_id)

        # Check limits for subscription pricing
        if pricing.pricing_type == PricingType.SUBSCRIPTION:
            if pricing.included_tokens > 0:
                if usage["total_tokens"] >= pricing.included_tokens:
                    return {
                        "allowed": False,
                        "reason": "Token limit reached",
                        "limit": pricing.included_tokens,
                        "used": usage["total_tokens"],
                    }

            if pricing.included_requests > 0:
                if usage["total_requests"] >= pricing.included_requests:
                    return {
                        "allowed": False,
                        "reason": "Request limit reached",
                        "limit": pricing.included_requests,
                        "used": usage["total_requests"],
                    }

        return {"allowed": True}
