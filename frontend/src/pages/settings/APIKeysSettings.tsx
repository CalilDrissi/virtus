import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  makeStyles,
  tokens,
  Card,
  Text,
  Button,
  Input,
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
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import { Add24Regular, Delete24Regular, Copy24Regular } from '@fluentui/react-icons';
import { authApi } from '../../services/api';
import { APIKey } from '../../types';

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalXL,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalL,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  keyDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: 'monospace',
  },
});

export default function APIKeysSettings() {
  const styles = useStyles();
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

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div>
          <Text size={600} weight="semibold" block>API Keys</Text>
          <Text style={{ color: tokens.colorNeutralForeground3 }}>
            Manage API keys for programmatic access
          </Text>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(_, data) => {
          setIsCreateOpen(data.open);
          if (!data.open) setCreatedKey(null);
        }}>
          <DialogTrigger>
            <Button appearance="primary" icon={<Add24Regular />}>
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogSurface>
            <DialogTitle>
              {createdKey ? 'API Key Created' : 'Create API Key'}
            </DialogTitle>
            <DialogBody>
              <DialogContent>
                {createdKey ? (
                  <div>
                    <MessageBar intent="warning" style={{ marginBottom: tokens.spacingVerticalM }}>
                      <MessageBarBody>
                        Copy this key now. You won't be able to see it again!
                      </MessageBarBody>
                    </MessageBar>
                    <div className={styles.keyDisplay}>
                      <Text style={{ flex: 1, wordBreak: 'break-all' }}>{createdKey}</Text>
                      <Button
                        appearance="subtle"
                        icon={<Copy24Regular />}
                        onClick={() => copyToClipboard(createdKey)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className={styles.form}>
                    <Input
                      placeholder="Key Name (e.g., Production API)"
                      value={newKey.name}
                      onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                    />
                  </div>
                )}
              </DialogContent>
            </DialogBody>
            <DialogActions>
              {createdKey ? (
                <Button appearance="primary" onClick={() => {
                  setIsCreateOpen(false);
                  setCreatedKey(null);
                }}>
                  Done
                </Button>
              ) : (
                <>
                  <Button appearance="secondary" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    appearance="primary"
                    onClick={() => createMutation.mutate(newKey)}
                    disabled={!newKey.name || createMutation.isPending}
                  >
                    Create
                  </Button>
                </>
              )}
            </DialogActions>
          </DialogSurface>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Key</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Last Used</TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apiKeys?.map(key => (
            <TableRow key={key.id}>
              <TableCell>{key.name}</TableCell>
              <TableCell>
                <Text style={{ fontFamily: 'monospace' }}>{key.key_prefix}...</Text>
              </TableCell>
              <TableCell>
                <Badge color={key.is_active ? 'success' : 'danger'}>
                  {key.is_active ? 'Active' : 'Revoked'}
                </Badge>
              </TableCell>
              <TableCell>
                {key.last_used_at
                  ? new Date(key.last_used_at).toLocaleDateString()
                  : 'Never'}
              </TableCell>
              <TableCell>
                {key.is_active && (
                  <Button
                    appearance="subtle"
                    icon={<Delete24Regular />}
                    onClick={() => revokeMutation.mutate(key.id)}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {apiKeys?.length === 0 && (
        <Text style={{ color: tokens.colorNeutralForeground3, textAlign: 'center', padding: tokens.spacingVerticalL }}>
          No API keys yet. Create one to access the API programmatically.
        </Text>
      )}
    </Card>
  );
}
