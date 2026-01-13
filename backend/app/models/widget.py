import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from app.database import Base


class WidgetConfig(Base):
    __tablename__ = "widget_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ai_models.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)

    # Appearance
    theme = Column(JSONB, default=dict, nullable=False)  # primaryColor, backgroundColor, etc.
    position = Column(String(50), default="bottom-right", nullable=False)

    # Behavior
    welcome_message = Column(Text, nullable=True)
    placeholder_text = Column(String(255), default="Type a message...", nullable=False)

    # Security
    allowed_domains = Column(ARRAY(String), default=list, nullable=False)

    # Branding
    logo_url = Column(String(500), nullable=True)
    title = Column(String(100), default="Chat with AI", nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="widget_configs")
    model = relationship("AIModel", back_populates="widget_configs")

    def __repr__(self):
        return f"<WidgetConfig {self.name}>"
