import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const { access_token, refresh_token } = response.data;
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; full_name: string; organization_name: string }) =>
    api.post('/auth/register', data),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
  me: () => api.get('/auth/me'),
  createApiKey: (data: { name: string; scopes: string[]; expires_in_days?: number }) =>
    api.post('/auth/api-keys', data),
  listApiKeys: () => api.get('/auth/api-keys'),
  revokeApiKey: (keyId: string) => api.delete(`/auth/api-keys/${keyId}`),
};

// Organizations API
export const organizationsApi = {
  getCurrent: () => api.get('/organizations/current'),
  getStats: () => api.get('/organizations/current/stats'),
  update: (data: Partial<{ name: string; slug: string; settings: Record<string, unknown> }>) =>
    api.patch('/organizations/current', data),
};

// Users API
export const usersApi = {
  list: () => api.get('/users'),
  get: (userId: string) => api.get(`/users/${userId}`),
  create: (data: { email: string; password: string; full_name?: string; role: string }) =>
    api.post('/users', data),
  update: (userId: string, data: Partial<{ email: string; full_name: string; role: string; is_active: boolean }>) =>
    api.patch(`/users/${userId}`, data),
  delete: (userId: string) => api.delete(`/users/${userId}`),
};

// Models API
export const modelsApi = {
  list: (params?: { category?: string; active_only?: boolean }) =>
    api.get('/models', { params }),
  get: (modelId: string) => api.get(`/models/${modelId}`),
  getBySlug: (slug: string) => api.get(`/models/slug/${slug}`),
  create: (data: Record<string, unknown>) => api.post('/models', data),
  update: (modelId: string, data: Record<string, unknown>) =>
    api.patch(`/models/${modelId}`, data),
  updatePricing: (modelId: string, data: Record<string, unknown>) =>
    api.put(`/models/${modelId}/pricing`, data),
  delete: (modelId: string) => api.delete(`/models/${modelId}`),
  checkHealth: (modelId: string) => api.get(`/models/${modelId}/health`),
};

// Subscriptions API
export const subscriptionsApi = {
  list: () => api.get('/subscriptions'),
  listActive: () => api.get('/subscriptions/active'),
  get: (subscriptionId: string) => api.get(`/subscriptions/${subscriptionId}`),
  checkout: (data: { model_id: string; success_url: string; cancel_url: string }) =>
    api.post('/subscriptions/checkout', data),
  cancel: (subscriptionId: string) => api.post(`/subscriptions/${subscriptionId}/cancel`),
  checkLimits: (subscriptionId: string) => api.get(`/subscriptions/${subscriptionId}/usage-limits`),
};

// Data Sources API
export const dataSourcesApi = {
  list: () => api.get('/data-sources'),
  get: (dataSourceId: string) => api.get(`/data-sources/${dataSourceId}`),
  create: (data: { name: string; description?: string; type: string; config?: Record<string, unknown> }) =>
    api.post('/data-sources', data),
  delete: (dataSourceId: string) => api.delete(`/data-sources/${dataSourceId}`),
  listDocuments: (dataSourceId: string) => api.get(`/data-sources/${dataSourceId}/documents`),
  uploadDocument: (dataSourceId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/data-sources/${dataSourceId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteDocument: (dataSourceId: string, documentId: string) =>
    api.delete(`/data-sources/${dataSourceId}/documents/${documentId}`),
  query: (data: { query: string; top_k?: number; data_source_ids?: string[] }) =>
    api.post('/data-sources/query', data),
};

// Chat API
export const chatApi = {
  complete: (data: Record<string, unknown>) => api.post('/chat/completions', data),
  streamComplete: (data: Record<string, unknown>) =>
    api.post('/chat/completions/stream', data, { responseType: 'stream' }),
  listConversations: (params?: { limit?: number; offset?: number }) =>
    api.get('/chat/conversations', { params }),
  getConversation: (conversationId: string) => api.get(`/chat/conversations/${conversationId}`),
  deleteConversation: (conversationId: string) => api.delete(`/chat/conversations/${conversationId}`),
};

// Billing API
export const billingApi = {
  getUsage: (params?: { period_start?: string; period_end?: string }) =>
    api.get('/billing/usage', { params }),
  getInvoices: () => api.get('/billing/invoices'),
  getPortal: (return_url?: string) =>
    api.post('/billing/portal', { return_url }),
};

// Widgets API
export const widgetsApi = {
  list: () => api.get('/widgets'),
  get: (widgetId: string) => api.get(`/widgets/${widgetId}`),
  create: (data: Record<string, unknown>) => api.post('/widgets', data),
  update: (widgetId: string, data: Record<string, unknown>) =>
    api.patch(`/widgets/${widgetId}`, data),
  delete: (widgetId: string) => api.delete(`/widgets/${widgetId}`),
};

// Admin API
export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  listOrganizations: (params?: { limit?: number; offset?: number }) =>
    api.get('/admin/organizations', { params }),
  getOrganization: (orgId: string) => api.get(`/admin/organizations/${orgId}`),
  updateOrganizationPlan: (orgId: string, plan: string) =>
    api.patch(`/admin/organizations/${orgId}/plan?plan=${plan}`),
  makePlatformAdmin: (userId: string) => api.post(`/admin/users/${userId}/make-admin`),
  removePlatformAdmin: (userId: string) => api.post(`/admin/users/${userId}/remove-admin`),
};
