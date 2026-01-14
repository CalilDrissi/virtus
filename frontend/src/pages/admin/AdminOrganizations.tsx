import { useQuery } from '@tanstack/react-query';
import {
  Tile,
  TextInput,
  Tag,
  Loading,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import { Search } from '@carbon/icons-react';
import { useState } from 'react';
import { adminApi } from '../../services/api';
import { OrganizationWithStats } from '../../types';

export default function AdminOrganizations() {
  const [search, setSearch] = useState('');

  const { data: organizations, isLoading } = useQuery<OrganizationWithStats[]>({
    queryKey: ['admin-organizations'],
    queryFn: () => adminApi.listOrganizations().then(res => res.data),
  });

  const filteredOrgs = organizations?.filter(org =>
    org.name.toLowerCase().includes(search.toLowerCase()) ||
    org.slug.toLowerCase().includes(search.toLowerCase())
  );

  const getPlanColor = (plan: string): 'blue' | 'green' | 'magenta' | 'purple' => {
    const colors: Record<string, 'blue' | 'green' | 'magenta' | 'purple'> = {
      free: 'blue',
      starter: 'green',
      pro: 'magenta',
      enterprise: 'purple',
    };
    return colors[plan] || 'blue';
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading organizations..." withOverlay={false} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 400, marginBottom: '0.5rem' }}>Organizations</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage tenant organizations and their subscriptions</p>
        </div>
        <TextInput
          id="search"
          labelText=""
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: '280px' }}
        />
      </div>

      <Tile style={{ padding: '1.5rem' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Organization</TableHeader>
              <TableHeader>Plan</TableHeader>
              <TableHeader>Users</TableHeader>
              <TableHeader>Subscriptions</TableHeader>
              <TableHeader>Token Usage</TableHeader>
              <TableHeader>Created</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrgs?.map(org => (
              <TableRow key={org.id}>
                <TableCell>
                  <div style={{ fontWeight: 600 }}>{org.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{org.slug}</div>
                </TableCell>
                <TableCell>
                  <Tag type={getPlanColor(org.plan)}>{org.plan.toUpperCase()}</Tag>
                </TableCell>
                <TableCell>{org.user_count}</TableCell>
                <TableCell>{org.subscription_count}</TableCell>
                <TableCell>{org.total_usage_tokens.toLocaleString()}</TableCell>
                <TableCell>{new Date(org.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredOrgs?.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
            No organizations found.
          </p>
        )}
      </Tile>
    </div>
  );
}
