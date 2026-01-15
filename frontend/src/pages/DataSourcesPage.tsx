import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tile,
  Button,
  Loading,
  Tag,
  Modal,
  TextInput,
  Dropdown,
  InlineLoading,
  InlineNotification,
  FileUploaderDropContainer,
  FileUploaderItem,
} from '@carbon/react';
import { Add, TrashCan, Upload, Close, Document } from '@carbon/icons-react';
import { dataSourcesApi } from '../services/api';
import { DataSource } from '../types';

const sourceTypes = [
  { id: 'document', text: 'Documents' },
  { id: 'website', text: 'Website' },
  { id: 'database', text: 'Database' },
  { id: 'api', text: 'API' },
];

export default function DataSourcesPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSource, setNewSource] = useState({ name: '', description: '', type: 'document' });
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: dataSources, isLoading } = useQuery<DataSource[]>({
    queryKey: ['data-sources'],
    queryFn: () => dataSourcesApi.list().then(res => res.data),
  });

  const handleCreateWithFiles = async () => {
    setUploadError(null);
    setIsCreating(true);
    setUploadProgress(null);

    try {
      // First, create the data source
      setUploadProgress('Creating data source...');
      const response = await dataSourcesApi.create(newSource);
      const createdSource = response.data;

      // If there are files to upload and type is document, upload them
      if (filesToUpload.length > 0 && newSource.type === 'document') {
        for (let i = 0; i < filesToUpload.length; i++) {
          setUploadProgress(`Uploading file ${i + 1} of ${filesToUpload.length}...`);
          await dataSourcesApi.uploadDocument(createdSource.id, filesToUpload[i]);
        }
      }

      // Success - reset and close
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      setIsCreateOpen(false);
      setNewSource({ name: '', description: '', type: 'document' });
      setFilesToUpload([]);
      setUploadProgress(null);
    } catch (err: unknown) {
      const error = err as Error & { response?: { data?: { detail?: string } } };
      setUploadError(error.response?.data?.detail || error.message || 'Failed to create data source');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFilesToUpload(prev => [...prev, ...files]);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>, { addedFiles }: { addedFiles: File[] }) => {
    setFilesToUpload(prev => [...prev, ...addedFiles]);
  };

  const removeFile = (index: number) => {
    setFilesToUpload(prev => prev.filter((_, i) => i !== index));
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dataSourcesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ dataSourceId, file }: { dataSourceId: string; file: File }) =>
      dataSourcesApi.uploadDocument(dataSourceId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const handleFileUpload = (dataSourceId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.txt,.html';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        uploadMutation.mutate({ dataSourceId, file });
      }
    };
    input.click();
  };

  const getStatusColor = (status: string): 'green' | 'magenta' | 'red' | 'blue' => {
    const colors: Record<string, 'green' | 'magenta' | 'red' | 'blue'> = {
      ready: 'green',
      processing: 'magenta',
      error: 'red',
      pending: 'blue',
    };
    return colors[status] || 'blue';
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading data sources..." withOverlay={false} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 400, marginBottom: '0.5rem' }}>Data Sources</h1>
          <p style={{ color: '#525252' }}>Connect your data for RAG-powered AI responses</p>
        </div>
        <Button kind="primary" renderIcon={Add} onClick={() => setIsCreateOpen(true)}>
          Add Data Source
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
        {dataSources?.map(source => (
          <Tile key={source.id} style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>{source.name}</h3>
                <p style={{ fontSize: '0.875rem', color: '#525252' }}>
                  {source.description || 'No description'}
                </p>
              </div>
              <Tag type={getStatusColor(source.status)}>{source.status}</Tag>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', color: '#525252', fontSize: '0.875rem' }}>
              <span>{source.document_count} documents</span>
              <span>{source.type}</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                kind="tertiary"
                size="sm"
                renderIcon={Upload}
                onClick={() => handleFileUpload(source.id)}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? <InlineLoading description="Uploading..." /> : 'Upload'}
              </Button>
              <Button
                kind="ghost"
                size="sm"
                renderIcon={TrashCan}
                hasIconOnly
                iconDescription="Delete"
                onClick={() => deleteMutation.mutate(source.id)}
              />
            </div>
          </Tile>
        ))}
      </div>

      {dataSources?.length === 0 && (
        <Tile style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#525252' }}>
            No data sources yet. Create one to start uploading documents for RAG.
          </p>
        </Tile>
      )}

      <Modal
        open={isCreateOpen}
        onRequestClose={() => {
          setIsCreateOpen(false);
          setFilesToUpload([]);
          setUploadError(null);
          setUploadProgress(null);
        }}
        onRequestSubmit={handleCreateWithFiles}
        modalHeading="Create Data Source"
        primaryButtonText={isCreating ? 'Creating...' : 'Create'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={!newSource.name || isCreating}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          {uploadError && (
            <InlineNotification
              kind="error"
              title="Error"
              subtitle={uploadError}
              lowContrast
              hideCloseButton
            />
          )}

          {uploadProgress && (
            <InlineNotification
              kind="info"
              title="Progress"
              subtitle={uploadProgress}
              lowContrast
              hideCloseButton
            />
          )}

          <TextInput
            id="source-name"
            labelText="Name"
            placeholder="Enter a name for this data source"
            value={newSource.name}
            onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
          />
          <TextInput
            id="source-description"
            labelText="Description (optional)"
            placeholder="Enter a description"
            value={newSource.description}
            onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
          />
          <Dropdown
            id="source-type"
            titleText="Data Source Type"
            label="Select type"
            items={sourceTypes}
            itemToString={(item) => item?.text || ''}
            selectedItem={sourceTypes.find(t => t.id === newSource.type)}
            onChange={({ selectedItem }) => {
              setNewSource({ ...newSource, type: selectedItem?.id || 'document' });
              // Clear files if switching away from document type
              if (selectedItem?.id !== 'document') {
                setFilesToUpload([]);
              }
            }}
          />

          {/* Document Upload Section - shown when type is 'document' */}
          {newSource.type === 'document' && (
            <div style={{ marginTop: '0.5rem' }}>
              <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.5rem' }}>
                Upload Documents (optional)
              </p>
              <FileUploaderDropContainer
                accept={['.pdf', '.doc', '.docx', '.txt', '.html']}
                labelText="Drag and drop files here or click to upload"
                multiple
                onAddFiles={handleDrop}
              />

              {/* File List */}
              {filesToUpload.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.5rem' }}>
                    {filesToUpload.length} file(s) selected
                  </p>
                  {filesToUpload.map((file, index) => (
                    <FileUploaderItem
                      key={index}
                      name={file.name}
                      status="edit"
                      onDelete={() => removeFile(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
