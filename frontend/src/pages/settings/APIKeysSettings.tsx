import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Tile,
  Button,
  Tag,
  ClickableTile,
} from '@carbon/react';
import { ArrowRight, Key, Bot } from '@carbon/icons-react';
import { subscriptionsApi } from '../../services/api';
import { Subscription } from '../../types';

export default function APIKeysSettings() {
  const navigate = useNavigate();

  const { data: subscriptions, isLoading } = useQuery<Subscription[]>({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionsApi.list().then(res => res.data),
  });

  const activeSubscriptions = subscriptions?.filter(s => s.status === 'active') || [];

  return (
    <Tile style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '0.5rem' }}>API Keys</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          API keys are now managed per model subscription for better security and access control.
        </p>
      </div>

      <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem', backgroundColor: 'var(--layer-01)' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <Key size={24} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Per-Model API Keys
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Each API key is now scoped to a specific AI model. This allows for better access control
              and easier management of which models can be accessed programmatically.
            </p>
          </div>
        </div>
      </Tile>

      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
        Your Model Subscriptions
      </h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
        Click on a subscription to manage its API keys:
      </p>

      {isLoading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading subscriptions...</p>
      ) : activeSubscriptions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {activeSubscriptions.map((subscription) => (
            <ClickableTile
              key={subscription.id}
              onClick={() => navigate(`/subscriptions/${subscription.id}`)}
              style={{ padding: '1rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {subscription.model?.icon_url ? (
                      <img
                        src={subscription.model.icon_url}
                        alt={subscription.model.name}
                        style={{ width: '100%', height: '100%', borderRadius: '8px' }}
                      />
                    ) : (
                      <Bot size={20} />
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {subscription.model?.name || 'Unknown Model'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {subscription.model?.provider} • {subscription.model?.category}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Tag type="green" size="sm">{subscription.status}</Tag>
                  <ArrowRight size={16} />
                </div>
              </div>
            </ClickableTile>
          ))}
        </div>
      ) : (
        <Tile style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            No active subscriptions. Subscribe to a model to create API keys.
          </p>
          <Button kind="primary" onClick={() => navigate('/marketplace')}>
            Browse Marketplace
          </Button>
        </Tile>
      )}
    </Tile>
  );
}
