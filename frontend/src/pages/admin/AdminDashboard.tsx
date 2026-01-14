import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Tile, ClickableTile, Loading } from '@carbon/react';
import { Enterprise, UserMultiple, Bot, Wallet, ArrowRight } from '@carbon/icons-react';
import { adminApi } from '../../services/api';

export default function AdminDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats().then(res => res.data),
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading admin dashboard..." withOverlay={false} />
      </div>
    );
  }

  const statCards = [
    {
      icon: Enterprise,
      value: stats?.organizations || 0,
      label: 'Organizations',
      path: '/admin/organizations',
    },
    {
      icon: UserMultiple,
      value: stats?.users || 0,
      label: 'Total Users',
      path: '/admin/clients',
    },
    {
      icon: Bot,
      value: stats?.models || 0,
      label: 'Active Models',
      path: '/admin/models',
    },
    {
      icon: Wallet,
      value: `$${(stats?.total_revenue || 0).toFixed(2)}`,
      label: 'Total Revenue',
      path: '/admin/analytics',
    },
  ];

  const quickActions = [
    { label: 'Manage AI Models', description: 'Add, edit, and configure models', path: '/admin/models' },
    { label: 'Model Categories', description: 'Create and manage model categories', path: '/admin/categories' },
    { label: 'View Organizations', description: 'Manage tenants and subscriptions', path: '/admin/organizations' },
    { label: 'Client Management', description: 'Manage users, deactivate accounts, assign credits', path: '/admin/clients' },
    { label: 'Analytics', description: 'View platform usage trends and insights', path: '/admin/analytics' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 400, marginBottom: '0.5rem' }}>Platform Admin</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your AI model marketplace</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <ClickableTile
              key={index}
              onClick={() => navigate(stat.path)}
              style={{ padding: '1.5rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--brand-primary)',
                }}>
                  <Icon size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 300, lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{stat.label}</div>
                </div>
              </div>
            </ClickableTile>
          );
        })}
      </div>

      <div>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {quickActions.map((action, index) => (
            <ClickableTile
              key={index}
              onClick={() => navigate(action.path)}
              style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{action.label}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{action.description}</div>
              </div>
              <ArrowRight size={20} />
            </ClickableTile>
          ))}
        </div>
      </div>

      <Tile style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Platform Statistics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Total Tokens</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{(stats?.total_tokens || 0).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Total Requests</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{(stats?.total_requests || 0).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Active Subscriptions</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{stats?.active_subscriptions || 0}</div>
          </div>
        </div>
      </Tile>
    </div>
  );
}
