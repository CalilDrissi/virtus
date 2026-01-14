import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Tile,
  Button,
  TextInput,
  Modal,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Dropdown,
  Tag,
  TextArea,
} from '@carbon/react';
import { Add, TrashCan, Edit, Code, View } from '@carbon/icons-react';
import { widgetsApi, modelsApi } from '../../services/api';
import { WidgetConfig, AIModel } from '../../types';

const positions = [
  { id: 'bottom-right', text: 'Bottom Right' },
  { id: 'bottom-left', text: 'Bottom Left' },
];

const defaultWidget = {
  name: '',
  model_id: '',
  theme: {
    primaryColor: '#0078d4',
    backgroundColor: '#ffffff',
    textColor: '#333333',
  },
  position: 'bottom-right',
  welcome_message: '',
  placeholder_text: 'Type a message...',
  allowed_domains: '',
  title: 'Chat with AI',
};

export default function WidgetsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);
  const [formData, setFormData] = useState(defaultWidget);

  const { data: widgets, isLoading } = useQuery<WidgetConfig[]>({
    queryKey: ['widgets'],
    queryFn: () => widgetsApi.list().then(res => res.data),
  });

  const { data: models } = useQuery<AIModel[]>({
    queryKey: ['models'],
    queryFn: () => modelsApi.list({ active_only: true }).then(res => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => widgetsApi.create({
      ...data,
      allowed_domains: data.allowed_domains ? data.allowed_domains.split(',').map(d => d.trim()) : [],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      setIsCreateOpen(false);
      setFormData(defaultWidget);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      widgetsApi.update(id, {
        ...data,
        allowed_domains: data.allowed_domains ? data.allowed_domains.split(',').map(d => d.trim()) : [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      setIsCreateOpen(false);
      setEditingWidget(null);
      setFormData(defaultWidget);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => widgetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
    },
  });

  const handleEdit = (widget: WidgetConfig) => {
    setEditingWidget(widget);
    const widgetTheme = widget.theme as { primaryColor?: string; backgroundColor?: string; textColor?: string } || {};
    setFormData({
      name: widget.name,
      model_id: widget.model_id,
      theme: {
        primaryColor: widgetTheme.primaryColor || defaultWidget.theme.primaryColor,
        backgroundColor: widgetTheme.backgroundColor || defaultWidget.theme.backgroundColor,
        textColor: widgetTheme.textColor || defaultWidget.theme.textColor,
      },
      position: widget.position,
      welcome_message: widget.welcome_message || '',
      placeholder_text: widget.placeholder_text,
      allowed_domains: widget.allowed_domains?.join(', ') || '',
      title: widget.title,
    });
    setIsCreateOpen(true);
  };

  const handleSubmit = () => {
    if (editingWidget) {
      updateMutation.mutate({ id: editingWidget.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleClose = () => {
    setIsCreateOpen(false);
    setEditingWidget(null);
    setFormData(defaultWidget);
  };

  const getModelName = (modelId: string) => {
    const model = models?.find(m => m.id === modelId);
    return model?.name || 'Unknown Model';
  };

  return (
    <Tile style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '0.5rem' }}>Chat Widgets</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Create embeddable chat widgets for your websites</p>
        </div>
        <Button kind="primary" renderIcon={Add} onClick={() => setIsCreateOpen(true)}>
          Create Widget
        </Button>
      </div>

      {isLoading ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading...</p>
      ) : widgets && widgets.length > 0 ? (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Name</TableHeader>
              <TableHeader>Model</TableHeader>
              <TableHeader>Position</TableHeader>
              <TableHeader>Domains</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {widgets.map(widget => (
              <TableRow key={widget.id}>
                <TableCell>
                  <div style={{ fontWeight: 600 }}>{widget.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{widget.title}</div>
                </TableCell>
                <TableCell>{getModelName(widget.model_id)}</TableCell>
                <TableCell>
                  <Tag type="outline">{widget.position}</Tag>
                </TableCell>
                <TableCell>
                  {widget.allowed_domains?.length > 0 ? (
                    <span style={{ fontSize: '0.875rem' }}>
                      {widget.allowed_domains.slice(0, 2).join(', ')}
                      {widget.allowed_domains.length > 2 && ` +${widget.allowed_domains.length - 2}`}
                    </span>
                  ) : (
                    <Tag type="green">All domains</Tag>
                  )}
                </TableCell>
                <TableCell>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={Code}
                      hasIconOnly
                      iconDescription="Get Embed Code"
                      onClick={() => navigate(`/settings/widgets/${widget.id}/integrate`)}
                    />
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={View}
                      hasIconOnly
                      iconDescription="Preview"
                      onClick={() => window.open(`/api/v1/widgets/${widget.id}/frame`, '_blank')}
                    />
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={Edit}
                      hasIconOnly
                      iconDescription="Edit"
                      onClick={() => handleEdit(widget)}
                    />
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={TrashCan}
                      hasIconOnly
                      iconDescription="Delete"
                      onClick={() => deleteMutation.mutate(widget.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <p style={{ marginBottom: '1rem' }}>No widgets created yet.</p>
          <p>Create a widget to embed AI chat on your website.</p>
        </div>
      )}

      <Modal
        open={isCreateOpen}
        onRequestClose={handleClose}
        onRequestSubmit={handleSubmit}
        modalHeading={editingWidget ? 'Edit Widget' : 'Create Widget'}
        primaryButtonText={editingWidget ? 'Save Changes' : 'Create Widget'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={!formData.name || !formData.model_id || createMutation.isPending || updateMutation.isPending}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <TextInput
            id="name"
            labelText="Widget Name"
            placeholder="e.g., Support Chat"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <Dropdown
            id="model"
            titleText="AI Model"
            label="Select a model"
            items={models?.map(m => ({ id: m.id, text: m.name })) || []}
            itemToString={(item) => item?.text || ''}
            selectedItem={models?.map(m => ({ id: m.id, text: m.name })).find(m => m.id === formData.model_id)}
            onChange={({ selectedItem }) => setFormData({ ...formData, model_id: selectedItem?.id || '' })}
          />

          <TextInput
            id="title"
            labelText="Widget Title"
            placeholder="Chat with AI"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />

          <TextArea
            id="welcome_message"
            labelText="Welcome Message"
            placeholder="Hi! How can I help you today?"
            value={formData.welcome_message}
            onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
          />

          <TextInput
            id="placeholder"
            labelText="Input Placeholder"
            placeholder="Type a message..."
            value={formData.placeholder_text}
            onChange={(e) => setFormData({ ...formData, placeholder_text: e.target.value })}
          />

          <Dropdown
            id="position"
            titleText="Position"
            label="Select position"
            items={positions}
            itemToString={(item) => item?.text || ''}
            selectedItem={positions.find(p => p.id === formData.position)}
            onChange={({ selectedItem }) => setFormData({ ...formData, position: selectedItem?.id || 'bottom-right' })}
          />

          <h4 style={{ fontWeight: 600, marginTop: '0.5rem' }}>Theme</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <TextInput
              id="primaryColor"
              labelText="Primary Color"
              placeholder="#0078d4"
              value={formData.theme.primaryColor}
              onChange={(e) => setFormData({
                ...formData,
                theme: { ...formData.theme, primaryColor: e.target.value }
              })}
            />
            <TextInput
              id="backgroundColor"
              labelText="Background Color"
              placeholder="#ffffff"
              value={formData.theme.backgroundColor}
              onChange={(e) => setFormData({
                ...formData,
                theme: { ...formData.theme, backgroundColor: e.target.value }
              })}
            />
            <TextInput
              id="textColor"
              labelText="Text Color"
              placeholder="#333333"
              value={formData.theme.textColor}
              onChange={(e) => setFormData({
                ...formData,
                theme: { ...formData.theme, textColor: e.target.value }
              })}
            />
          </div>

          <TextInput
            id="allowed_domains"
            labelText="Allowed Domains"
            placeholder="example.com, *.example.org (leave empty for all domains)"
            helperText="Comma-separated list of domains. Use * as wildcard. Leave empty to allow all."
            value={formData.allowed_domains}
            onChange={(e) => setFormData({ ...formData, allowed_domains: e.target.value })}
          />
        </div>
      </Modal>
    </Tile>
  );
}
