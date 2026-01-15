import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tile,
  Button,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  TextInput,
  TextArea,
  Loading,
  Tag,
  InlineNotification,
  Modal,
  Dropdown,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import {
  ArrowLeft,
  SendAlt,
  Bot,
  Add,
  TrashCan,
  DataBase,
  Chat,
  Information,
  Code,
  Edit,
  Copy,
  Checkmark,
  Key,
  Upload,
} from '@carbon/icons-react';
import { subscriptionsApi, chatApi, widgetsApi } from '../../services/api';
import { Subscription, WidgetConfig, APIKey, DataSource } from '../../types';
import CreateDataSourceModal from '../../components/common/CreateDataSourceModal';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function SubscriptionDetailPage() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Widget state
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);
  const [widgetForm, setWidgetForm] = useState({
    name: '',
    title: 'Chat with AI',
    welcome_message: '',
    placeholder_text: 'Type a message...',
    position: 'bottom-right',
    theme: {
      primaryColor: '#0078d4',
      backgroundColor: '#ffffff',
      textColor: '#333333',
    },
    allowed_domains: '',
  });
  const [showEmbedCode, setShowEmbedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Data Source state
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState(false);
  const [uploadingToSource, setUploadingToSource] = useState<string | null>(null);
  const [dsError, setDsError] = useState<string | null>(null);

  // API Key state
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Fetch subscription details
  const { data: subscription, isLoading: subLoading } = useQuery<Subscription>({
    queryKey: ['subscription', subscriptionId],
    queryFn: () => subscriptionsApi.get(subscriptionId!).then(res => res.data),
    enabled: !!subscriptionId,
  });

  // Fetch widgets for this model
  const { data: widgets, isLoading: widgetsLoading } = useQuery<WidgetConfig[]>({
    queryKey: ['widgets'],
    queryFn: () => widgetsApi.list().then(res => res.data),
  });

  // Fetch API keys for this subscription
  const { data: apiKeys, isLoading: apiKeysLoading } = useQuery<APIKey[]>({
    queryKey: ['subscription-api-keys', subscriptionId],
    queryFn: () => subscriptionsApi.listApiKeys(subscriptionId!).then(res => res.data),
    enabled: !!subscriptionId,
  });

  // Fetch data sources for this subscription
  const { data: allDataSources, isLoading: dsLoading, refetch: refetchDataSources } = useQuery<DataSource[]>({
    queryKey: ['subscription-data-sources', subscriptionId],
    queryFn: () => subscriptionsApi.listDataSources(subscriptionId!).then(res => res.data),
    enabled: !!subscriptionId,
  });

  // Separate model data sources from user's data sources
  const modelDataSources = allDataSources?.filter(ds => !ds.subscription_id) || [];
  const userDataSources = allDataSources?.filter(ds => ds.subscription_id) || [];

  // Filter widgets for this model
  const modelWidgets = widgets?.filter(w => w.model_id === subscription?.model_id) || [];

  // Widget mutations
  const createWidgetMutation = useMutation({
    mutationFn: (data: typeof widgetForm & { model_id: string }) => widgetsApi.create({
      ...data,
      allowed_domains: data.allowed_domains ? data.allowed_domains.split(',').map(d => d.trim()) : [],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      setIsWidgetModalOpen(false);
      resetWidgetForm();
    },
  });

  const updateWidgetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof widgetForm }) =>
      widgetsApi.update(id, {
        ...data,
        allowed_domains: data.allowed_domains ? data.allowed_domains.split(',').map(d => d.trim()) : [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
      setIsWidgetModalOpen(false);
      setEditingWidget(null);
      resetWidgetForm();
    },
  });

  const deleteWidgetMutation = useMutation({
    mutationFn: (id: string) => widgetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets'] });
    },
  });

  // API Key mutations
  const createApiKeyMutation = useMutation({
    mutationFn: (data: { name: string }) =>
      subscriptionsApi.createApiKey(subscriptionId!, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['subscription-api-keys', subscriptionId] });
      setCreatedKey(response.data.key);
      setNewKeyName('');
    },
  });

  const revokeApiKeyMutation = useMutation({
    mutationFn: (keyId: string) => subscriptionsApi.revokeApiKey(subscriptionId!, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-api-keys', subscriptionId] });
    },
  });

  // Data source mutations
  const createDataSourceMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; type: string; config?: Record<string, unknown>; files?: File[] }) => {
      const response = await subscriptionsApi.createDataSource(subscriptionId!, {
        name: data.name,
        description: data.description,
        type: data.type,
        config: data.config,
      });
      const createdSource = response.data;

      // Upload files if any (for document type)
      if (data.files && data.files.length > 0 && data.type === 'document') {
        for (const file of data.files) {
          await subscriptionsApi.uploadDocument(subscriptionId!, createdSource.id, file);
        }
      }
      return response;
    },
    onSuccess: () => {
      refetchDataSources();
      setIsDataSourceModalOpen(false);
      setDsError(null);
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      setDsError(err.response?.data?.detail || err.message || 'Failed to create data source');
    },
  });

  const deleteDataSourceMutation = useMutation({
    mutationFn: (dataSourceId: string) =>
      subscriptionsApi.deleteDataSource(subscriptionId!, dataSourceId),
    onSuccess: () => {
      refetchDataSources();
    },
  });

  const uploadToExistingMutation = useMutation({
    mutationFn: async ({ dataSourceId, file }: { dataSourceId: string; file: File }) => {
      return subscriptionsApi.uploadDocument(subscriptionId!, dataSourceId, file);
    },
    onSuccess: () => {
      refetchDataSources();
      setUploadingToSource(null);
    },
  });

  const handleUploadToExisting = (dataSourceId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.txt,.html';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setUploadingToSource(dataSourceId);
        uploadToExistingMutation.mutate({ dataSourceId, file });
      }
    };
    input.click();
  };

  const resetWidgetForm = () => {
    setWidgetForm({
      name: '',
      title: 'Chat with AI',
      welcome_message: '',
      placeholder_text: 'Type a message...',
      position: 'bottom-right',
      theme: {
        primaryColor: '#0078d4',
        backgroundColor: '#ffffff',
        textColor: '#333333',
      },
      allowed_domains: '',
    });
  };

  const handleEditWidget = (widget: WidgetConfig) => {
    setEditingWidget(widget);
    const widgetTheme = widget.theme as { primaryColor?: string; backgroundColor?: string; textColor?: string } || {};
    setWidgetForm({
      name: widget.name,
      title: widget.title,
      welcome_message: widget.welcome_message || '',
      placeholder_text: widget.placeholder_text,
      position: widget.position,
      theme: {
        primaryColor: widgetTheme.primaryColor || '#0078d4',
        backgroundColor: widgetTheme.backgroundColor || '#ffffff',
        textColor: widgetTheme.textColor || '#333333',
      },
      allowed_domains: widget.allowed_domains?.join(', ') || '',
    });
    setIsWidgetModalOpen(true);
  };

  const handleWidgetSubmit = () => {
    if (editingWidget) {
      updateWidgetMutation.mutate({ id: editingWidget.id, data: widgetForm });
    } else if (subscription?.model_id) {
      createWidgetMutation.mutate({ ...widgetForm, model_id: subscription.model_id });
    }
  };

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Chat functions
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !subscription?.model_id || isStreaming) return;

    const userMessage: Message = { role: 'user', content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);

    // Get linked data source IDs (model's + subscription's)
    const modelDataSourceIds = subscription.model?.data_sources?.map(ds => ds.id) || [];
    const subscriptionDataSourceIds = subscription.data_sources?.map(ds => ds.id) || [];
    const allLinkedIds = [...new Set([...modelDataSourceIds, ...subscriptionDataSourceIds])];

    try {
      const response = await chatApi.complete({
        model_id: subscription.model_id,
        messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        use_rag: allLinkedIds.length > 0,
        data_source_ids: allLinkedIds.length > 0 ? allLinkedIds : undefined,
        stream: false,
      });

      setMessages([...updatedMessages, {
        role: 'assistant',
        content: response.data.content,
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([...updatedMessages, {
        role: 'assistant',
        content: 'Sorry, an error occurred. Please try again.',
      }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (subLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading subscription..." withOverlay={false} />
      </div>
    );
  }

  if (!subscription) {
    return (
      <Tile style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Subscription not found</p>
        <Button kind="ghost" onClick={() => navigate('/')} style={{ marginTop: '1rem' }}>
          Back to Dashboard
        </Button>
      </Tile>
    );
  }

  const model = subscription.model;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 96px)' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <Button
          kind="ghost"
          renderIcon={ArrowLeft}
          onClick={() => navigate('/')}
          style={{ marginBottom: '0.5rem' }}
        >
          Back to Dashboard
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '8px',
            backgroundColor: 'var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 600,
            color: 'var(--brand-primary)',
          }}>
            {model?.icon_url ? (
              <img src={model.icon_url} alt={model.name} style={{ width: '100%', height: '100%', borderRadius: '8px' }} />
            ) : (
              model?.name?.charAt(0).toUpperCase() || 'M'
            )}
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 400, margin: 0 }}>{model?.name || 'Unknown Model'}</h1>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <Tag type="green">Active</Tag>
              <Tag type="outline">{model?.category?.replace('_', ' ')}</Tag>
              <Tag type="blue">{model?.provider}</Tag>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs>
        <TabList aria-label="Subscription tabs">
          <Tab renderIcon={Chat}>Chat</Tab>
          <Tab renderIcon={DataBase}>Data Sources</Tab>
          <Tab renderIcon={Code}>Widgets</Tab>
          <Tab renderIcon={Key}>API Keys</Tab>
          <Tab renderIcon={Information}>Info</Tab>
        </TabList>
        <TabPanels>
          {/* Chat Tab */}
          <TabPanel style={{ padding: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 280px)' }}>
              <Tile style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {messages.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                      <Bot size={48} />
                      <p style={{ marginTop: '1rem' }}>Start a conversation with {model?.name}</p>
                      {((subscription.data_sources?.length || 0) > 0 || (model?.data_sources?.length || 0) > 0) && (
                        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                          RAG enabled with {(subscription.data_sources?.length || 0) + (model?.data_sources?.length || 0)} data source(s)
                        </p>
                      )}
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          gap: '0.75rem',
                          maxWidth: '80%',
                          alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                          flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                        }}
                      >
                        {message.role === 'assistant' && (
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--brand-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <Bot size={16} style={{ color: 'var(--white)' }} />
                          </div>
                        )}
                        <div style={{
                          padding: '0.75rem 1rem',
                          borderRadius: '1rem',
                          backgroundColor: message.role === 'user' ? 'var(--brand-primary)' : 'var(--border-subtle)',
                          color: message.role === 'user' ? 'var(--white)' : 'var(--text-primary)',
                        }}>
                          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
                        </div>
                      </div>
                    ))
                  )}
                  {isStreaming && (
                    <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-start' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--brand-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Bot size={16} style={{ color: 'var(--white)' }} />
                      </div>
                      <div style={{ padding: '0.75rem 1rem', borderRadius: '1rem', backgroundColor: 'var(--border-subtle)' }}>
                        <Loading small withOverlay={false} />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <TextInput
                    id="chat-input"
                    labelText=""
                    placeholder="Type your message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isStreaming}
                    style={{ flex: 1 }}
                  />
                  <Button
                    kind="primary"
                    renderIcon={SendAlt}
                    onClick={sendMessage}
                    disabled={!input.trim() || isStreaming}
                  >
                    Send
                  </Button>
                </div>
              </Tile>
            </div>
          </TabPanel>

          {/* Data Sources Tab */}
          <TabPanel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingTop: '1rem' }}>
              {/* Model's default data sources */}
              {modelDataSources.length > 0 && (
                <Tile style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Model's Knowledge Base
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    These data sources are included with the model by default.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {modelDataSources.map(ds => (
                      <Tile key={ds.id} style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <DataBase size={20} />
                          </div>
                          <div>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>{ds.name}</h4>
                            {ds.description && (
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {ds.description}
                              </p>
                            )}
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <Tag type="blue" size="sm">{ds.type}</Tag>
                              <Tag type="outline" size="sm">Model Default</Tag>
                              {ds.document_count !== undefined && ds.document_count > 0 && (
                                <Tag type="gray" size="sm">{ds.document_count} docs</Tag>
                              )}
                            </div>
                          </div>
                        </div>
                      </Tile>
                    ))}
                  </div>
                </Tile>
              )}

              {/* Add your own data source */}
              <Tile style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                      Add Your Own Data Source
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Upload documents, connect databases, APIs, or websites to enhance the AI's responses with your custom knowledge.
                    </p>
                  </div>
                  <Button
                    kind="primary"
                    size="sm"
                    renderIcon={Add}
                    onClick={() => setIsDataSourceModalOpen(true)}
                  >
                    Add Data Source
                  </Button>
                </div>

                {dsError && (
                  <InlineNotification
                    kind="error"
                    title="Error"
                    subtitle={dsError}
                    lowContrast
                    hideCloseButton
                    style={{ marginTop: '1rem' }}
                  />
                )}
              </Tile>

              {/* User's data sources */}
              {dsLoading ? (
                <Loading small withOverlay={false} />
              ) : userDataSources.length > 0 && (
                <Tile style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
                    Your Data Sources
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {userDataSources.map(ds => (
                      <Tile key={ds.id} style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              <DataBase size={20} />
                            </div>
                            <div>
                              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>{ds.name}</h4>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <Tag type="teal" size="sm">{ds.type}</Tag>
                                <Tag type="purple" size="sm">Your Data</Tag>
                                {ds.document_count !== undefined && ds.document_count > 0 && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    {ds.document_count} document(s)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {ds.type === 'document' && (
                              <Button
                                kind="tertiary"
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
                              onClick={() => deleteDataSourceMutation.mutate(ds.id)}
                            />
                          </div>
                        </div>
                      </Tile>
                    ))}
                  </div>
                </Tile>
              )}

              {/* Empty state */}
              {!dsLoading && modelDataSources.length === 0 && userDataSources.length === 0 && (
                <Tile style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--bg-primary)' }}>
                  <DataBase size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>
                    No data sources configured yet. Add your own data sources above to enhance the AI's responses.
                  </p>
                </Tile>
              )}
            </div>
          </TabPanel>

          {/* Widgets Tab */}
          <TabPanel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Chat Widgets</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Create embeddable chat widgets for your website
                  </p>
                </div>
                <Button
                  kind="primary"
                  size="sm"
                  renderIcon={Add}
                  onClick={() => {
                    resetWidgetForm();
                    setEditingWidget(null);
                    setIsWidgetModalOpen(true);
                  }}
                >
                  Create Widget
                </Button>
              </div>

              {widgetsLoading ? (
                <Loading small withOverlay={false} />
              ) : modelWidgets.length === 0 ? (
                <Tile style={{ padding: '2rem', textAlign: 'center' }}>
                  <Code size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    No widgets created yet. Create a widget to embed this AI model on your website.
                  </p>
                  <Button
                    kind="tertiary"
                    renderIcon={Add}
                    onClick={() => {
                      resetWidgetForm();
                      setEditingWidget(null);
                      setIsWidgetModalOpen(true);
                    }}
                  >
                    Create Your First Widget
                  </Button>
                </Tile>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
                  {modelWidgets.map(widget => (
                    <Tile key={widget.id} style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            backgroundColor: (widget.theme as { primaryColor?: string })?.primaryColor || '#0078d4',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <Chat size={20} style={{ color: '#fff' }} />
                          </div>
                          <div>
                            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>{widget.name}</h4>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {widget.title}
                            </p>
                          </div>
                        </div>
                        <Tag type={widget.is_active ? 'green' : 'gray'} size="sm">
                          {widget.is_active ? 'Active' : 'Inactive'}
                        </Tag>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span>Position: {widget.position}</span>
                        {widget.allowed_domains && widget.allowed_domains.length > 0 && (
                          <span>• {widget.allowed_domains.length} domain(s)</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button
                          kind="tertiary"
                          size="sm"
                          renderIcon={Code}
                          onClick={() => setShowEmbedCode(widget.id)}
                        >
                          Get Code
                        </Button>
                        <Button
                          kind="ghost"
                          size="sm"
                          renderIcon={Edit}
                          hasIconOnly
                          iconDescription="Edit"
                          onClick={() => handleEditWidget(widget)}
                        />
                        <Button
                          kind="ghost"
                          size="sm"
                          renderIcon={TrashCan}
                          hasIconOnly
                          iconDescription="Delete"
                          onClick={() => deleteWidgetMutation.mutate(widget.id)}
                        />
                      </div>
                    </Tile>
                  ))}
                </div>
              )}
            </div>
          </TabPanel>

          {/* API Keys Tab */}
          <TabPanel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>API Keys</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Create API keys to access this model programmatically
                  </p>
                </div>
                <Button
                  kind="primary"
                  size="sm"
                  renderIcon={Add}
                  onClick={() => {
                    setNewKeyName('');
                    setCreatedKey(null);
                    setIsApiKeyModalOpen(true);
                  }}
                >
                  Create API Key
                </Button>
              </div>

              {apiKeysLoading ? (
                <Loading small withOverlay={false} />
              ) : apiKeys && apiKeys.length > 0 ? (
                <Tile style={{ padding: '1.5rem' }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>Name</TableHeader>
                        <TableHeader>Key</TableHeader>
                        <TableHeader>Status</TableHeader>
                        <TableHeader>Last Used</TableHeader>
                        <TableHeader>Actions</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {apiKeys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell>{key.name}</TableCell>
                          <TableCell style={{ fontFamily: 'monospace' }}>{key.key_prefix}...</TableCell>
                          <TableCell>
                            <Tag type={key.is_active ? 'green' : 'red'}>
                              {key.is_active ? 'Active' : 'Revoked'}
                            </Tag>
                          </TableCell>
                          <TableCell>
                            {key.last_used_at
                              ? new Date(key.last_used_at).toLocaleDateString()
                              : 'Never'}
                          </TableCell>
                          <TableCell>
                            {key.is_active && (
                              <Button
                                kind="ghost"
                                size="sm"
                                renderIcon={TrashCan}
                                hasIconOnly
                                iconDescription="Revoke"
                                onClick={() => revokeApiKeyMutation.mutate(key.id)}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Tile>
              ) : (
                <Tile style={{ padding: '2rem', textAlign: 'center' }}>
                  <Key size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    No API keys yet. Create one to access this model via the REST API.
                  </p>
                  <Button
                    kind="tertiary"
                    renderIcon={Add}
                    onClick={() => {
                      setNewKeyName('');
                      setCreatedKey(null);
                      setIsApiKeyModalOpen(true);
                    }}
                  >
                    Create Your First API Key
                  </Button>
                </Tile>
              )}

              <Tile style={{ padding: '1.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  API Usage Example
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Use your API key to authenticate requests to the chat API:
                </p>
                <pre style={{
                  backgroundColor: 'var(--layer-01)',
                  padding: '1rem',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '0.75rem',
                }}>
{`curl -X POST ${window.location.origin}/api/v1/chat/completions \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_id": "${subscription?.model_id}",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`}
                </pre>
              </Tile>
            </div>
          </TabPanel>

          {/* Info Tab */}
          <TabPanel>
            <div style={{ paddingTop: '1rem' }}>
              <Tile style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Subscription Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                    <Tag type="green">{subscription.status}</Tag>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Created</span>
                    <span>{new Date(subscription.created_at).toLocaleDateString()}</span>
                  </div>
                  {subscription.current_period_end && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Period End</span>
                      <span>{new Date(subscription.current_period_end).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </Tile>

              <Tile style={{ padding: '1.5rem', marginTop: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Model Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>{model?.description || 'No description'}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Provider</span>
                    <span>{model?.provider}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Category</span>
                    <span>{model?.category?.replace('_', ' ')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Max Tokens</span>
                    <span>{model?.max_tokens?.toLocaleString()}</span>
                  </div>
                </div>
              </Tile>

              {model?.pricing && (
                <Tile style={{ padding: '1.5rem', marginTop: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Pricing</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {Number(model.pricing.monthly_subscription_price) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Monthly</span>
                        <span>${Number(model.pricing.monthly_subscription_price)}/mo</span>
                      </div>
                    )}
                    {Number(model.pricing.price_per_1k_input_tokens) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Input (per 1K tokens)</span>
                        <span>${Number(model.pricing.price_per_1k_input_tokens).toFixed(4)}</span>
                      </div>
                    )}
                    {Number(model.pricing.price_per_1k_output_tokens) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Output (per 1K tokens)</span>
                        <span>${Number(model.pricing.price_per_1k_output_tokens).toFixed(4)}</span>
                      </div>
                    )}
                  </div>
                </Tile>
              )}
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Widget Create/Edit Modal */}
      <Modal
        open={isWidgetModalOpen}
        onRequestClose={() => {
          setIsWidgetModalOpen(false);
          setEditingWidget(null);
          resetWidgetForm();
        }}
        onRequestSubmit={handleWidgetSubmit}
        modalHeading={editingWidget ? 'Edit Widget' : 'Create Widget'}
        primaryButtonText={editingWidget ? 'Update Widget' : 'Create Widget'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={!widgetForm.name.trim() || createWidgetMutation.isPending || updateWidgetMutation.isPending}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <TextInput
            id="widget-name"
            labelText="Widget Name"
            placeholder="e.g., Support Chat"
            value={widgetForm.name}
            onChange={(e) => setWidgetForm({ ...widgetForm, name: e.target.value })}
            required
          />
          <TextInput
            id="widget-title"
            labelText="Chat Title"
            placeholder="Chat with AI"
            value={widgetForm.title}
            onChange={(e) => setWidgetForm({ ...widgetForm, title: e.target.value })}
          />
          <TextArea
            id="widget-welcome"
            labelText="Welcome Message"
            placeholder="Hello! How can I help you today?"
            value={widgetForm.welcome_message}
            onChange={(e) => setWidgetForm({ ...widgetForm, welcome_message: e.target.value })}
            rows={2}
          />
          <TextInput
            id="widget-placeholder"
            labelText="Input Placeholder"
            placeholder="Type a message..."
            value={widgetForm.placeholder_text}
            onChange={(e) => setWidgetForm({ ...widgetForm, placeholder_text: e.target.value })}
          />
          <Dropdown
            id="widget-position"
            titleText="Position"
            label="Select position"
            items={[
              { id: 'bottom-right', text: 'Bottom Right' },
              { id: 'bottom-left', text: 'Bottom Left' },
              { id: 'top-right', text: 'Top Right' },
              { id: 'top-left', text: 'Top Left' },
            ]}
            itemToString={(item) => item?.text || ''}
            selectedItem={{ id: widgetForm.position, text: widgetForm.position.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }}
            onChange={({ selectedItem }) => setWidgetForm({ ...widgetForm, position: selectedItem?.id || 'bottom-right' })}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                Primary Color
              </label>
              <input
                type="color"
                value={widgetForm.theme.primaryColor}
                onChange={(e) => setWidgetForm({
                  ...widgetForm,
                  theme: { ...widgetForm.theme, primaryColor: e.target.value }
                })}
                style={{ width: '100%', height: '40px', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                Background
              </label>
              <input
                type="color"
                value={widgetForm.theme.backgroundColor}
                onChange={(e) => setWidgetForm({
                  ...widgetForm,
                  theme: { ...widgetForm.theme, backgroundColor: e.target.value }
                })}
                style={{ width: '100%', height: '40px', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                Text Color
              </label>
              <input
                type="color"
                value={widgetForm.theme.textColor}
                onChange={(e) => setWidgetForm({
                  ...widgetForm,
                  theme: { ...widgetForm.theme, textColor: e.target.value }
                })}
                style={{ width: '100%', height: '40px', border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer' }}
              />
            </div>
          </div>
          <TextInput
            id="widget-domains"
            labelText="Allowed Domains (comma-separated)"
            placeholder="example.com, app.example.com"
            helperText="Leave empty to allow all domains"
            value={widgetForm.allowed_domains}
            onChange={(e) => setWidgetForm({ ...widgetForm, allowed_domains: e.target.value })}
          />
        </div>
      </Modal>

      {/* Embed Code Modal */}
      <Modal
        open={!!showEmbedCode}
        onRequestClose={() => {
          setShowEmbedCode(null);
          setCopiedCode(false);
        }}
        passiveModal
        modalHeading="Embed Widget Code"
        size="lg"
      >
        {showEmbedCode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
            <Tabs>
              <TabList aria-label="Embed code options">
                <Tab>HTML Script</Tab>
                <Tab>React</Tab>
                <Tab>REST API</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <div style={{ marginTop: '1rem' }}>
                    <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                      Add this script tag to your website's HTML, just before the closing &lt;/body&gt; tag:
                    </p>
                    <div style={{ position: 'relative' }}>
                      <pre style={{
                        backgroundColor: 'var(--layer-01)',
                        padding: '1rem',
                        borderRadius: '4px',
                        overflow: 'auto',
                        fontSize: '0.875rem',
                      }}>
{`<!-- Virtus AI Chat Widget -->
<script src="${window.location.origin}/api/v1/widgets/${showEmbedCode}/embed.js"></script>`}
                      </pre>
                      <Button
                        kind="ghost"
                        size="sm"
                        renderIcon={copiedCode ? Checkmark : Copy}
                        hasIconOnly
                        iconDescription="Copy"
                        style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}
                        onClick={() => handleCopyCode(`<!-- Virtus AI Chat Widget -->\n<script src="${window.location.origin}/api/v1/widgets/${showEmbedCode}/embed.js"></script>`)}
                      />
                    </div>
                  </div>
                </TabPanel>
                <TabPanel>
                  <div style={{ marginTop: '1rem' }}>
                    <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                      Install the package and use the React component:
                    </p>
                    <pre style={{
                      backgroundColor: 'var(--layer-01)',
                      padding: '1rem',
                      borderRadius: '4px',
                      overflow: 'auto',
                      fontSize: '0.875rem',
                      marginBottom: '1rem',
                    }}>
{`npm install @virtus/react`}
                    </pre>
                    <pre style={{
                      backgroundColor: 'var(--layer-01)',
                      padding: '1rem',
                      borderRadius: '4px',
                      overflow: 'auto',
                      fontSize: '0.875rem',
                    }}>
{`import { VirtusChatWidget } from '@virtus/react';

function App() {
  return (
    <VirtusChatWidget
      widgetId="${showEmbedCode}"
      position="bottom-right"
    />
  );
}`}
                    </pre>
                  </div>
                </TabPanel>
                <TabPanel>
                  <div style={{ marginTop: '1rem' }}>
                    <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                      Use the REST API directly to send chat messages:
                    </p>
                    <pre style={{
                      backgroundColor: 'var(--layer-01)',
                      padding: '1rem',
                      borderRadius: '4px',
                      overflow: 'auto',
                      fontSize: '0.875rem',
                    }}>
{`curl -X POST ${window.location.origin}/api/v1/chat/completions \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model_id": "${subscription?.model_id}",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`}
                    </pre>
                    <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Generate an API key in the API Keys tab to authenticate your requests.
                    </p>
                  </div>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </div>
        )}
      </Modal>

      {/* Create Data Source Modal */}
      <CreateDataSourceModal
        open={isDataSourceModalOpen}
        onClose={() => setIsDataSourceModalOpen(false)}
        onSubmit={(data) => createDataSourceMutation.mutate({
          name: data.name,
          description: data.description,
          type: data.type,
          config: data.config as Record<string, unknown>,
          files: data.files,
        })}
        isLoading={createDataSourceMutation.isPending}
      />

      {/* API Key Modal */}
      <Modal
        open={isApiKeyModalOpen}
        onRequestClose={() => {
          setIsApiKeyModalOpen(false);
          setCreatedKey(null);
        }}
        onRequestSubmit={() => {
          if (createdKey) {
            setIsApiKeyModalOpen(false);
            setCreatedKey(null);
          } else {
            createApiKeyMutation.mutate({ name: newKeyName });
          }
        }}
        modalHeading={createdKey ? 'API Key Created' : 'Create API Key'}
        primaryButtonText={createdKey ? 'Done' : 'Create'}
        secondaryButtonText={createdKey ? undefined : 'Cancel'}
        primaryButtonDisabled={!createdKey && (!newKeyName || createApiKeyMutation.isPending)}
      >
        <div style={{ marginTop: '1rem' }}>
          {createdKey ? (
            <>
              <InlineNotification
                kind="warning"
                title="Important"
                subtitle="Copy this key now. You won't be able to see it again!"
                lowContrast
                hideCloseButton
                style={{ marginBottom: '1rem' }}
              />
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1rem',
                backgroundColor: 'var(--layer-01)',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                borderRadius: '4px',
              }}>
                <span style={{ flex: 1 }}>{createdKey}</span>
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={Copy}
                  hasIconOnly
                  iconDescription="Copy"
                  onClick={() => handleCopyCode(createdKey)}
                />
              </div>
            </>
          ) : (
            <>
              <TextInput
                id="api-key-name"
                labelText="Key Name"
                placeholder="e.g., Production API"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
              <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                This API key will be scoped to the {model?.name || 'current'} model only.
              </p>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
