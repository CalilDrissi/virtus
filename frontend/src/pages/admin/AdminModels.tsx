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
} from '@carbon/react';
import { Add, Edit, TrashCan } from '@carbon/icons-react';
import { modelsApi } from '../../services/api';
import { AIModel } from '../../types';

const categories = [
  { id: 'legal', text: 'Legal' },
  { id: 'healthcare', text: 'Healthcare' },
  { id: 'ecommerce', text: 'E-Commerce' },
  { id: 'customer_support', text: 'Customer Support' },
  { id: 'finance', text: 'Finance' },
  { id: 'education', text: 'Education' },
  { id: 'general', text: 'General' },
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

  const { data: models, isLoading } = useQuery<AIModel[]>({
    queryKey: ['admin-models'],
    queryFn: () => modelsApi.list({ active_only: false }).then(res => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => modelsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-models'] });
      setIsCreateOpen(false);
      setFormData(defaultModel);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) =>
      modelsApi.update(id, data),
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
    },
  });

  const handleEdit = (model: AIModel) => {
    setEditingModel(model);
    setFormData({
      name: model.name,
      description: model.description || '',
      category: model.category,
      provider: model.provider,
      provider_model_id: model.provider_model_id,
      max_tokens: model.max_tokens,
      temperature: Number(model.temperature),
      is_public: model.is_public,
      // Self-hosted configuration
      base_url: (model as any).base_url || '',
      api_key: (model as any).api_key || '',
      is_fine_tuned: (model as any).is_fine_tuned || false,
      base_model: (model as any).base_model || '',
      context_length: (model as any).context_length || 4096,
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
    if (editingModel) {
      updateMutation.mutate({ id: editingModel.id, data: formData });
    } else {
      createMutation.mutate(formData);
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
                <TableCell>{model.category.replace('_', ' ')}</TableCell>
                <TableCell>
                  {model.pricing?.monthly_subscription_price
                    ? `$${model.pricing.monthly_subscription_price}/mo`
                    : model.pricing?.price_per_1k_input_tokens
                    ? `$${model.pricing.price_per_1k_input_tokens}/1K`
                    : 'Free'}
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
                    onClick={() => deleteMutation.mutate(model.id)}
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
              labelText="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Dropdown
              id="category"
              titleText="Category"
              label="Select category"
              items={categories}
              itemToString={(item) => item?.text || ''}
              selectedItem={categories.find(c => c.id === formData.category)}
              onChange={({ selectedItem }) => setFormData({ ...formData, category: selectedItem?.id || 'general' })}
            />
          </div>

          <TextInput
            id="provider_model_id"
            labelText="Model ID"
            placeholder="e.g., my-fine-tuned-llama, gpt-4-custom"
            value={formData.provider_model_id}
            onChange={(e) => setFormData({ ...formData, provider_model_id: e.target.value })}
          />

          <TextArea
            id="description"
            labelText="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          <h3 style={{ fontWeight: 600, marginTop: '0.5rem' }}>Server Configuration</h3>

              <TextInput
                id="base_url"
                labelText="Base URL / API Endpoint"
                placeholder="e.g., http://localhost:11434 or http://your-server:8000/v1"
                value={formData.base_url}
                onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
              />

              <TextInput
                id="api_key"
                type="password"
                labelText="API Key (optional)"
                placeholder="Enter API key if authentication is required"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              />

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <Dropdown
                id="pricing_type"
                titleText="Pricing Type"
                label="Select pricing type"
                items={pricingTypes}
                itemToString={(item) => item?.text || ''}
                itemToElement={(item) => (
                  <div>
                    <div style={{ fontWeight: 500 }}>{item?.text}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item?.description}</div>
                  </div>
                )}
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
          </div>

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
    </div>
  );
}
