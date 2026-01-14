import { useState } from 'react';
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
} from '@carbon/react';
import { Add, TrashCan, Upload } from '@carbon/icons-react';
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

  const { data: dataSources, isLoading } = useQuery<DataSource[]>({
    queryKey: ['data-sources'],
    queryFn: () => dataSourcesApi.list().then(res => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newSource) => dataSourcesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-sources'] });
      setIsCreateOpen(false);
      setNewSource({ name: '', description: '', type: 'document' });
    },
  });

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
        onRequestClose={() => setIsCreateOpen(false)}
        onRequestSubmit={() => createMutation.mutate(newSource)}
        modalHeading="Create Data Source"
        primaryButtonText={createMutation.isPending ? 'Creating...' : 'Create'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={!newSource.name || createMutation.isPending}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
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
            titleText="Type"
            label="Select type"
            items={sourceTypes}
            itemToString={(item) => item?.text || ''}
            selectedItem={sourceTypes.find(t => t.id === newSource.type)}
            onChange={({ selectedItem }) => setNewSource({ ...newSource, type: selectedItem?.id || 'document' })}
          />
        </div>
      </Modal>
    </div>
  );
}
