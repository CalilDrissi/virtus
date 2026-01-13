# Virtus AI Platform

A multi-tenant B2B SaaS platform for offering fine-tuned AI models to business clients through a marketplace.

## Features

- **AI Model Marketplace**: Curate and configure specialized AI models for different industries (legal, healthcare, e-commerce, customer support, etc.)
- **Multi-tenant Architecture**: Organizations subscribe to models with isolated data and usage tracking
- **RAG Integration**: Connect data sources (documents, databases, APIs) for context-aware AI responses
- **Flexible Billing**: Per-token, per-request, subscription, or hybrid pricing via Stripe
- **Multiple Consumption Channels**: Chat interface, embeddable widget, REST API, and SDKs
- **Admin Panel**: Manage models, pricing, organizations, and platform analytics

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | FastAPI + Python 3.11+ |
| Database | PostgreSQL + SQLAlchemy |
| Vector DB | Qdrant |
| Frontend | React 18 + TypeScript + Fluent UI 2 |
| Auth | JWT + API Keys |
| Payments | Stripe |
| AI Providers | OpenAI, Anthropic, Ollama, vLLM |

## Project Structure

```
virtus/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── api/       # API routes
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── services/  # Business logic
│   │   ├── providers/ # AI provider adapters
│   │   └── utils/     # Utilities
│   └── alembic/       # Database migrations
├── frontend/          # React frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── stores/
├── widget/            # Embeddable chat widget
├── sdk/
│   ├── js/            # JavaScript/TypeScript SDK
│   └── python/        # Python SDK
└── docker-compose.yml
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Python 3.11+

### 1. Start Infrastructure

```bash
docker-compose up -d db qdrant
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
# Edit .env with your API keys
```

### 3. Start Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Access the Platform

- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `QDRANT_HOST` | Qdrant vector database host |
| `JWT_SECRET_KEY` | Secret for JWT tokens |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |

## API Usage

### Authentication

```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Use API Key
curl http://localhost:8000/api/v1/models \
  -H "X-API-Key: vrt_your_api_key"
```

### Chat Completion

```bash
curl -X POST http://localhost:8000/api/v1/chat/completions \
  -H "X-API-Key: vrt_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "model-uuid",
    "messages": [{"role": "user", "content": "Hello!"}],
    "use_rag": true
  }'
```

## SDK Usage

### JavaScript/TypeScript

```typescript
import VirtusClient from '@virtus/sdk';

const client = new VirtusClient({
  apiKey: 'vrt_your_api_key',
  baseUrl: 'http://localhost:8000',
});

// Chat
const response = await client.chat({
  modelId: 'model-uuid',
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Stream
for await (const chunk of client.streamChat({ ... })) {
  console.log(chunk);
}
```

### Python

```python
from virtus import VirtusClient, ChatMessage, ChatOptions, MessageRole

client = VirtusClient(
    api_key="vrt_your_api_key",
    base_url="http://localhost:8000",
)

# Chat
response = client.chat(ChatOptions(
    model_id="model-uuid",
    messages=[ChatMessage(role=MessageRole.USER, content="Hello!")],
))

# Stream
async for chunk in client.stream_chat(options):
    print(chunk, end="")
```

## Embedding the Widget

```html
<script>
  window.VirtusWidget.init({
    widgetId: 'widget-uuid',
    apiUrl: 'http://localhost:8000',
    apiKey: 'vrt_your_api_key',
    theme: {
      primaryColor: '#0078d4',
    },
    title: 'Chat with AI',
    welcomeMessage: 'Hi! How can I help you today?',
  });
</script>
<script src="http://localhost:8000/widget/virtus-widget.js"></script>
```

## Admin Setup

1. Register the first user - they become the organization owner
2. Set `is_platform_admin = true` in the database for admin access
3. Access the Admin panel to add AI models and configure pricing

```sql
UPDATE users SET is_platform_admin = true WHERE email = 'admin@example.com';
```

## Development

### Run Tests

```bash
cd backend
pytest
```

### Database Migrations

```bash
cd backend
alembic revision --autogenerate -m "Description"
alembic upgrade head
```

## License

MIT
