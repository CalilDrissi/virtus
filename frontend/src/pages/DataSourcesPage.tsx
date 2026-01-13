import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  makeStyles,
  tokens,
  Card,
  Text,
  Button,
  Spinner,
  Badge,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Input,
  Dropdown,
  Option,
} from '@fluentui/react-components';
import {
  Add24Regular,
  Delete24Regular,
  Document24Regular,
  ArrowUpload24Regular,
} from '@fluentui/react-icons';
import { dataSourcesApi } from '../services/api';
import { DataSource, Document } from '../types';

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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  card: {
    padding: tokens.spacingVerticalL,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: tokens.spacingVerticalM,
  },
  stats: {
    display: 'flex',
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground3,
  },
  documents: {
    marginTop: tokens.spacingVerticalM,
    paddingTop: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  documentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalS,
  },
  documentItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  documentInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  uploadArea: {
    border: `2px dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalXL,
    textAlign: 'center',
    cursor: 'pointer',
    '&:hover': {
      borderColor: tokens.colorBrandStroke1,
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
});

const sourceTypes = [
  { value: 'document', label: 'Documents' },
  { value: 'website', label: 'Website' },
  { value: 'database', label: 'Database' },
  { value: 'api', label: 'API' },
];

export default function DataSourcesPage() {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null);
  const [newSource, setNewSource] = useState({ name: '', description: '', type: 'document' });

  const { data: dataSources, isLoading } = useQuery<DataSource[]>({
    queryKey: ['data-sources'],
    queryFn: () => dataSourcesApi.list().then(res => res.data),
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ['documents', selectedSource?.id],
    queryFn: () => dataSourcesApi.listDocuments(selectedSource!.id).then(res => res.data),
    enabled: !!selectedSource,
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

  const getStatusBadge = (status: string) => {
    const colors: Record<string, 'success' | 'warning' | 'danger' | 'informative'> = {
      ready: 'success',
      processing: 'warning',
      error: 'danger',
      pending: 'informative',
    };
    return colors[status] || 'informative';
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Spinner size="large" label="Loading data sources..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Text size={700} weight="semibold" block>Data Sources</Text>
          <Text style={{ color: tokens.colorNeutralForeground3 }}>
            Connect your data for RAG-powered AI responses
          </Text>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(_, data) => setIsCreateOpen(data.open)}>
          <DialogTrigger>
            <Button appearance="primary" icon={<Add24Regular />}>
              Add Data Source
            </Button>
          </DialogTrigger>
          <DialogSurface>
            <DialogTitle>Create Data Source</DialogTitle>
            <DialogBody>
              <DialogContent>
                <div className={styles.form}>
                  <Input
                    placeholder="Name"
                    value={newSource.name}
                    onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={newSource.description}
                    onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
                  />
                  <Dropdown
                    placeholder="Type"
                    value={sourceTypes.find(t => t.value === newSource.type)?.label}
                    onOptionSelect={(_, data) => setNewSource({ ...newSource, type: data.optionValue as string })}
                  >
                    {sourceTypes.map(type => (
                      <Option key={type.value} value={type.value}>{type.label}</Option>
                    ))}
                  </Dropdown>
                </div>
              </DialogContent>
            </DialogBody>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button
                appearance="primary"
                onClick={() => createMutation.mutate(newSource)}
                disabled={!newSource.name || createMutation.isPending}
              >
                {createMutation.isPending ? <Spinner size="tiny" /> : 'Create'}
              </Button>
            </DialogActions>
          </DialogSurface>
        </Dialog>
      </div>

      <div className={styles.grid}>
        {dataSources?.map(source => (
          <Card key={source.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <Text size={500} weight="semibold" block>{source.name}</Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  {source.description || 'No description'}
                </Text>
              </div>
              <Badge color={getStatusBadge(source.status)}>{source.status}</Badge>
            </div>

            <div className={styles.stats}>
              <Text size={200}>{source.document_count} documents</Text>
              <Text size={200}>{source.type}</Text>
            </div>

            <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
              <Button
                appearance="outline"
                icon={<ArrowUpload24Regular />}
                onClick={() => handleFileUpload(source.id)}
                disabled={uploadMutation.isPending}
              >
                Upload
              </Button>
              <Button
                appearance="subtle"
                icon={<Delete24Regular />}
                onClick={() => deleteMutation.mutate(source.id)}
              />
            </div>
          </Card>
        ))}
      </div>

      {dataSources?.length === 0 && (
        <Card style={{ padding: tokens.spacingVerticalXL, textAlign: 'center' }}>
          <Text style={{ color: tokens.colorNeutralForeground3 }}>
            No data sources yet. Create one to start uploading documents for RAG.
          </Text>
        </Card>
      )}
    </div>
  );
}
