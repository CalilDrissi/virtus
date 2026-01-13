from typing import AsyncGenerator, List, Dict, Any, Optional
import tiktoken
from openai import AsyncOpenAI
from app.providers.base import BaseAIProvider, Message, CompletionResult
from app.config import settings


class OpenAIProvider(BaseAIProvider):
    """OpenAI API provider"""

    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config or {})
        api_key = self.config.get("api_key") or settings.OPENAI_API_KEY
        base_url = self.config.get("base_url")
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.embedding_model = self.config.get("embedding_model", "text-embedding-3-small")

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
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})
        for msg in messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})

        response = await self.client.chat.completions.create(
            model=model,
            messages=formatted_messages,
            max_tokens=max_tokens,
            temperature=temperature,
            **kwargs,
        )

        return CompletionResult(
            content=response.choices[0].message.content,
            input_tokens=response.usage.prompt_tokens,
            output_tokens=response.usage.completion_tokens,
            finish_reason=response.choices[0].finish_reason,
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
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})
        for msg in messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})

        stream = await self.client.chat.completions.create(
            model=model,
            messages=formatted_messages,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=True,
            **kwargs,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def count_tokens(self, text: str, model: str) -> int:
        try:
            encoding = tiktoken.encoding_for_model(model)
        except KeyError:
            encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text))

    async def get_embeddings(self, texts: List[str], model: str = None) -> List[List[float]]:
        model = model or self.embedding_model
        response = await self.client.embeddings.create(
            input=texts,
            model=model,
        )
        return [item.embedding for item in response.data]

    async def health_check(self) -> bool:
        try:
            await self.client.models.list()
            return True
        except Exception:
            return False
