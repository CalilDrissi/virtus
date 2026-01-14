import { useQuery } from '@tanstack/react-query';
import { Tile, Loading, Tag } from '@carbon/react';
import { subscriptionsApi, billingApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

export default function DashboardPage() {
  const { organization } = useAuthStore();

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery({
    queryKey: ['active-subscriptions'],
    queryFn: () => subscriptionsApi.listActive().then(res => res.data),
  });

  const { data: usage, isLoading: usageLoading } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.getUsage().then(res => res.data),
  });

  if (subsLoading || usageLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading dashboard..." withOverlay={false} />
      </div>
    );
  }

  const totalRequests = Number(usage?.total_requests) || 0;
  const totalInputTokens = Number(usage?.total_input_tokens) || 0;
  const totalOutputTokens = Number(usage?.total_output_tokens) || 0;
  const totalCost = Number(usage?.total_cost) || 0;

  return (
    <div>
      <h1 style={{ fontSize: '2rem', fontWeight: 400, marginBottom: '0.5rem' }}>
        Welcome back
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Here's what's happening with {organization?.name}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <Tile style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 300, color: 'var(--text-primary)' }}>
            {subscriptions?.length || 0}
          </div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Active Subscriptions
          </div>
        </Tile>
        <Tile style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 300, color: 'var(--text-primary)' }}>
            {totalRequests.toLocaleString()}
          </div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            API Requests
          </div>
        </Tile>
        <Tile style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 300, color: 'var(--text-primary)' }}>
            {(totalInputTokens + totalOutputTokens).toLocaleString()}
          </div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Total Tokens
          </div>
        </Tile>
        <Tile style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 300, color: 'var(--text-primary)' }}>
            ${totalCost.toFixed(2)}
          </div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Current Bill
          </div>
        </Tile>
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '1rem' }}>
        Active Subscriptions
      </h2>
      {subscriptions && subscriptions.length > 0 ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {subscriptions.map((sub: any) => (
            <Tile key={sub.id} style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 500 }}>{sub.model?.name || 'Unknown Model'}</span>
              <Tag type="green">Active</Tag>
            </Tile>
          ))}
        </div>
      ) : (
        <Tile style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
          No active subscriptions. Visit the Marketplace to subscribe to AI models.
        </Tile>
      )}
    </div>
  );
}
