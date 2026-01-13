import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Card,
  Text,
  Button,
  Spinner,
} from '@fluentui/react-components';
import {
  Organization24Regular,
  People24Regular,
  Bot24Regular,
  Payment24Regular,
  ArrowRight24Regular,
} from '@fluentui/react-icons';
import { adminApi } from '../../services/api';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
  },
  header: {
    marginBottom: tokens.spacingVerticalM,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  statCard: {
    padding: tokens.spacingVerticalL,
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease',
    '&:hover': {
      boxShadow: tokens.shadow16,
    },
  },
  statContent: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  statIcon: {
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  statValue: {
    fontSize: tokens.fontSizeHero900,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: '1',
  },
  statLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  quickActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: tokens.spacingHorizontalL,
    marginTop: tokens.spacingVerticalL,
  },
  actionCard: {
    padding: tokens.spacingVerticalL,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    '&:hover': {
      boxShadow: tokens.shadow8,
    },
  },
});

export default function AdminDashboard() {
  const styles = useStyles();
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats().then(res => res.data),
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Spinner size="large" label="Loading admin dashboard..." />
      </div>
    );
  }

  const statCards = [
    {
      icon: <Organization24Regular />,
      value: stats?.organizations || 0,
      label: 'Organizations',
      path: '/admin/organizations',
    },
    {
      icon: <People24Regular />,
      value: stats?.users || 0,
      label: 'Total Users',
      path: '/admin/organizations',
    },
    {
      icon: <Bot24Regular />,
      value: stats?.models || 0,
      label: 'Active Models',
      path: '/admin/models',
    },
    {
      icon: <Payment24Regular />,
      value: `$${(stats?.total_revenue || 0).toFixed(2)}`,
      label: 'Total Revenue',
      path: '/admin/organizations',
    },
  ];

  const quickActions = [
    { label: 'Manage AI Models', description: 'Add, edit, and configure models', path: '/admin/models' },
    { label: 'View Organizations', description: 'Manage tenants and subscriptions', path: '/admin/organizations' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={700} weight="semibold" block>Platform Admin</Text>
        <Text style={{ color: tokens.colorNeutralForeground3 }}>
          Manage your AI model marketplace
        </Text>
      </div>

      <div className={styles.statsGrid}>
        {statCards.map((stat, index) => (
          <Card
            key={index}
            className={styles.statCard}
            onClick={() => navigate(stat.path)}
          >
            <div className={styles.statContent}>
              <div className={styles.statIcon}>{stat.icon}</div>
              <div>
                <Text className={styles.statValue}>{stat.value}</Text>
                <Text className={styles.statLabel} block>{stat.label}</Text>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div>
        <Text size={500} weight="semibold" block style={{ marginBottom: tokens.spacingVerticalM }}>
          Quick Actions
        </Text>
        <div className={styles.quickActions}>
          {quickActions.map((action, index) => (
            <Card
              key={index}
              className={styles.actionCard}
              onClick={() => navigate(action.path)}
            >
              <div>
                <Text weight="semibold" block>{action.label}</Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  {action.description}
                </Text>
              </div>
              <ArrowRight24Regular />
            </Card>
          ))}
        </div>
      </div>

      <Card style={{ padding: tokens.spacingVerticalL }}>
        <Text size={500} weight="semibold" block style={{ marginBottom: tokens.spacingVerticalM }}>
          Platform Statistics
        </Text>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: tokens.spacingHorizontalXL }}>
          <div>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }} block>Total Tokens</Text>
            <Text size={500} weight="semibold">{(stats?.total_tokens || 0).toLocaleString()}</Text>
          </div>
          <div>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }} block>Total Requests</Text>
            <Text size={500} weight="semibold">{(stats?.total_requests || 0).toLocaleString()}</Text>
          </div>
          <div>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }} block>Active Subscriptions</Text>
            <Text size={500} weight="semibold">{stats?.active_subscriptions || 0}</Text>
          </div>
        </div>
      </Card>
    </div>
  );
}
