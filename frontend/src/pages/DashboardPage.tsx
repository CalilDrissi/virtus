import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Tile, Loading, Tag, Button } from '@carbon/react';
import { Chat, ArrowRight, ShoppingCart } from '@carbon/icons-react';
import { subscriptionsApi, billingApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { Subscription } from '../types';

export default function DashboardPage() {
  const { organization } = useAuthStore();
  const navigate = useNavigate();

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery<Subscription[]>({
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

      {/* Stats Grid */}
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

      {/* My AI Models Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 400 }}>
          My AI Models
        </h2>
        <Button
          kind="ghost"
          size="sm"
          renderIcon={ShoppingCart}
          onClick={() => navigate('/marketplace')}
        >
          Browse Marketplace
        </Button>
      </div>

      {subscriptions && subscriptions.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {subscriptions.map((sub) => (
            <Tile
              key={sub.id}
              style={{
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
              }}
              onClick={() => navigate(`/subscriptions/${sub.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: 'var(--brand-primary)',
                  flexShrink: 0,
                }}>
                  {sub.model?.icon_url ? (
                    <img
                      src={sub.model.icon_url}
                      alt={sub.model.name}
                      style={{ width: '100%', height: '100%', borderRadius: '8px' }}
                    />
                  ) : (
                    sub.model?.name?.charAt(0).toUpperCase() || 'M'
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {sub.model?.name || 'Unknown Model'}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Tag type="green" size="sm">Active</Tag>
                    <Tag type="outline" size="sm">{sub.model?.category?.replace('_', ' ')}</Tag>
                  </div>
                </div>
              </div>

              <p style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginBottom: '1rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {sub.model?.description || 'No description available'}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {(sub.data_sources?.length || 0) + (sub.model?.data_sources?.length || 0)} data source(s) linked
                </div>
                <Button
                  kind="primary"
                  size="sm"
                  renderIcon={Chat}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/subscriptions/${sub.id}`);
                  }}
                >
                  Open
                </Button>
              </div>
            </Tile>
          ))}
        </div>
      ) : (
        <Tile style={{ padding: '3rem', textAlign: 'center' }}>
          <ShoppingCart size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '0.5rem' }}>
            No AI models yet
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Subscribe to AI models from the marketplace to start chatting
          </p>
          <Button
            kind="primary"
            renderIcon={ArrowRight}
            onClick={() => navigate('/marketplace')}
          >
            Browse Marketplace
          </Button>
        </Tile>
      )}
    </div>
  );
}
