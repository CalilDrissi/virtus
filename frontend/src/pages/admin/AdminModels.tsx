import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  makeStyles,
  tokens,
  Card,
  Text,
  Button,
  Input,
  Dropdown,
  Option,
  Badge,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Spinner,
  Switch,
  Textarea,
} from '@fluentui/react-components';
import { Add24Regular, Edit24Regular, Delete24Regular } from '@fluentui/react-icons';
import { modelsApi } from '../../services/api';
import { AIModel } from '../../types';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalM,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
});

const providers = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'vllm', label: 'vLLM' },
];

const categories = [
  { value: 'legal', label: 'Legal' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'customer_support', label: 'Customer Support' },
  { value: 'finance', label: 'Finance' },
  { value: 'education', label: 'Education' },
  { value: 'general', label: 'General' },
];

const pricingTypes = [
  { value: 'per_token', label: 'Per Token' },
  { value: 'per_request', label: 'Per Request' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'hybrid', label: 'Hybrid' },
];

const defaultModel = {
  name: '',
  description: '',
  category: 'general',
  provider: 'openai',
  provider_model_id: '',
  system_prompt: '',
  max_tokens: 4096,
  temperature: 0.7,
  is_public: true,
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
  const styles = useStyles();
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
      system_prompt: model.system_prompt || '',
      max_tokens: model.max_tokens,
      temperature: Number(model.temperature),
      is_public: model.is_public,
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
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Spinner size="large" label="Loading models..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Text size={700} weight="semibold" block>AI Models</Text>
          <Text style={{ color: tokens.colorNeutralForeground3 }}>
            Configure and manage your AI model catalog
          </Text>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(_, data) => {
          if (!data.open) handleClose();
          else setIsCreateOpen(true);
        }}>
          <DialogTrigger>
            <Button appearance="primary" icon={<Add24Regular />}>
              Add Model
            </Button>
          </DialogTrigger>
          <DialogSurface style={{ maxWidth: '700px' }}>
            <DialogTitle>{editingModel ? 'Edit Model' : 'Add New Model'}</DialogTitle>
            <DialogBody>
              <DialogContent>
                <div className={styles.form}>
                  <div className={styles.formRow}>
                    <div className={styles.field}>
                      <Text weight="semibold">Name</Text>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className={styles.field}>
                      <Text weight="semibold">Provider</Text>
                      <Dropdown
                        value={providers.find(p => p.value === formData.provider)?.label}
                        onOptionSelect={(_, data) => setFormData({ ...formData, provider: data.optionValue as string })}
                      >
                        {providers.map(p => <Option key={p.value} value={p.value}>{p.label}</Option>)}
                      </Dropdown>
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.field}>
                      <Text weight="semibold">Provider Model ID</Text>
                      <Input
                        placeholder="e.g., gpt-4, claude-3-opus"
                        value={formData.provider_model_id}
                        onChange={(e) => setFormData({ ...formData, provider_model_id: e.target.value })}
                      />
                    </div>
                    <div className={styles.field}>
                      <Text weight="semibold">Category</Text>
                      <Dropdown
                        value={categories.find(c => c.value === formData.category)?.label}
                        onOptionSelect={(_, data) => setFormData({ ...formData, category: data.optionValue as string })}
                      >
                        {categories.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
                      </Dropdown>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <Text weight="semibold">Description</Text>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className={styles.field}>
                    <Text weight="semibold">System Prompt</Text>
                    <Textarea
                      placeholder="Default system prompt for this model"
                      value={formData.system_prompt}
                      onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                    />
                  </div>

                  <Text size={500} weight="semibold" style={{ marginTop: tokens.spacingVerticalM }}>Pricing</Text>

                  <div className={styles.formRow}>
                    <div className={styles.field}>
                      <Text weight="semibold">Pricing Type</Text>
                      <Dropdown
                        value={pricingTypes.find(p => p.value === formData.pricing.pricing_type)?.label}
                        onOptionSelect={(_, data) => setFormData({
                          ...formData,
                          pricing: { ...formData.pricing, pricing_type: data.optionValue as string }
                        })}
                      >
                        {pricingTypes.map(p => <Option key={p.value} value={p.value}>{p.label}</Option>)}
                      </Dropdown>
                    </div>
                    <div className={styles.field}>
                      <Text weight="semibold">Monthly Subscription ($)</Text>
                      <Input
                        type="number"
                        value={String(formData.pricing.monthly_subscription_price)}
                        onChange={(e) => setFormData({
                          ...formData,
                          pricing: { ...formData.pricing, monthly_subscription_price: Number(e.target.value) }
                        })}
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.field}>
                      <Text weight="semibold">Price per 1K Input Tokens ($)</Text>
                      <Input
                        type="number"
                        step="0.0001"
                        value={String(formData.pricing.price_per_1k_input_tokens)}
                        onChange={(e) => setFormData({
                          ...formData,
                          pricing: { ...formData.pricing, price_per_1k_input_tokens: Number(e.target.value) }
                        })}
                      />
                    </div>
                    <div className={styles.field}>
                      <Text weight="semibold">Price per 1K Output Tokens ($)</Text>
                      <Input
                        type="number"
                        step="0.0001"
                        value={String(formData.pricing.price_per_1k_output_tokens)}
                        onChange={(e) => setFormData({
                          ...formData,
                          pricing: { ...formData.pricing, price_per_1k_output_tokens: Number(e.target.value) }
                        })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM }}>
                    <Switch
                      checked={formData.is_public}
                      onChange={(_, data) => setFormData({ ...formData, is_public: data.checked })}
                    />
                    <Text>Public (visible in marketplace)</Text>
                  </div>
                </div>
              </DialogContent>
            </DialogBody>
            <DialogActions>
              <Button appearance="secondary" onClick={handleClose}>Cancel</Button>
              <Button
                appearance="primary"
                onClick={handleSubmit}
                disabled={!formData.name || !formData.provider_model_id || createMutation.isPending || updateMutation.isPending}
              >
                {editingModel ? 'Save Changes' : 'Create Model'}
              </Button>
            </DialogActions>
          </DialogSurface>
        </Dialog>
      </div>

      <Card style={{ padding: tokens.spacingVerticalL }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Provider</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell>Pricing</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models?.map(model => (
              <TableRow key={model.id}>
                <TableCell>
                  <Text weight="semibold">{model.name}</Text>
                  <Text size={200} block style={{ color: tokens.colorNeutralForeground3 }}>
                    {model.provider_model_id}
                  </Text>
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
                  <Badge color={model.is_active ? 'success' : 'danger'}>
                    {model.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    appearance="subtle"
                    icon={<Edit24Regular />}
                    onClick={() => handleEdit(model)}
                  />
                  <Button
                    appearance="subtle"
                    icon={<Delete24Regular />}
                    onClick={() => deleteMutation.mutate(model.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
