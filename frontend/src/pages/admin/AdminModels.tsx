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
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  FileUploaderDropContainer,
  FileUploaderItem,
  InlineNotification,
} from '@carbon/react';
import { Add, Edit, TrashCan, Upload } from '@carbon/icons-react';
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
  { id: 'subscription', text: 'Subscription', description: 'Fixed monthly fee with included usage' },
];

const sourceTypes = [
  { id: 'document', text: 'Documents' },
  { id: 'website', text: 'Website' },
  { id: 'database', text: 'Database' },
  { id: 'api', text: 'API' },
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
  const [activeTab, setActiveTab] = useState(0);

  // Data source state
  const [newDataSource, setNewDataSource] = useState({ name: '', description: '', type: 'document' });
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [uploadingToSource, setUploadingToSource] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: models, isLoading } = useQuery<AIModel[]>({
    queryKey: ['admin-models'],
    queryFn: () => modelsApi.list({ active_only: false }).then(res => res.data),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list({ active_only: false }).then(res => res.data),
  });

  // Fetch data sources for editing model
  const { data: modelDataSources, refetch: refetchDataSources } = useQuery<DataSource[]>({
    queryKey: ['model-data-sources', editingModel?.id],
    queryFn: () => editingModel ? dataSourcesApi.listForModel(editingModel.id).then(res => res.data) : Promise.resolve([]),
    enabled: !!editingModel?.id,
  });

  const categoryItems = categories?.map(c => ({ id: c.slug, text: c.name })) || [
    { id: 'general', text: 'General' }
  ];

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await modelsApi.create(data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-models'] });
      setIsCreateOpen(false);
      setFormData(defaultModel);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const response = await modelsApi.update(id, data);
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

  // Data source mutations
  const createDataSourceMutation = useMutation({
    mutationFn: async ({ modelId, data, files }: { modelId: string; data: typeof newDataSource; files: File[] }) => {
      const response = await dataSourcesApi.createForModel(modelId, data);
      const createdSource = response.data;

      // Upload files if any
      if (files.length > 0 && data.type === 'document') {
        for (const file of files) {
          await dataSourcesApi.uploadDocument(modelId, createdSource.id, file);
        }
      }
      return response;
    },
    onSuccess: () => {
      refetchDataSources();
      setNewDataSource({ name: '', description: '', type: 'document' });
      setFilesToUpload([]);
      setUploadError(null);
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      setUploadError(err.response?.data?.detail || err.message || 'Failed to create data source');
    },
  });

  const deleteDataSourceMutation = useMutation({
    mutationFn: ({ modelId, dataSourceId }: { modelId: string; dataSourceId: string }) =>
      dataSourcesApi.deleteForModel(modelId, dataSourceId),
    onSuccess: () => {
      refetchDataSources();
    },
  });

  const uploadToExistingMutation = useMutation({
    mutationFn: async ({ modelId, dataSourceId, file }: { modelId: string; dataSourceId: string; file: File }) => {
      return dataSourcesApi.uploadDocument(modelId, dataSourceId, file);
    },
    onSuccess: () => {
      refetchDataSources();
      setUploadingToSource(null);
    },
  });

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm.id);
    }
  };

  const handleEdit = (model: AIModel) => {
    setEditingModel(model);
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
      base_url: providerConfig.base_url || '',
      api_key: providerConfig.api_key || '',
      is_fine_tuned: (model as any).is_fine_tuned || false,
      base_model: (model as any).base_model || '',
      context_length: (model as any).context_length || 4096,
      pricing: model.pricing ? {
        pricing_type: model.pricing.pricing_type,
        price_per_1k_input_tokens: model.pricing.price_per_1k_input_tokens,
        price_per_1k_output_tokens: model.pricing.price_per_1k_output_tokens,
        price_per_request: model.pricing.price_per_request,
        monthly_subscription_price: model.pricing.monthly_subscription_price,
        included_tokens: model.pricing.included_tokens,
        included_requests: model.pricing.included_requests,
      } : defaultModel.pricing,
    });
    setActiveTab(0);
    setIsCreateOpen(true);
  };

  const handleSubmit = () => {
    const provider_config: Record<string, string> = {};
    if (formData.base_url) provider_config.base_url = formData.base_url;
    if (formData.api_key) provider_config.api_key = formData.api_key;

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
      updateMutation.mutate({ id: editingModel.id, data: payload });
    } else {
      createMutation.mutate(payload as any);
    }
  };

  const handleClose = () => {
    setIsCreateOpen(false);
    setEditingModel(null);
    setFormData(defaultModel);
    setActiveTab(0);
    setNewDataSource({ name: '', description: '', type: 'document' });
    setFilesToUpload([]);
    setUploadError(null);
  };

  const handleCreateDataSource = () => {
    if (!editingModel || !newDataSource.name) return;
    createDataSourceMutation.mutate({
      modelId: editingModel.id,
      data: newDataSource,
      files: filesToUpload,
    });
  };

  const handleDrop = (_e: unknown, { addedFiles }: { addedFiles: File[] }) => {
    setFilesToUpload(prev => [...prev, ...addedFiles]);
  };

  const handleUploadToExisting = (dataSourceId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.txt,.html';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && editingModel) {
        setUploadingToSource(dataSourceId);
        uploadToExistingMutation.mutate({
          modelId: editingModel.id,
          dataSourceId,
          file,
        });
      }
    };
    input.click();
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
                    <Tag type="blue">{model.data_sources.length} sources</Tag>
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

      {/* Create/Edit Modal */}
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
        <Tabs selectedIndex={activeTab} onChange={({ selectedIndex }) => setActiveTab(selectedIndex)}>
          <TabList aria-label="Model configuration tabs">
            <Tab>Configuration</Tab>
            <Tab disabled={!editingModel}>Data Sources</Tab>
          </TabList>
          <TabPanels>
            {/* Configuration Tab */}
            <TabPanel>
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

                <Dropdown
                  id="provider"
                  titleText="Provider"
                  label="Select provider"
                  items={providers}
                  itemToString={(item) => item?.text || ''}
                  selectedItem={providers.find(p => p.id === formData.provider)}
                  onChange={({ selectedItem }) => setFormData({ ...formData, provider: selectedItem?.id || 'custom' })}
                />

                <TextInput
                  id="provider_model_id"
                  labelText="Model ID"
                  placeholder="e.g., gpt-4, claude-3-opus"
                  value={formData.provider_model_id}
                  onChange={(e) => setFormData({ ...formData, provider_model_id: e.target.value })}
                />

                <TextArea
                  id="description"
                  labelText="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />

                {(formData.provider === 'custom' || formData.provider === 'ollama' || formData.provider === 'vllm') && (
                  <TextInput
                    id="base_url"
                    labelText="Base URL / API Endpoint"
                    placeholder="e.g., http://localhost:11434"
                    value={formData.base_url}
                    onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  />
                )}

                {(formData.provider === 'openai' || formData.provider === 'anthropic' || formData.provider === 'custom') && (
                  <TextInput
                    id="api_key"
                    type="password"
                    labelText="API Key"
                    placeholder="Enter API key"
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  />
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <TextInput
                    id="context_length"
                    type="number"
                    labelText="Context Length"
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

                <h4 style={{ fontWeight: 600, marginTop: '0.5rem' }}>Pricing</h4>

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

                <Toggle
                  id="is_public"
                  labelText="Public (visible in marketplace)"
                  toggled={formData.is_public}
                  onToggle={(checked) => setFormData({ ...formData, is_public: checked })}
                />
              </div>
            </TabPanel>

            {/* Data Sources Tab */}
            <TabPanel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                {/* Create new data source */}
                <Tile style={{ padding: '1rem' }}>
                  <h4 style={{ fontWeight: 600, marginBottom: '1rem' }}>Add Data Source</h4>

                  {uploadError && (
                    <InlineNotification
                      kind="error"
                      title="Error"
                      subtitle={uploadError}
                      lowContrast
                      hideCloseButton
                      style={{ marginBottom: '1rem' }}
                    />
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <TextInput
                        id="ds-name"
                        labelText="Name"
                        placeholder="e.g., Product Documentation"
                        value={newDataSource.name}
                        onChange={(e) => setNewDataSource({ ...newDataSource, name: e.target.value })}
                      />
                      <Dropdown
                        id="ds-type"
                        titleText="Type"
                        label="Select type"
                        items={sourceTypes}
                        itemToString={(item) => item?.text || ''}
                        selectedItem={sourceTypes.find(t => t.id === newDataSource.type)}
                        onChange={({ selectedItem }) => setNewDataSource({ ...newDataSource, type: selectedItem?.id || 'document' })}
                      />
                    </div>

                    <TextInput
                      id="ds-description"
                      labelText="Description (optional)"
                      placeholder="Brief description"
                      value={newDataSource.description}
                      onChange={(e) => setNewDataSource({ ...newDataSource, description: e.target.value })}
                    />

                    {newDataSource.type === 'document' && (
                      <>
                        <FileUploaderDropContainer
                          accept={['.pdf', '.doc', '.docx', '.txt', '.html']}
                          labelText="Drag and drop files here or click to upload"
                          multiple
                          onAddFiles={handleDrop}
                        />
                        {filesToUpload.length > 0 && (
                          <div>
                            {filesToUpload.map((file, index) => (
                              <FileUploaderItem
                                key={index}
                                name={file.name}
                                status="edit"
                                onDelete={() => setFilesToUpload(prev => prev.filter((_, i) => i !== index))}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    <Button
                      kind="primary"
                      size="sm"
                      onClick={handleCreateDataSource}
                      disabled={!newDataSource.name || createDataSourceMutation.isPending}
                    >
                      {createDataSourceMutation.isPending ? 'Creating...' : 'Add Data Source'}
                    </Button>
                  </div>
                </Tile>

                {/* Existing data sources */}
                <div>
                  <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Existing Data Sources</h4>
                  {modelDataSources?.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      No data sources yet. Add one above.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {modelDataSources?.map(ds => (
                        <Tile key={ds.id} style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{ds.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {ds.type} • {ds.document_count || 0} documents • {ds.status}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {ds.type === 'document' && (
                                <Button
                                  kind="ghost"
                                  size="sm"
                                  renderIcon={Upload}
                                  onClick={() => handleUploadToExisting(ds.id)}
                                  disabled={uploadingToSource === ds.id}
                                >
                                  {uploadingToSource === ds.id ? 'Uploading...' : 'Upload'}
                                </Button>
                              )}
                              <Button
                                kind="danger--ghost"
                                size="sm"
                                renderIcon={TrashCan}
                                hasIconOnly
                                iconDescription="Delete"
                                onClick={() => editingModel && deleteDataSourceMutation.mutate({
                                  modelId: editingModel.id,
                                  dataSourceId: ds.id
                                })}
                              />
                            </div>
                          </div>
                        </Tile>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
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
          This will permanently remove the model, its data sources, and all associated data.
        </p>
      </Modal>
    </div>
  );
}
