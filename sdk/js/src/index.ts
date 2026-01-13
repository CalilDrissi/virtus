export interface VirtusConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatOptions {
  modelId: string;
  messages: ChatMessage[];
  conversationId?: string;
  useRag?: boolean;
  dataSourceIds?: string[];
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  id: string;
  conversationId: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  createdAt: string;
}

export interface Model {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  provider: string;
  isActive: boolean;
  pricing: {
    pricingType: string;
    pricePerRequest?: number;
    pricePerInputTokens?: number;
    pricePerOutputTokens?: number;
    monthlySubscriptionPrice?: number;
  } | null;
}

export interface DataSource {
  id: string;
  name: string;
  type: string;
  status: string;
  documentCount: number;
}

export class VirtusClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: VirtusConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.virtus.ai';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API error: ${response.status}`);
    }

    return response.json();
  }

  // Chat API
  async chat(options: ChatOptions): Promise<ChatResponse> {
    return this.request<ChatResponse>('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model_id: options.modelId,
        messages: options.messages,
        conversation_id: options.conversationId,
        use_rag: options.useRag ?? true,
        data_source_ids: options.dataSourceIds,
        stream: false,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
      }),
    });
  }

  async *streamChat(options: ChatOptions): AsyncGenerator<string, void, unknown> {
    const url = `${this.baseUrl}/api/v1/chat/completions/stream`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({
        model_id: options.modelId,
        messages: options.messages,
        conversation_id: options.conversationId,
        use_rag: options.useRag ?? true,
        data_source_ids: options.dataSourceIds,
        stream: true,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'content') {
            yield data.content;
          } else if (data.type === 'error') {
            throw new Error(data.error);
          }
        }
      }
    }
  }

  // Models API
  async listModels(options?: { category?: string }): Promise<Model[]> {
    const params = new URLSearchParams();
    if (options?.category) params.set('category', options.category);

    return this.request<Model[]>(`/models?${params}`);
  }

  async getModel(modelId: string): Promise<Model> {
    return this.request<Model>(`/models/${modelId}`);
  }

  // Data Sources API
  async listDataSources(): Promise<DataSource[]> {
    return this.request<DataSource[]>('/data-sources');
  }

  async createDataSource(data: {
    name: string;
    type: string;
    description?: string;
  }): Promise<DataSource> {
    return this.request<DataSource>('/data-sources', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async uploadDocument(
    dataSourceId: string,
    file: File
  ): Promise<{ id: string; filename: string; status: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `${this.baseUrl}/api/v1/data-sources/${dataSourceId}/documents`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return response.json();
  }

  async queryRAG(
    query: string,
    options?: { topK?: number; dataSourceIds?: string[] }
  ): Promise<{
    chunks: Array<{
      content: string;
      documentId: string;
      documentName: string;
      score: number;
    }>;
  }> {
    return this.request('/data-sources/query', {
      method: 'POST',
      body: JSON.stringify({
        query,
        top_k: options?.topK ?? 5,
        data_source_ids: options?.dataSourceIds,
      }),
    });
  }
}

// Default export for convenience
export default VirtusClient;
