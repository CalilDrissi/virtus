import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tile,
  Button,
  TextInput,
  TextArea,
  Dropdown,
  Tag,
  Modal,
  Toggle,
  Loading,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  MultiSelect,
} from '@carbon/react';
import { Add, Edit, TrashCan } from '@carbon/icons-react';
import { modelsApi, dataSourcesApi, categoriesApi } from '../../services/api';
import { AIModel, DataSource } from '../../types';

interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sort_order: number;
  is_active: boolean;
}

const providers = [
  { id: 'openai', text: 'OpenAI', description: 'GPT-4, GPT-3.5, and other OpenAI models' },
  { id: 'anthropic', text: 'Anthropic', description: 'Claude 3, Claude 2, and other Anthropic models' },
  { id: 'ollama', text: 'Ollama', description: 'Local models via Ollama (Llama, Mistral, etc.)' },
  { id: 'vllm', text: 'vLLM', description: 'High-performance inference server' },
  { id: 'custom', text: 'Custom (OpenAI-compatible)', description: 'Any API using OpenAI-compatible format' },
];

const pricingTypes = [
  { id: 'per_token', text: 'Per Token', description: 'Charge based on input/output tokens used' },
  { id: 'per_request', text: 'Per Request', description: 'Fixed price for each API request' },
  { id: 'per_user', text: 'Per User', description: 'Monthly fee per active user' },
  { id: 'subscription', text: 'Subscription', description: 'Fixed monthly fee with included usage' },
  { id: 'hybrid', text: 'Hybrid', description: 'Base subscription plus usage-based charges' },
];

const defaultModel = {
  name: '',
  description: '',
  category: 'general',
  provider: 'custom',
  provider_model_id: '',
  max_tokens: 4096,
  temperature: 0.7,
  is_public: true,
  // Self-hosted configuration
  base_url: '',
  api_key: '',
  is_fine_tuned: false,
  base_model: '',
  context_length: 4096,
  // Data sources
  data_source_ids: [] as string[],
  pricing: {
    pricing_type: 'per_token',
    price_per_1k_input_tokens: 0,
    price_per_1k_output_tokens: 0,
    price_per_request: 0,
    price_per_user: 0,
    monthly_subscription_price: 0,
    included_tokens: 0,
    included_requests: 0,
  },
};

export default function AdminModels() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [formData, setFormData] = useState(defaultModel);
  const [deleteConfirm, setDeleteConfirm] = useState<AIModel | null>(null);

  const { data: models, isLoading } = useQuery<AIModel[]>({
    queryKey: ['admin-models'],
    queryFn: () => modelsApi.list({ active_only: false }).then(res => res.data),
  });

  const { data: dataSources } = useQuery<DataSource[]>({
    queryKey: ['data-sources'],
    queryFn: () => dataSourcesApi.list().then(res => res.data),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list({ active_only: false }).then(res => res.data),
  });

  // Transform categories for dropdown
  const categoryItems = categories?.map(c => ({ id: c.slug, text: c.name })) || [
    { id: 'general', text: 'General' }
  ];

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await modelsApi.create(data);
      // Save data sources if any were selected
      if (data.data_source_ids.length > 0) {
        await modelsApi.updateDataSources(response.data.id, data.data_source_ids);
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-models'] });
      setIsCreateOpen(false);
      setFormData(defaultModel);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, dataSourceIds }: { id: string; data: Partial<typeof formData>; dataSourceIds: string[] }) => {
      const response = await modelsApi.update(id, data);
      // Always update data sources (even if empty, to allow clearing)
      await modelsApi.updateDataSources(id, dataSourceIds);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-models'] });
      setEditingModel(null);
      setIsCreateOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => modelsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-models'] });
      setDeleteConfirm(null);
    },
  });

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm.id);
    }
  };

  const handleEdit = (model: AIModel) => {
    setEditingModel(model);
    // Extract base_url and api_key from provider_config
    const providerConfig = (model as any).provider_config || {};
    setFormData({
      name: model.name,
      description: model.description || '',
      category: model.category,
      provider: model.provider,
      provider_model_id: model.provider_model_id,
      max_tokens: model.max_tokens,
      temperature: Number(model.temperature),
      is_public: model.is_public,
      // Extract from provider_config
      base_url: providerConfig.base_url || '',
      api_key: providerConfig.api_key || '',
      is_fine_tuned: (model as any).is_fine_tuned || false,
      base_model: (model as any).base_model || '',
      context_length: (model as any).context_length || 4096,
      // Extract data source IDs
      data_source_ids: model.data_sources?.map(ds => ds.id) || [],
      pricing: model.pricing ? {
        pricing_type: model.pricing.pricing_type,
        price_per_1k_input_tokens: model.pricing.price_per_1k_input_tokens,
        price_per_1k_output_tokens: model.pricing.price_per_1k_output_tokens,
        price_per_request: model.pricing.price_per_request,
        price_per_user: (model.pricing as any).price_per_user || 0,
        monthly_subscription_price: model.pricing.monthly_subscription_price,
        included_tokens: model.pricing.included_tokens,
        included_requests: model.pricing.included_requests,
      } : defaultModel.pricing,
    });
    setIsCreateOpen(true);
  };

  const handleSubmit = () => {
    // Build provider_config from base_url and api_key
    const provider_config: Record<string, string> = {};
    if (formData.base_url) {
      provider_config.base_url = formData.base_url;
    }
    if (formData.api_key) {
      provider_config.api_key = formData.api_key;
    }

    // Build the payload without the flattened fields
    const payload = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      provider: formData.provider,
      provider_model_id: formData.provider_model_id,
      provider_config,
      max_tokens: formData.max_tokens,
      temperature: formData.temperature,
      is_public: formData.is_public,
      pricing: formData.pricing,
    };

    if (editingModel) {
      updateMutation.mutate({ id: editingModel.id, data: payload, dataSourceIds: formData.data_source_ids });
    } else {
      createMutation.mutate({ ...payload, data_source_ids: formData.data_source_ids } as any);
    }
  };

  const handleClose = () => {
    setIsCreateOpen(false);
    setEditingModel(null);
    setFormData(defaultModel);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading models..." withOverlay={false} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 400, marginBottom: '0.5rem' }}>AI Models</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Configure and manage your AI model catalog</p>
        </div>
        <Button kind="primary" renderIcon={Add} onClick={() => setIsCreateOpen(true)}>
          Add Model
        </Button>
      </div>

      <Tile style={{ padding: '1.5rem' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
              <TableHeader>Provider</TableHeader>
              <TableHeader>Category</TableHeader>
              <TableHeader>Pricing</TableHeader>
              <TableHeader>Data Sources</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {models?.map(model => (
              <TableRow key={model.id}>
                <TableCell>
                  <div style={{ fontWeight: 600 }}>{model.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{model.provider_model_id}</div>
                </TableCell>
                <TableCell>{model.provider}</TableCell>
                <TableCell>
                  {categories?.find(c => c.slug === model.category)?.name || model.category.replace('_', ' ')}
                </TableCell>
                <TableCell>
                  {model.pricing?.monthly_subscription_price
                    ? `$${model.pricing.monthly_subscription_price}/mo`
                    : model.pricing?.price_per_1k_input_tokens
                    ? `$${model.pricing.price_per_1k_input_tokens}/1K`
                    : 'Free'}
                </TableCell>
                <TableCell>
                  {model.data_sources?.length > 0 ? (
                    <Tag type="blue">{model.data_sources.length} linked</Tag>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>None</span>
                  )}
                </TableCell>
                <TableCell>
                  <Tag type={model.is_active ? 'green' : 'red'}>
                    {model.is_active ? 'Active' : 'Inactive'}
                  </Tag>
                </TableCell>
                <TableCell>
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={Edit}
                    hasIconOnly
                    iconDescription="Edit"
                    onClick={() => handleEdit(model)}
                  />
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={TrashCan}
                    hasIconOnly
                    iconDescription="Delete"
                    onClick={() => setDeleteConfirm(model)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Tile>

      <Modal
        open={isCreateOpen}
        onRequestClose={handleClose}
        onRequestSubmit={handleSubmit}
        modalHeading={editingModel ? 'Edit Model' : 'Add New Model'}
        primaryButtonText={editingModel ? 'Save Changes' : 'Create Model'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={!formData.name || !formData.provider_model_id || createMutation.isPending || updateMutation.isPending}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <TextInput
              id="name"
              labelText="Display Name"
              placeholder="e.g., Legal Assistant Pro"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Dropdown
              id="category"
              titleText="Category"
              label="Select category"
              items={categoryItems}
              itemToString={(item) => item?.text || ''}
              selectedItem={categoryItems.find(c => c.id === formData.category)}
              onChange={({ selectedItem }) => setFormData({ ...formData, category: selectedItem?.id || 'general' })}
            />
          </div>

          <div>
            <Dropdown
              id="provider"
              titleText="Provider"
              label="Select provider"
              items={providers}
              itemToString={(item) => item?.text || ''}
              selectedItem={providers.find(p => p.id === formData.provider)}
              onChange={({ selectedItem }) => setFormData({ ...formData, provider: selectedItem?.id || 'custom' })}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {providers.find(p => p.id === formData.provider)?.description}
            </p>
          </div>

          <TextInput
            id="provider_model_id"
            labelText="Model ID"
            placeholder={formData.provider === 'openai' ? 'e.g., gpt-4, gpt-4-turbo' :
                        formData.provider === 'anthropic' ? 'e.g., claude-3-opus-20240229' :
                        formData.provider === 'ollama' ? 'e.g., llama3.1, mistral' :
                        'e.g., my-model-name'}
            value={formData.provider_model_id}
            onChange={(e) => setFormData({ ...formData, provider_model_id: e.target.value })}
          />

          <TextArea
            id="description"
            labelText="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          {dataSources && dataSources.length > 0 && (
            <MultiSelect
              id="data_sources"
              titleText="Default Data Sources"
              label={formData.data_source_ids.length > 0
                ? `${formData.data_source_ids.length} selected`
                : 'Select data sources'}
              items={dataSources.map(ds => ({ id: ds.id, label: ds.name, type: ds.type }))}
              itemToString={(item) => item?.label || ''}
              selectedItems={dataSources
                .filter(ds => formData.data_source_ids.includes(ds.id))
                .map(ds => ({ id: ds.id, label: ds.name, type: ds.type }))}
              onChange={({ selectedItems }) => setFormData({
                ...formData,
                data_source_ids: selectedItems?.map(item => item.id) || []
              })}
              helperText="Select data sources that will be automatically used when chatting with this model"
            />
          )}

          <h3 style={{ fontWeight: 600, marginTop: '0.5rem' }}>
            {formData.provider === 'openai' || formData.provider === 'anthropic'
              ? 'API Configuration'
              : 'Server Configuration'}
          </h3>

          {/* Show base URL for custom, ollama, vllm */}
          {(formData.provider === 'custom' || formData.provider === 'ollama' || formData.provider === 'vllm') && (
            <TextInput
              id="base_url"
              labelText="Base URL / API Endpoint"
              placeholder={
                formData.provider === 'ollama' ? 'e.g., http://localhost:11434' :
                formData.provider === 'vllm' ? 'e.g., http://localhost:8000/v1' :
                'e.g., https://api.example.com/v1'
              }
              value={formData.base_url}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
            />
          )}

          {/* Show API key for providers that need it */}
          {(formData.provider === 'openai' || formData.provider === 'anthropic' || formData.provider === 'custom') && (
            <TextInput
              id="api_key"
              type="password"
              labelText={formData.provider === 'custom' ? 'API Key (if required)' : 'API Key'}
              placeholder={
                formData.provider === 'openai' ? 'sk-...' :
                formData.provider === 'anthropic' ? 'sk-ant-...' :
                'Enter API key if authentication is required'
              }
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <TextInput
              id="context_length"
              type="number"
              labelText="Context Length"
              placeholder="e.g., 4096, 8192, 32768"
              value={String(formData.context_length)}
              onChange={(e) => setFormData({ ...formData, context_length: Number(e.target.value) })}
            />
            <TextInput
              id="max_tokens"
              type="number"
              labelText="Max Output Tokens"
              value={String(formData.max_tokens)}
              onChange={(e) => setFormData({ ...formData, max_tokens: Number(e.target.value) })}
            />
          </div>

          <Toggle
            id="is_fine_tuned"
            labelText="Fine-tuned Model"
            toggled={formData.is_fine_tuned}
            onToggle={(checked) => setFormData({ ...formData, is_fine_tuned: checked })}
          />

          {formData.is_fine_tuned && (
            <TextInput
              id="base_model"
              labelText="Base Model"
              placeholder="e.g., llama-3.1-8b, mistral-7b"
              value={formData.base_model}
              onChange={(e) => setFormData({ ...formData, base_model: e.target.value })}
            />
          )}

          <h3 style={{ fontWeight: 600, marginTop: '0.5rem' }}>Pricing</h3>

          <div>
            <Dropdown
              id="pricing_type"
              titleText="Pricing Type"
              label="Select pricing type"
              items={pricingTypes}
              itemToString={(item) => item?.text || ''}
              selectedItem={pricingTypes.find(p => p.id === formData.pricing.pricing_type)}
              onChange={({ selectedItem }) => setFormData({
                ...formData,
                pricing: { ...formData.pricing, pricing_type: selectedItem?.id || 'per_token' }
              })}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {pricingTypes.find(p => p.id === formData.pricing.pricing_type)?.description}
            </p>
          </div>

          <TextInput
            id="monthly_price"
            type="number"
            labelText="Monthly Subscription ($)"
            value={String(formData.pricing.monthly_subscription_price)}
            onChange={(e) => setFormData({
              ...formData,
              pricing: { ...formData.pricing, monthly_subscription_price: Number(e.target.value) }
            })}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <TextInput
              id="input_price"
              type="number"
              step="0.0001"
              labelText="Price per 1K Input Tokens ($)"
              value={String(formData.pricing.price_per_1k_input_tokens)}
              onChange={(e) => setFormData({
                ...formData,
                pricing: { ...formData.pricing, price_per_1k_input_tokens: Number(e.target.value) }
              })}
            />
            <TextInput
              id="output_price"
              type="number"
              step="0.0001"
              labelText="Price per 1K Output Tokens ($)"
              value={String(formData.pricing.price_per_1k_output_tokens)}
              onChange={(e) => setFormData({
                ...formData,
                pricing: { ...formData.pricing, price_per_1k_output_tokens: Number(e.target.value) }
              })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <TextInput
              id="price_per_request"
              type="number"
              step="0.01"
              labelText="Price per Request ($)"
              value={String(formData.pricing.price_per_request)}
              onChange={(e) => setFormData({
                ...formData,
                pricing: { ...formData.pricing, price_per_request: Number(e.target.value) }
              })}
            />
            <TextInput
              id="price_per_user"
              type="number"
              step="0.01"
              labelText="Price per User ($)"
              value={String(formData.pricing.price_per_user)}
              onChange={(e) => setFormData({
                ...formData,
                pricing: { ...formData.pricing, price_per_user: Number(e.target.value) }
              })}
            />
          </div>

          <Toggle
            id="is_public"
            labelText="Public (visible in marketplace)"
            toggled={formData.is_public}
            onToggle={(checked) => setFormData({ ...formData, is_public: checked })}
          />
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteConfirm}
        onRequestClose={() => setDeleteConfirm(null)}
        onRequestSubmit={handleDeleteConfirm}
        modalHeading="Delete Model"
        primaryButtonText={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        secondaryButtonText="Cancel"
        danger
        size="sm"
        primaryButtonDisabled={deleteMutation.isPending}
      >
        <p style={{ marginTop: '1rem' }}>
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
        </p>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          This will permanently remove the model and all associated data including subscriptions,
          conversations, and usage records. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
