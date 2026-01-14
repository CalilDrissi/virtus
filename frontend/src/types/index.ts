export interface User {
  id: string;
  organization_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'owner' | 'admin' | 'member';
  is_platform_admin: boolean;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrganizationWithStats extends Organization {
  user_count: number;
  subscription_count: number;
  total_usage_tokens: number;
}

export interface DataSourceInfo {
  id: string;
  name: string;
  type: string;
}

export interface AIModel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  provider: 'openai' | 'anthropic' | 'ollama' | 'vllm' | 'custom';
  provider_model_id: string;
  provider_config: Record<string, string> | null;
  system_prompt: string | null;
  max_tokens: number;
  temperature: number;
  is_public: boolean;
  is_active: boolean;
  icon_url: string | null;
  created_at: string;
  updated_at: string;
  pricing: ModelPricing | null;
  data_sources: DataSourceInfo[];
}

export interface ModelPricing {
  id: string;
  model_id: string;
  pricing_type: 'per_token' | 'per_request' | 'subscription' | 'hybrid';
  price_per_1k_input_tokens: number;
  price_per_1k_output_tokens: number;
  price_per_request: number;
  monthly_subscription_price: number;
  included_requests: number;
  included_tokens: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  organization_id: string;
  model_id: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'paused';
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  model?: AIModel;
  data_sources: DataSourceInfo[];
}

export interface SubscriptionWithUsage extends Subscription {
  usage_this_period: number;
  cost_this_period: number;
}

export interface DataSource {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  type: 'document' | 'database' | 'email' | 'api' | 'website';
  config: Record<string, unknown>;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  document_count: number;
}

export interface Document {
  id: string;
  data_source_id: string;
  organization_id: string;
  filename: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  chunk_count: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Conversation {
  id: string;
  organization_id: string;
  model_id: string | null;
  channel: 'chat' | 'widget' | 'api' | 'sdk';
  title: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  input_tokens: number;
  output_tokens: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UsageSummary {
  period_start: string;
  period_end: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_requests: number;
  total_cost: number;
  by_model: ModelUsageSummary[];
}

export interface ModelUsageSummary {
  model_id: string;
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  requests: number;
  cost: number;
}

export interface WidgetConfig {
  id: string;
  organization_id: string;
  model_id: string;
  name: string;
  theme: Record<string, unknown>;
  position: string;
  welcome_message: string | null;
  placeholder_text: string;
  allowed_domains: string[];
  logo_url: string | null;
  title: string;
  is_active: boolean;
}

export interface APIKey {
  id: string;
  organization_id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model_id: string;
  messages: ChatMessage[];
  conversation_id?: string;
  use_rag?: boolean;
  data_source_ids?: string[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
}
