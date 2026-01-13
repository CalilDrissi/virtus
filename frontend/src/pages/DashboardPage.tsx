import { useQuery } from '@tanstack/react-query';
import {
  makeStyles,
  tokens,
  Card,
  CardHeader,
  Text,
  Spinner,
  Badge,
} from '@fluentui/react-components';
import {
  Wallet24Regular,
  TextBulletListSquare24Regular,
  ArrowTrending24Regular,
  Database24Regular,
} from '@fluentui/react-icons';
import { organizationsApi, subscriptionsApi, billingApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { SubscriptionWithUsage, UsageSummary } from '../types';

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
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  statCard: {
    padding: tokens.spacingVerticalL,
  },
  statContent: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  statIcon: {
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  statValue: {
    fontSize: tokens.fontSizeHero800,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: '1',
  },
  statLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  section: {
    marginTop: tokens.spacingVerticalL,
  },
  subscriptionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalM,
  },
  subscriptionCard: {
    padding: tokens.spacingVerticalM,
  },
  subscriptionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalS,
  },
  usageBar: {
    height: '8px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
    marginTop: tokens.spacingVerticalS,
  },
  usageProgress: {
    height: '100%',
    backgroundColor: tokens.colorBrandBackground,
    transition: 'width 0.3s ease',
  },
});

export default function DashboardPage() {
  const styles = useStyles();
  const { organization } = useAuthStore();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['organization-stats'],
    queryFn: () => organizationsApi.getStats().then(res => res.data),
  });

  const { data: subscriptions, isLoading: subsLoading } = useQuery<SubscriptionWithUsage[]>({
    queryKey: ['active-subscriptions'],
    queryFn: () => subscriptionsApi.listActive().then(res => res.data),
  });

  const { data: usage, isLoading: usageLoading } = useQuery<UsageSummary>({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.getUsage().then(res => res.data),
  });

  const isLoading = statsLoading || subsLoading || usageLoading;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Spinner size="large" label="Loading dashboard..." />
      </div>
    );
  }

  const statCards = [
    {
      icon: <TextBulletListSquare24Regular />,
      value: subscriptions?.length || 0,
      label: 'Active Subscriptions',
    },
    {
      icon: <ArrowTrending24Regular />,
      value: usage?.total_requests?.toLocaleString() || '0',
      label: 'API Requests (This Month)',
    },
    {
      icon: <Database24Regular />,
      value: `${((usage?.total_input_tokens || 0) + (usage?.total_output_tokens || 0)).toLocaleString()}`,
      label: 'Total Tokens Used',
    },
    {
      icon: <Wallet24Regular />,
      value: `$${usage?.total_cost?.toFixed(2) || '0.00'}`,
      label: 'Current Bill',
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={700} weight="semibold" block>
          Welcome back
        </Text>
        <Text size={400} style={{ color: tokens.colorNeutralForeground3 }}>
          Here's what's happening with {organization?.name}
        </Text>
      </div>

      <div className={styles.statsGrid}>
        {statCards.map((stat, index) => (
          <Card key={index} className={styles.statCard}>
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

      <div className={styles.section}>
        <Text size={500} weight="semibold">Active Subscriptions</Text>
        {subscriptions && subscriptions.length > 0 ? (
          <div className={styles.subscriptionGrid}>
            {subscriptions.map((sub) => (
              <Card key={sub.id} className={styles.subscriptionCard}>
                <div className={styles.subscriptionHeader}>
                  <Text weight="semibold">{sub.model?.name || 'Unknown Model'}</Text>
                  <Badge appearance="filled" color="success">Active</Badge>
                </div>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  {sub.usage_this_period.toLocaleString()} tokens used
                </Text>
                <div className={styles.usageBar}>
                  <div
                    className={styles.usageProgress}
                    style={{ width: `${Math.min((sub.usage_this_period / 1000000) * 100, 100)}%` }}
                  />
                </div>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
                  ${sub.cost_this_period.toFixed(2)} this period
                </Text>
              </Card>
            ))}
          </div>
        ) : (
          <Card style={{ padding: tokens.spacingVerticalL, marginTop: tokens.spacingVerticalM }}>
            <Text style={{ color: tokens.colorNeutralForeground3 }}>
              No active subscriptions. Visit the Marketplace to subscribe to AI models.
            </Text>
          </Card>
        )}
      </div>
    </div>
  );
}
