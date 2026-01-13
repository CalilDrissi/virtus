from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class Message:
    role: str
    content: str


@dataclass
class CompletionResult:
    content: str
    input_tokens: int
    output_tokens: int
    finish_reason: str


class BaseAIProvider(ABC):
    """Base class for AI model providers"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config

    @abstractmethod
    async def complete(
        self,
        messages: List[Message],
        model: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> CompletionResult:
        """Generate a completion (non-streaming)"""
        pass

    @abstractmethod
    async def stream(
        self,
        messages: List[Message],
        model: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """Generate a streaming completion"""
        pass

    @abstractmethod
    async def count_tokens(self, text: str, model: str) -> int:
        """Count tokens in text"""
        pass

    @abstractmethod
    async def get_embeddings(self, texts: List[str], model: str = None) -> List[List[float]]:
        """Generate embeddings for texts"""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the provider is available"""
        pass
