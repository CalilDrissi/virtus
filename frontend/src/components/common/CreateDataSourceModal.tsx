import { useState } from 'react';
import {
  Modal,
  TextInput,
  TextArea,
  Dropdown,
  Checkbox,
  NumberInput,
  InlineNotification,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  PasswordInput,
  FileUploaderDropContainer,
  FileUploaderItem,
} from '@carbon/react';
import { Document, Email, DataBase, Api, Globe } from '@carbon/icons-react';

interface DataSourceConfig {
  // Database
  db_type?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  schema?: string;
  ssl?: boolean;
  // Email
  email_provider?: string;
  email_address?: string;
  email_password?: string;
  imap_host?: string;
  imap_port?: number;
  folders?: string[];
  // API
  api_url?: string;
  api_key?: string;
  api_headers?: Record<string, string>;
  api_method?: string;
  // Website
  website_url?: string;
  crawl_depth?: number;
  include_patterns?: string[];
  exclude_patterns?: string[];
}

interface CreateDataSourceModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; type: string; config: DataSourceConfig; files?: File[] }) => void;
  isLoading?: boolean;
}

const sourceTypes = [
  { id: 'document', text: 'Documents', icon: Document, description: 'Upload PDF, Word, text files' },
  { id: 'email', text: 'Email Inbox', icon: Email, description: 'Connect email for context' },
  { id: 'database', text: 'Database', icon: DataBase, description: 'Connect to SQL/NoSQL databases' },
  { id: 'api', text: 'API Endpoint', icon: Api, description: 'Fetch data from REST APIs' },
  { id: 'website', text: 'Website', icon: Globe, description: 'Crawl and index web pages' },
];

const dbTypes = [
  { id: 'postgresql', text: 'PostgreSQL' },
  { id: 'mysql', text: 'MySQL' },
  { id: 'mongodb', text: 'MongoDB' },
  { id: 'mssql', text: 'SQL Server' },
  { id: 'sqlite', text: 'SQLite' },
];

const emailProviders = [
  { id: 'gmail', text: 'Gmail', imap_host: 'imap.gmail.com', imap_port: 993 },
  { id: 'outlook', text: 'Outlook/Office 365', imap_host: 'outlook.office365.com', imap_port: 993 },
  { id: 'yahoo', text: 'Yahoo Mail', imap_host: 'imap.mail.yahoo.com', imap_port: 993 },
  { id: 'icloud', text: 'iCloud Mail', imap_host: 'imap.mail.me.com', imap_port: 993 },
  { id: 'custom', text: 'Custom IMAP', imap_host: '', imap_port: 993 },
];

export default function CreateDataSourceModal({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}: CreateDataSourceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState('document');
  const [config, setConfig] = useState<DataSourceConfig>({});
  const [files, setFiles] = useState<File[]>([]);

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setConfig({}); // Reset config when type changes
  };

  const handleSubmit = () => {
    onSubmit({
      name,
      description,
      type: selectedType,
      config,
      files: selectedType === 'document' ? files : undefined,
    });
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setSelectedType('document');
    setConfig({});
    setFiles([]);
    onClose();
  };

  const handleFileDrop = (_e: unknown, { addedFiles }: { addedFiles: File[] }) => {
    setFiles(prev => [...prev, ...addedFiles]);
  };

  const handleFileDelete = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateConfig = (key: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const isFormValid = () => {
    if (!name.trim()) return false;

    switch (selectedType) {
      case 'document':
        return true; // Documents are uploaded after creation
      case 'database':
        return !!(config.host && config.database && config.username);
      case 'email':
        return !!(config.email_address && config.email_password && (config.email_provider !== 'custom' || config.imap_host));
      case 'api':
        return !!config.api_url;
      case 'website':
        return !!config.website_url;
      default:
        return true;
    }
  };

  const renderTypeConfig = () => {
    switch (selectedType) {
      case 'document':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <FileUploaderDropContainer
              accept={['.pdf', '.doc', '.docx', '.txt', '.html', '.md', '.csv', '.json']}
              labelText="Drag and drop files here or click to upload"
              multiple
              onAddFiles={handleFileDrop}
            />
            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {files.map((file, index) => (
                  <FileUploaderItem
                    key={index}
                    name={file.name}
                    status="edit"
                    onDelete={() => handleFileDelete(index)}
                  />
                ))}
              </div>
            )}
            <InlineNotification
              kind="info"
              title="Supported formats"
              subtitle="PDF, Word (.doc, .docx), Text (.txt), HTML, Markdown (.md), CSV, and JSON files."
              lowContrast
              hideCloseButton
            />
          </div>
        );

      case 'database':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Dropdown
              id="db-type"
              titleText="Database Type"
              label="Select database type"
              items={dbTypes}
              itemToString={(item) => item?.text || ''}
              selectedItem={dbTypes.find(d => d.id === config.db_type)}
              onChange={({ selectedItem }) => updateConfig('db_type', selectedItem?.id)}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <TextInput
                id="db-host"
                labelText="Host"
                placeholder="localhost or db.example.com"
                value={config.host || ''}
                onChange={(e) => updateConfig('host', e.target.value)}
              />
              <NumberInput
                id="db-port"
                label="Port"
                value={config.port || 5432}
                min={1}
                max={65535}
                onChange={(_e, { value }) => updateConfig('port', value)}
              />
            </div>
            <TextInput
              id="db-name"
              labelText="Database Name"
              placeholder="my_database"
              value={config.database || ''}
              onChange={(e) => updateConfig('database', e.target.value)}
            />
            <TextInput
              id="db-schema"
              labelText="Schema (optional)"
              placeholder="public"
              value={config.schema || ''}
              onChange={(e) => updateConfig('schema', e.target.value)}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <TextInput
                id="db-username"
                labelText="Username"
                placeholder="db_user"
                value={config.username || ''}
                onChange={(e) => updateConfig('username', e.target.value)}
              />
              <PasswordInput
                id="db-password"
                labelText="Password"
                placeholder="Enter password"
                value={config.password || ''}
                onChange={(e) => updateConfig('password', e.target.value)}
              />
            </div>
            <Checkbox
              id="db-ssl"
              labelText="Use SSL connection"
              checked={config.ssl || false}
              onChange={(_e, { checked }) => updateConfig('ssl', checked)}
            />
            <InlineNotification
              kind="warning"
              title="Security Note"
              subtitle="Credentials are encrypted and stored securely. Only tables/views you specify will be indexed."
              lowContrast
              hideCloseButton
            />
          </div>
        );

      case 'email':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Dropdown
              id="email-provider"
              titleText="Email Provider"
              label="Select provider"
              items={emailProviders}
              itemToString={(item) => item?.text || ''}
              selectedItem={emailProviders.find(p => p.id === config.email_provider)}
              onChange={({ selectedItem }) => {
                updateConfig('email_provider', selectedItem?.id);
                if (selectedItem && selectedItem.id !== 'custom') {
                  updateConfig('imap_host', selectedItem.imap_host);
                  updateConfig('imap_port', selectedItem.imap_port);
                }
              }}
            />
            <TextInput
              id="email-address"
              labelText="Email Address"
              placeholder="you@example.com"
              value={config.email_address || ''}
              onChange={(e) => updateConfig('email_address', e.target.value)}
            />
            <PasswordInput
              id="email-password"
              labelText="App Password"
              placeholder="Enter app password"
              value={config.email_password || ''}
              onChange={(e) => updateConfig('email_password', e.target.value)}
            />
            {config.email_provider === 'custom' && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <TextInput
                  id="imap-host"
                  labelText="IMAP Host"
                  placeholder="imap.example.com"
                  value={config.imap_host || ''}
                  onChange={(e) => updateConfig('imap_host', e.target.value)}
                />
                <NumberInput
                  id="imap-port"
                  label="IMAP Port"
                  value={config.imap_port || 993}
                  min={1}
                  max={65535}
                  onChange={(_e, { value }) => updateConfig('imap_port', value)}
                />
              </div>
            )}
            <TextInput
              id="email-folders"
              labelText="Folders to Index (comma-separated)"
              placeholder="INBOX, Sent, Work"
              helperText="Leave empty to index all folders"
              value={config.folders?.join(', ') || ''}
              onChange={(e) => updateConfig('folders', e.target.value.split(',').map(f => f.trim()).filter(Boolean))}
            />
            <InlineNotification
              kind="info"
              title="Gmail Users"
              subtitle="Use an App Password instead of your regular password. Enable 2FA and create one at myaccount.google.com/apppasswords"
              lowContrast
              hideCloseButton
            />
          </div>
        );

      case 'api':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <TextInput
              id="api-url"
              labelText="API Endpoint URL"
              placeholder="https://api.example.com/data"
              value={config.api_url || ''}
              onChange={(e) => updateConfig('api_url', e.target.value)}
            />
            <Dropdown
              id="api-method"
              titleText="HTTP Method"
              label="Select method"
              items={[
                { id: 'GET', text: 'GET' },
                { id: 'POST', text: 'POST' },
              ]}
              itemToString={(item) => item?.text || ''}
              selectedItem={{ id: config.api_method || 'GET', text: config.api_method || 'GET' }}
              onChange={({ selectedItem }) => updateConfig('api_method', selectedItem?.id)}
            />
            <PasswordInput
              id="api-key"
              labelText="API Key (optional)"
              placeholder="Enter API key if required"
              value={config.api_key || ''}
              onChange={(e) => updateConfig('api_key', e.target.value)}
            />
            <TextArea
              id="api-headers"
              labelText="Custom Headers (JSON)"
              placeholder='{"Authorization": "Bearer token", "X-Custom": "value"}'
              helperText="Optional custom headers in JSON format"
              value={config.api_headers ? JSON.stringify(config.api_headers, null, 2) : ''}
              onChange={(e) => {
                try {
                  const headers = JSON.parse(e.target.value);
                  updateConfig('api_headers', headers);
                } catch {
                  // Invalid JSON, keep as-is
                }
              }}
              rows={3}
            />
            <InlineNotification
              kind="info"
              title="API Sync"
              subtitle="The API will be called periodically to fetch and index new data."
              lowContrast
              hideCloseButton
            />
          </div>
        );

      case 'website':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <TextInput
              id="website-url"
              labelText="Website URL"
              placeholder="https://example.com"
              value={config.website_url || ''}
              onChange={(e) => updateConfig('website_url', e.target.value)}
            />
            <NumberInput
              id="crawl-depth"
              label="Crawl Depth"
              helperText="How many levels of links to follow (1-5)"
              value={config.crawl_depth || 2}
              min={1}
              max={5}
              onChange={(_e, { value }) => updateConfig('crawl_depth', value)}
            />
            <TextInput
              id="include-patterns"
              labelText="Include URL Patterns (comma-separated)"
              placeholder="/docs/*, /blog/*"
              helperText="Only crawl URLs matching these patterns. Leave empty for all."
              value={config.include_patterns?.join(', ') || ''}
              onChange={(e) => updateConfig('include_patterns', e.target.value.split(',').map(p => p.trim()).filter(Boolean))}
            />
            <TextInput
              id="exclude-patterns"
              labelText="Exclude URL Patterns (comma-separated)"
              placeholder="/admin/*, /login/*"
              helperText="Skip URLs matching these patterns"
              value={config.exclude_patterns?.join(', ') || ''}
              onChange={(e) => updateConfig('exclude_patterns', e.target.value.split(',').map(p => p.trim()).filter(Boolean))}
            />
            <InlineNotification
              kind="info"
              title="Website Crawling"
              subtitle="The website will be crawled and text content will be extracted and indexed for AI retrieval."
              lowContrast
              hideCloseButton
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      open={open}
      onRequestClose={handleClose}
      onRequestSubmit={handleSubmit}
      modalHeading="Create Data Source"
      primaryButtonText={isLoading ? 'Creating...' : 'Create Data Source'}
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!isFormValid() || isLoading}
      size="lg"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
        {/* Basic Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <TextInput
            id="source-name"
            labelText="Name"
            placeholder="e.g., Company Knowledge Base"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <TextArea
            id="source-description"
            labelText="Description (optional)"
            placeholder="Describe what data this source contains"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        {/* Type Selection */}
        <div>
          <p style={{ marginBottom: '0.75rem', fontWeight: 500 }}>Data Source Type</p>
          <Tabs>
            <TabList aria-label="Data source types" contained>
              {sourceTypes.map((type) => (
                <Tab
                  key={type.id}
                  onClick={() => handleTypeChange(type.id)}
                  style={{ minWidth: '100px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <type.icon size={16} />
                    <span>{type.text}</span>
                  </div>
                </Tab>
              ))}
            </TabList>
            <TabPanels>
              {sourceTypes.map((type) => (
                <TabPanel key={type.id} style={{ padding: '1rem 0' }}>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    {type.description}
                  </p>
                  {selectedType === type.id && renderTypeConfig()}
                </TabPanel>
              ))}
            </TabPanels>
          </Tabs>
        </div>
      </div>
    </Modal>
  );
}
