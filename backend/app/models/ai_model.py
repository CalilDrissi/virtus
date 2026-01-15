import uuid
from datetime import datetime
from enum import Enum as PyEnum
from decimal import Decimal
from sqlalchemy import Column, String, DateTime, Enum, Boolean, Text, ForeignKey, Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base




class AIProvider(str, PyEnum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    OLLAMA = "ollama"
    VLLM = "vllm"
    CUSTOM = "custom"  # OpenAI-compatible API with custom base_url


# Legacy enum - kept for backwards compatibility during migration
# New code should use the model_categories table
class ModelCategoryEnum(str, PyEnum):
    LEGAL = "legal"
    HEALTHCARE = "healthcare"
    ECOMMERCE = "ecommerce"
    CUSTOMER_SUPPORT = "customer_support"
    FINANCE = "finance"
    EDUCATION = "education"
    GENERAL = "general"


class PricingType(str, PyEnum):
    PER_TOKEN = "per_token"
    PER_REQUEST = "per_request"
    SUBSCRIPTION = "subscription"
    HYBRID = "hybrid"


class AIModel(Base):
    __tablename__ = "ai_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(50), default="general", nullable=False)
    provider = Column(Enum(AIProvider), nullable=False)
    provider_model_id = Column(String(255), nullable=False)  # e.g., "gpt-4", "claude-3-opus"
    provider_config = Column(JSONB, default=dict, nullable=False)  # API keys, endpoints, etc.
    system_prompt = Column(Text, nullable=True)
    max_tokens = Column(Integer, default=4096, nullable=False)
    temperature = Column(Numeric(3, 2), default=Decimal("0.7"), nullable=False)
    is_public = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    icon_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    pricing = relationship("ModelPricing", back_populates="model", uselist=False, cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="model", passive_deletes=True)
    conversations = relationship("Conversation", back_populates="model", passive_deletes=True)
    usage_records = relationship("UsageRecord", back_populates="model", passive_deletes=True)
    widget_configs = relationship("WidgetConfig", back_populates="model", passive_deletes=True)
    data_sources = relationship("DataSource", back_populates="model", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<AIModel {self.name}>"


class ModelPricing(Base):
    __tablename__ = "model_pricing"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ai_models.id", ondelete="CASCADE"), unique=True, nullable=False)
    pricing_type = Column(Enum(PricingType), nullable=False)

    # Per-token pricing (in USD)
    price_per_1k_input_tokens = Column(Numeric(10, 6), default=Decimal("0"), nullable=False)
    price_per_1k_output_tokens = Column(Numeric(10, 6), default=Decimal("0"), nullable=False)

    # Per-request pricing
    price_per_request = Column(Numeric(10, 6), default=Decimal("0"), nullable=False)

    # Subscription pricing
    monthly_subscription_price = Column(Numeric(10, 2), default=Decimal("0"), nullable=False)
    included_requests = Column(Integer, default=0, nullable=False)
    included_tokens = Column(Integer, default=0, nullable=False)

    # Stripe product/price IDs
    stripe_product_id = Column(String(255), nullable=True)
    stripe_price_id = Column(String(255), nullable=True)
    stripe_metered_price_id = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    model = relationship("AIModel", back_populates="pricing")

    def __repr__(self):
        return f"<ModelPricing {self.model_id}>"
