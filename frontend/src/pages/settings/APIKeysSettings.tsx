import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tile,
  Button,
  TextInput,
  Tag,
  Modal,
  InlineNotification,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import { Add, TrashCan, Copy } from '@carbon/icons-react';
import { authApi } from '../../services/api';
import { APIKey } from '../../types';

export default function APIKeysSettings() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', scopes: ['read', 'write'] });
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const { data: apiKeys, isLoading } = useQuery<APIKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => authApi.listApiKeys().then(res => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof newKey) => authApi.createApiKey(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setCreatedKey(response.data.key);
      setNewKey({ name: '', scopes: ['read', 'write'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => authApi.revokeApiKey(keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const headers = [
    { key: 'name', header: 'Name' },
    { key: 'key', header: 'Key' },
    { key: 'status', header: 'Status' },
    { key: 'lastUsed', header: 'Last Used' },
    { key: 'actions', header: 'Actions' },
  ];

  const rows = apiKeys?.map(key => ({
    id: key.id,
    name: key.name,
    key: `${key.key_prefix}...`,
    status: key.is_active ? 'Active' : 'Revoked',
    isActive: key.is_active,
    lastUsed: key.last_used_at
      ? new Date(key.last_used_at).toLocaleDateString()
      : 'Never',
  })) || [];

  return (
    <Tile style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '0.5rem' }}>API Keys</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Manage API keys for programmatic access</p>
        </div>
        <Button kind="primary" renderIcon={Add} onClick={() => setIsCreateOpen(true)}>
          Create API Key
        </Button>
      </div>

      {rows.length > 0 ? (
        <Table>
          <TableHead>
            <TableRow>
              {headers.map(header => (
                <TableHeader key={header.key}>{header.header}</TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell style={{ fontFamily: 'monospace' }}>{row.key}</TableCell>
                <TableCell>
                  <Tag type={row.isActive ? 'green' : 'red'}>
                    {row.status}
                  </Tag>
                </TableCell>
                <TableCell>{row.lastUsed}</TableCell>
                <TableCell>
                  {row.isActive && (
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={TrashCan}
                      hasIconOnly
                      iconDescription="Revoke"
                      onClick={() => revokeMutation.mutate(row.id)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
          No API keys yet. Create one to access the API programmatically.
        </p>
      )}

      <Modal
        open={isCreateOpen}
        onRequestClose={() => {
          setIsCreateOpen(false);
          setCreatedKey(null);
        }}
        onRequestSubmit={() => {
          if (createdKey) {
            setIsCreateOpen(false);
            setCreatedKey(null);
          } else {
            createMutation.mutate(newKey);
          }
        }}
        modalHeading={createdKey ? 'API Key Created' : 'Create API Key'}
        primaryButtonText={createdKey ? 'Done' : 'Create'}
        secondaryButtonText={createdKey ? undefined : 'Cancel'}
        primaryButtonDisabled={!createdKey && (!newKey.name || createMutation.isPending)}
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
                backgroundColor: 'var(--bg-primary)',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
              }}>
                <span style={{ flex: 1 }}>{createdKey}</span>
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={Copy}
                  hasIconOnly
                  iconDescription="Copy"
                  onClick={() => copyToClipboard(createdKey)}
                />
              </div>
            </>
          ) : (
            <TextInput
              id="key-name"
              labelText="Key Name"
              placeholder="e.g., Production API"
              value={newKey.name}
              onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
            />
          )}
        </div>
      </Modal>
    </Tile>
  );
}
