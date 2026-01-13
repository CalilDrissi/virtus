from typing import AsyncGenerator, List, Dict, Any, Optional
from anthropic import AsyncAnthropic
from app.providers.base import BaseAIProvider, Message, CompletionResult
from app.config import settings


class AnthropicProvider(BaseAIProvider):
    """Anthropic Claude API provider"""

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config or {})
        api_key = self.config.get("api_key") or settings.ANTHROPIC_API_KEY
        self.client = AsyncAnthropic(api_key=api_key)

    async def complete(
        self,
        messages: List[Message],
        model: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> CompletionResult:
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})

        response = await self.client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt or "",
            messages=formatted_messages,
        )

        return CompletionResult(
            content=response.content[0].text,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            finish_reason=response.stop_reason,
        )

    async def stream(
        self,
        messages: List[Message],
        model: str,
        max_tokens: int = 4096,
        temperature: float = 0.7,
        system_prompt: Optional[str] = None,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})

        async with self.client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt or "",
            messages=formatted_messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text

    async def count_tokens(self, text: str, model: str) -> int:
        # Anthropic doesn't have a public token counter, estimate based on words
        # Claude uses ~1.3 tokens per word on average
        return int(len(text.split()) * 1.3)

    async def get_embeddings(self, texts: List[str], model: str = None) -> List[List[float]]:
        # Anthropic doesn't provide embeddings API
        # Fall back to OpenAI for embeddings
        from app.providers.openai_provider import OpenAIProvider
        openai_provider = OpenAIProvider({})
        return await openai_provider.get_embeddings(texts, model)

    async def health_check(self) -> bool:
        try:
            # Make a minimal request to check connectivity
            await self.client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=1,
                messages=[{"role": "user", "content": "hi"}],
            )
            return True
        except Exception:
            return False
