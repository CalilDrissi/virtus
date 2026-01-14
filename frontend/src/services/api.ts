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
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteAvatar: () => api.delete('/users/me/avatar'),
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
  // Data sources
  getDataSources: (modelId: string) => api.get(`/models/${modelId}/data-sources`),
  updateDataSources: (modelId: string, dataSourceIds: string[]) =>
    api.put(`/models/${modelId}/data-sources`, { data_source_ids: dataSourceIds }),
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
  // Data sources
  getDataSources: (subscriptionId: string) => api.get(`/subscriptions/${subscriptionId}/data-sources`),
  updateDataSources: (subscriptionId: string, dataSourceIds: string[]) =>
    api.put(`/subscriptions/${subscriptionId}/data-sources`, { data_source_ids: dataSourceIds }),
  // API Keys
  listApiKeys: (subscriptionId: string) => api.get(`/subscriptions/${subscriptionId}/api-keys`),
  createApiKey: (subscriptionId: string, data: { name: string; scopes?: string[]; expires_in_days?: number }) =>
    api.post(`/subscriptions/${subscriptionId}/api-keys`, data),
  revokeApiKey: (subscriptionId: string, keyId: string) =>
    api.delete(`/subscriptions/${subscriptionId}/api-keys/${keyId}`),
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
  getEmbedCode: (widgetId: string) => api.get(`/widgets/${widgetId}/embed-code`),
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
  // Client management
  listClients: (params?: { limit?: number; offset?: number; search?: string; active_only?: boolean }) =>
    api.get('/admin/clients', { params }),
  getClient: (userId: string) => api.get(`/admin/clients/${userId}`),
  activateClient: (userId: string) => api.patch(`/admin/clients/${userId}/activate`),
  deactivateClient: (userId: string) => api.patch(`/admin/clients/${userId}/deactivate`),
  // Credits management
  getOrganizationCredits: (orgId: string) => api.get(`/admin/organizations/${orgId}/credits`),
  assignCredits: (orgId: string, data: { amount: number; reason?: string }) =>
    api.post(`/admin/organizations/${orgId}/credits`, data),
  // Analytics
  getAnalyticsSummary: () => api.get('/admin/analytics/summary'),
  getUsageOverTime: (days?: number) => api.get('/admin/analytics/usage-over-time', { params: { days } }),
  getTopModels: (params?: { limit?: number; days?: number }) =>
    api.get('/admin/analytics/top-models', { params }),
  getTopOrganizations: (params?: { limit?: number; days?: number }) =>
    api.get('/admin/analytics/top-organizations', { params }),
  getSignupsOverTime: (days?: number) => api.get('/admin/analytics/signups-over-time', { params: { days } }),
  getSubscriptionsOverTime: (days?: number) => api.get('/admin/analytics/subscriptions-over-time', { params: { days } }),
  getRevenueByModel: (days?: number) => api.get('/admin/analytics/revenue-by-model', { params: { days } }),
};

// Roles API
export const rolesApi = {
  list: () => api.get('/roles'),
  get: (roleId: string) => api.get(`/roles/${roleId}`),
  create: (data: {
    name: string;
    description?: string;
    permissions: string[];
    model_ids: string[];
    data_source_ids: string[];
  }) => api.post('/roles', data),
  update: (roleId: string, data: {
    name?: string;
    description?: string;
    permissions?: string[];
    model_ids?: string[];
    data_source_ids?: string[];
  }) => api.put(`/roles/${roleId}`, data),
  delete: (roleId: string) => api.delete(`/roles/${roleId}`),
  assignToUser: (userId: string, roleId: string | null) =>
    api.put(`/roles/users/${userId}/role`, { role_id: roleId }),
  getUserRole: (userId: string) => api.get(`/roles/users/${userId}/role`),
};

// Categories API
export const categoriesApi = {
  list: (params?: { active_only?: boolean }) => api.get('/categories', { params }),
  get: (categoryId: string) => api.get(`/categories/${categoryId}`),
  create: (data: { slug: string; name: string; description?: string; icon?: string; color?: string; sort_order?: number }) =>
    api.post('/categories', data),
  update: (categoryId: string, data: { slug?: string; name?: string; description?: string; icon?: string; color?: string; sort_order?: number; is_active?: boolean }) =>
    api.patch(`/categories/${categoryId}`, data),
  delete: (categoryId: string) => api.delete(`/categories/${categoryId}`),
};

// Teams API
export const teamsApi = {
  list: () => api.get('/teams'),
  get: (teamId: string) => api.get(`/teams/${teamId}`),
  create: (data: { name: string; description?: string }) =>
    api.post('/teams', data),
  update: (teamId: string, data: { name?: string; description?: string }) =>
    api.put(`/teams/${teamId}`, data),
  delete: (teamId: string) => api.delete(`/teams/${teamId}`),
  // Members
  listMembers: (teamId: string) => api.get(`/teams/${teamId}/members`),
  addMember: (teamId: string, data: { email: string; role: string }) =>
    api.post(`/teams/${teamId}/members`, data),
  updateMember: (teamId: string, userId: string, data: { role: string }) =>
    api.put(`/teams/${teamId}/members/${userId}`, data),
  removeMember: (teamId: string, userId: string) =>
    api.delete(`/teams/${teamId}/members/${userId}`),
  // Permissions
  getPermissions: (teamId: string) => api.get(`/teams/${teamId}/permissions`),
  updatePermissions: (teamId: string, data: { permissions: string[] }) =>
    api.put(`/teams/${teamId}/permissions`, data),
  // Model Access
  getModelAccess: (teamId: string) => api.get(`/teams/${teamId}/models`),
  updateModelAccess: (teamId: string, data: { model_ids: string[] }) =>
    api.put(`/teams/${teamId}/models`, data),
  // Data Source Access
  getDataSourceAccess: (teamId: string) => api.get(`/teams/${teamId}/data-sources`),
  updateDataSourceAccess: (teamId: string, data: { data_source_ids: string[] }) =>
    api.put(`/teams/${teamId}/data-sources`, data),
};
