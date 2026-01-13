import { useQuery } from '@tanstack/react-query';
import {
  makeStyles,
  tokens,
  Card,
  Text,
  Badge,
  Spinner,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Input,
} from '@fluentui/react-components';
import { Search24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { adminApi } from '../../services/api';
import { OrganizationWithStats } from '../../types';

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
  searchInput: {
    minWidth: '300px',
  },
});

export default function AdminOrganizations() {
  const styles = useStyles();
  const [search, setSearch] = useState('');

  const { data: organizations, isLoading } = useQuery<OrganizationWithStats[]>({
    queryKey: ['admin-organizations'],
    queryFn: () => adminApi.listOrganizations().then(res => res.data),
  });

  const filteredOrgs = organizations?.filter(org =>
    org.name.toLowerCase().includes(search.toLowerCase()) ||
    org.slug.toLowerCase().includes(search.toLowerCase())
  );

  const getPlanBadgeColor = (plan: string) => {
    const colors: Record<string, 'informative' | 'success' | 'warning' | 'brand'> = {
      free: 'informative',
      starter: 'success',
      pro: 'warning',
      enterprise: 'brand',
    };
    return colors[plan] || 'informative';
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Spinner size="large" label="Loading organizations..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Text size={700} weight="semibold" block>Organizations</Text>
          <Text style={{ color: tokens.colorNeutralForeground3 }}>
            Manage tenant organizations and their subscriptions
          </Text>
        </div>
        <Input
          className={styles.searchInput}
          contentBefore={<Search24Regular />}
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card style={{ padding: tokens.spacingVerticalL }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Organization</TableHeaderCell>
              <TableHeaderCell>Plan</TableHeaderCell>
              <TableHeaderCell>Users</TableHeaderCell>
              <TableHeaderCell>Subscriptions</TableHeaderCell>
              <TableHeaderCell>Token Usage</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrgs?.map(org => (
              <TableRow key={org.id}>
                <TableCell>
                  <Text weight="semibold" block>{org.name}</Text>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {org.slug}
                  </Text>
                </TableCell>
                <TableCell>
                  <Badge color={getPlanBadgeColor(org.plan)}>
                    {org.plan.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>{org.user_count}</TableCell>
                <TableCell>{org.subscription_count}</TableCell>
                <TableCell>{org.total_usage_tokens.toLocaleString()}</TableCell>
                <TableCell>
                  {new Date(org.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredOrgs?.length === 0 && (
          <Text
            style={{
              color: tokens.colorNeutralForeground3,
              textAlign: 'center',
              padding: tokens.spacingVerticalL,
              display: 'block',
            }}
          >
            No organizations found.
          </Text>
        )}
      </Card>
    </div>
  );
}
