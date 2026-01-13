"""Virtus AI Platform Python Client"""

import httpx
from typing import Optional, List, Dict, Any, AsyncIterator
import json

from .types import (
    ChatMessage,
    ChatOptions,
    ChatResponse,
    Model,
    ModelPricing,
    DataSource,
    Document,
    RAGChunk,
    RAGQueryResponse,
)


class VirtusClient:
    """Client for interacting with the Virtus AI Platform API."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.virtus.ai",
        timeout: float = 120.0,
    ):
        """
        Initialize the Virtus client.

        Args:
            api_key: Your Virtus API key
            base_url: Base URL for the API (default: https://api.virtus.ai)
            timeout: Request timeout in seconds (default: 120)
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client = httpx.Client(
            base_url=f"{self.base_url}/api/v1",
            headers={
                "X-API-Key": api_key,
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )
        self._async_client: Optional[httpx.AsyncClient] = None

    def _get_async_client(self) -> httpx.AsyncClient:
        if self._async_client is None:
            self._async_client = httpx.AsyncClient(
                base_url=f"{self.base_url}/api/v1",
                headers={
                    "X-API-Key": self.api_key,
                    "Content-Type": "application/json",
                },
                timeout=self.timeout,
            )
        return self._async_client

    def close(self):
        """Close the HTTP client."""
        self._client.close()
        if self._async_client:
            # Note: async client should be closed with await
            pass

    async def aclose(self):
        """Close the async HTTP client."""
        if self._async_client:
            await self._async_client.aclose()

    # Chat API
    def chat(self, options: ChatOptions) -> ChatResponse:
        """
        Send a chat completion request.

        Args:
            options: Chat options including model, messages, and parameters

        Returns:
            ChatResponse with the model's response
        """
        response = self._client.post(
            "/chat/completions",
            json={
                "model_id": options.model_id,
                "messages": [
                    {"role": m.role.value, "content": m.content}
                    for m in options.messages
                ],
                "conversation_id": options.conversation_id,
                "use_rag": options.use_rag,
                "data_source_ids": options.data_source_ids,
                "stream": False,
                "max_tokens": options.max_tokens,
                "temperature": options.temperature,
            },
        )
        response.raise_for_status()
        data = response.json()
        return ChatResponse(
            id=data["id"],
            conversation_id=data["conversation_id"],
            content=data["content"],
            input_tokens=data["input_tokens"],
            output_tokens=data["output_tokens"],
            model_id=data["model_id"],
            created_at=data["created_at"],
            context_used=data.get("context_used"),
        )

    async def achat(self, options: ChatOptions) -> ChatResponse:
        """Async version of chat()."""
        client = self._get_async_client()
        response = await client.post(
            "/chat/completions",
            json={
                "model_id": options.model_id,
                "messages": [
                    {"role": m.role.value, "content": m.content}
                    for m in options.messages
                ],
                "conversation_id": options.conversation_id,
                "use_rag": options.use_rag,
                "data_source_ids": options.data_source_ids,
                "stream": False,
                "max_tokens": options.max_tokens,
                "temperature": options.temperature,
            },
        )
        response.raise_for_status()
        data = response.json()
        return ChatResponse(
            id=data["id"],
            conversation_id=data["conversation_id"],
            content=data["content"],
            input_tokens=data["input_tokens"],
            output_tokens=data["output_tokens"],
            model_id=data["model_id"],
            created_at=data["created_at"],
            context_used=data.get("context_used"),
        )

    async def stream_chat(self, options: ChatOptions) -> AsyncIterator[str]:
        """
        Stream a chat completion response.

        Args:
            options: Chat options

        Yields:
            Content chunks as they arrive
        """
        client = self._get_async_client()
        async with client.stream(
            "POST",
            "/chat/completions/stream",
            json={
                "model_id": options.model_id,
                "messages": [
                    {"role": m.role.value, "content": m.content}
                    for m in options.messages
                ],
                "conversation_id": options.conversation_id,
                "use_rag": options.use_rag,
                "data_source_ids": options.data_source_ids,
                "stream": True,
                "max_tokens": options.max_tokens,
                "temperature": options.temperature,
            },
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = json.loads(line[6:])
                    if data["type"] == "content":
                        yield data["content"]
                    elif data["type"] == "error":
                        raise Exception(data["error"])

    # Models API
    def list_models(self, category: Optional[str] = None) -> List[Model]:
        """List available AI models."""
        params = {}
        if category:
            params["category"] = category

        response = self._client.get("/models", params=params)
        response.raise_for_status()

        models = []
        for data in response.json():
            pricing = None
            if data.get("pricing"):
                pricing = ModelPricing(
                    pricing_type=data["pricing"]["pricing_type"],
                    price_per_1k_input_tokens=data["pricing"].get("price_per_1k_input_tokens", 0),
                    price_per_1k_output_tokens=data["pricing"].get("price_per_1k_output_tokens", 0),
                    price_per_request=data["pricing"].get("price_per_request", 0),
                    monthly_subscription_price=data["pricing"].get("monthly_subscription_price", 0),
                    included_tokens=data["pricing"].get("included_tokens", 0),
                    included_requests=data["pricing"].get("included_requests", 0),
                )
            models.append(Model(
                id=data["id"],
                name=data["name"],
                slug=data["slug"],
                description=data.get("description"),
                category=data["category"],
                provider=data["provider"],
                is_active=data["is_active"],
                pricing=pricing,
            ))
        return models

    def get_model(self, model_id: str) -> Model:
        """Get a specific model by ID."""
        response = self._client.get(f"/models/{model_id}")
        response.raise_for_status()
        data = response.json()

        pricing = None
        if data.get("pricing"):
            pricing = ModelPricing(
                pricing_type=data["pricing"]["pricing_type"],
                price_per_1k_input_tokens=data["pricing"].get("price_per_1k_input_tokens", 0),
                price_per_1k_output_tokens=data["pricing"].get("price_per_1k_output_tokens", 0),
                price_per_request=data["pricing"].get("price_per_request", 0),
                monthly_subscription_price=data["pricing"].get("monthly_subscription_price", 0),
                included_tokens=data["pricing"].get("included_tokens", 0),
                included_requests=data["pricing"].get("included_requests", 0),
            )

        return Model(
            id=data["id"],
            name=data["name"],
            slug=data["slug"],
            description=data.get("description"),
            category=data["category"],
            provider=data["provider"],
            is_active=data["is_active"],
            pricing=pricing,
        )

    # Data Sources API
    def list_data_sources(self) -> List[DataSource]:
        """List all data sources."""
        response = self._client.get("/data-sources")
        response.raise_for_status()

        return [
            DataSource(
                id=data["id"],
                name=data["name"],
                type=data["type"],
                status=data["status"],
                document_count=data["document_count"],
                description=data.get("description"),
            )
            for data in response.json()
        ]

    def create_data_source(
        self,
        name: str,
        type: str = "document",
        description: Optional[str] = None,
    ) -> DataSource:
        """Create a new data source."""
        response = self._client.post(
            "/data-sources",
            json={
                "name": name,
                "type": type,
                "description": description,
            },
        )
        response.raise_for_status()
        data = response.json()

        return DataSource(
            id=data["id"],
            name=data["name"],
            type=data["type"],
            status=data["status"],
            document_count=data["document_count"],
            description=data.get("description"),
        )

    def upload_document(
        self,
        data_source_id: str,
        file_path: str,
    ) -> Document:
        """Upload a document to a data source."""
        with open(file_path, "rb") as f:
            files = {"file": f}
            response = httpx.post(
                f"{self.base_url}/api/v1/data-sources/{data_source_id}/documents",
                headers={"X-API-Key": self.api_key},
                files=files,
                timeout=self.timeout,
            )
        response.raise_for_status()
        data = response.json()

        return Document(
            id=data["id"],
            data_source_id=data_source_id,
            filename=data["filename"],
            content_type=data.get("content_type", ""),
            file_size=data.get("file_size", 0),
            chunk_count=data.get("chunk_count", 0),
            status=data["status"],
        )

    def query_rag(
        self,
        query: str,
        top_k: int = 5,
        data_source_ids: Optional[List[str]] = None,
    ) -> RAGQueryResponse:
        """Query the RAG system."""
        response = self._client.post(
            "/data-sources/query",
            json={
                "query": query,
                "top_k": top_k,
                "data_source_ids": data_source_ids,
            },
        )
        response.raise_for_status()
        data = response.json()

        return RAGQueryResponse(
            query=data["query"],
            chunks=[
                RAGChunk(
                    content=chunk["content"],
                    document_id=chunk["document_id"],
                    document_name=chunk["document_name"],
                    score=chunk["score"],
                    metadata=chunk.get("metadata", {}),
                )
                for chunk in data["chunks"]
            ],
        )
