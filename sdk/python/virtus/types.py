"""Type definitions for Virtus SDK"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


@dataclass
class ChatMessage:
    role: MessageRole
    content: str


@dataclass
class ChatOptions:
    model_id: str
    messages: List[ChatMessage]
    conversation_id: Optional[str] = None
    use_rag: bool = True
    data_source_ids: Optional[List[str]] = None
    stream: bool = False
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None


@dataclass
class ChatResponse:
    id: str
    conversation_id: str
    content: str
    input_tokens: int
    output_tokens: int
    model_id: str
    created_at: str
    context_used: Optional[List[Dict[str, Any]]] = None


@dataclass
class ModelPricing:
    pricing_type: str
    price_per_1k_input_tokens: float = 0
    price_per_1k_output_tokens: float = 0
    price_per_request: float = 0
    monthly_subscription_price: float = 0
    included_tokens: int = 0
    included_requests: int = 0


@dataclass
class Model:
    id: str
    name: str
    slug: str
    description: Optional[str]
    category: str
    provider: str
    is_active: bool
    pricing: Optional[ModelPricing] = None


@dataclass
class DataSource:
    id: str
    name: str
    type: str
    status: str
    document_count: int
    description: Optional[str] = None


@dataclass
class Document:
    id: str
    data_source_id: str
    filename: str
    content_type: str
    file_size: int
    chunk_count: int
    status: str


@dataclass
class RAGChunk:
    content: str
    document_id: str
    document_name: str
    score: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RAGQueryResponse:
    chunks: List[RAGChunk]
    query: str
