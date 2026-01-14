import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tile,
  TextInput,
  Button,
  Tag,
  Loading,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Modal,
  NumberInput,
  TextArea,
} from '@carbon/react';
import { UserFollow, Add, Subtract } from '@carbon/icons-react';
import { adminApi } from '../../services/api';

interface ClientUser {
  id: string;
  email: string;
  full_name: string | null;
  organization_id: string;
  organization_name: string;
  role: string;
  is_platform_admin: boolean;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  total_usage_tokens: number;
  total_cost: number;
}

export default function AdminClients() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [creditsModal, setCreditsModal] = useState<{ orgId: string; orgName: string } | null>(null);
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditReason, setCreditReason] = useState('');

  const { data: clients, isLoading } = useQuery<ClientUser[]>({
    queryKey: ['admin-clients', search],
    queryFn: () => adminApi.listClients({ search: search || undefined }).then(res => res.data),
  });

  const activateMutation = useMutation({
    mutationFn: (userId: string) => adminApi.activateClient(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => adminApi.deactivateClient(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
    },
  });

  const creditsMutation = useMutation({
    mutationFn: ({ orgId, amount, reason }: { orgId: string; amount: number; reason?: string }) =>
      adminApi.assignCredits(orgId, { amount, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      setCreditsModal(null);
      setCreditAmount(0);
      setCreditReason('');
    },
  });

  const handleAssignCredits = () => {
    if (creditsModal && creditAmount !== 0) {
      creditsMutation.mutate({
        orgId: creditsModal.orgId,
        amount: creditAmount,
        reason: creditReason || undefined,
      });
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading clients..." withOverlay={false} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 400, marginBottom: '0.5rem' }}>Client Management</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage user accounts and assign credits</p>
        </div>
        <TextInput
          id="search"
          labelText=""
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: '280px' }}
        />
      </div>

      <Tile style={{ padding: '1.5rem' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>User</TableHeader>
              <TableHeader>Organization</TableHeader>
              <TableHeader>Role</TableHeader>
              <TableHeader>Usage</TableHeader>
              <TableHeader>Cost</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Last Login</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {clients?.map(client => (
              <TableRow key={client.id}>
                <TableCell>
                  <div style={{ fontWeight: 600 }}>{client.full_name || 'No name'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{client.email}</div>
                </TableCell>
                <TableCell>
                  <div>{client.organization_name}</div>
                </TableCell>
                <TableCell>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    <Tag type="outline" size="sm">{client.role}</Tag>
                    {client.is_platform_admin && <Tag type="purple" size="sm">Platform Admin</Tag>}
                  </div>
                </TableCell>
                <TableCell>{client.total_usage_tokens.toLocaleString()} tokens</TableCell>
                <TableCell>${client.total_cost.toFixed(2)}</TableCell>
                <TableCell>
                  <Tag type={client.is_active ? 'green' : 'red'}>
                    {client.is_active ? 'Active' : 'Inactive'}
                  </Tag>
                </TableCell>
                <TableCell>
                  {client.last_login_at
                    ? new Date(client.last_login_at).toLocaleDateString()
                    : 'Never'}
                </TableCell>
                <TableCell>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {client.is_active ? (
                      <Button
                        kind="ghost"
                        size="sm"
                        renderIcon={Subtract}
                        hasIconOnly
                        iconDescription="Deactivate"
                        onClick={() => deactivateMutation.mutate(client.id)}
                        disabled={deactivateMutation.isPending}
                      />
                    ) : (
                      <Button
                        kind="ghost"
                        size="sm"
                        renderIcon={UserFollow}
                        hasIconOnly
                        iconDescription="Activate"
                        onClick={() => activateMutation.mutate(client.id)}
                        disabled={activateMutation.isPending}
                      />
                    )}
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={Add}
                      hasIconOnly
                      iconDescription="Assign Credits"
                      onClick={() => setCreditsModal({
                        orgId: client.organization_id,
                        orgName: client.organization_name,
                      })}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {clients?.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
            No clients found.
          </p>
        )}
      </Tile>

      {/* Credits Assignment Modal */}
      <Modal
        open={!!creditsModal}
        onRequestClose={() => {
          setCreditsModal(null);
          setCreditAmount(0);
          setCreditReason('');
        }}
        onRequestSubmit={handleAssignCredits}
        modalHeading="Assign Credits"
        primaryButtonText={creditsMutation.isPending ? 'Assigning...' : 'Assign Credits'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={creditAmount === 0 || creditsMutation.isPending}
        size="sm"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <p>
            Assign credits to <strong>{creditsModal?.orgName}</strong>
          </p>
          <NumberInput
            id="credit-amount"
            label="Credit Amount ($)"
            helperText="Use negative values to deduct credits"
            value={creditAmount}
            onChange={(_e, { value }) => setCreditAmount(Number(value))}
            step={10}
            min={-10000}
            max={10000}
          />
          <TextArea
            id="credit-reason"
            labelText="Reason (optional)"
            placeholder="e.g., Promotional credit, refund, etc."
            value={creditReason}
            onChange={(e) => setCreditReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
