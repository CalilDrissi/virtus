import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tile,
  Button,
  Loading,
  Tag,
  InlineLoading,
} from '@carbon/react';
import { ArrowLeft, Checkmark, Money, DataBase, ArrowRight, Play } from '@carbon/icons-react';
import { modelsApi, subscriptionsApi } from '../../services/api';
import { AIModel, Subscription } from '../../types';

export default function ModelDetailPage() {
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: model, isLoading } = useQuery<AIModel>({
    queryKey: ['model', modelId],
    queryFn: () => modelsApi.get(modelId!).then(res => res.data),
    enabled: !!modelId,
  });

  // Check if user has an active subscription for this model
  const { data: subscriptions } = useQuery<Subscription[]>({
    queryKey: ['subscriptions', 'active'],
    queryFn: () => subscriptionsApi.listActive().then(res => res.data),
  });

  const subscription = subscriptions?.find(s => s.model_id === modelId);

  const subscribeMutation = useMutation({
    mutationFn: () => subscriptionsApi.checkout({
      model_id: modelId!,
      success_url: `${window.location.origin}/marketplace/${modelId}?subscribed=true`,
      cancel_url: `${window.location.origin}/marketplace/${modelId}`,
    }),
    onSuccess: async (response) => {
      // For free subscriptions, fetch the new subscription and navigate to it
      if (response.data.session_id === 'free') {
        await queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        // Fetch updated subscriptions to get the new subscription ID
        const subs = await subscriptionsApi.listActive();
        const newSub = subs.data.find((s: Subscription) => s.model_id === modelId);
        if (newSub) {
          navigate(`/subscriptions/${newSub.id}`);
        } else {
          navigate('/');
        }
      } else {
        window.location.href = response.data.url;
      }
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      console.error('Subscription error:', error);
      alert(error.response?.data?.detail || error.message || 'Failed to subscribe');
    },
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading model..." withOverlay={false} />
      </div>
    );
  }

  if (!model) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>Model not found</p>
      </div>
    );
  }

  const formatPrice = (value: number | string) => `$${Number(value).toFixed(4)}`;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Button
        kind="ghost"
        renderIcon={ArrowLeft}
        onClick={() => navigate('/marketplace')}
        style={{ marginBottom: '1rem' }}
      >
        Back to Marketplace
      </Button>

      <Tile style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '8px',
            backgroundColor: 'var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 600,
            color: 'var(--brand-primary)',
          }}>
            {model.icon_url ? (
              <img src={model.icon_url} alt={model.name} style={{ width: '100%', height: '100%', borderRadius: '8px' }} />
            ) : (
              model.name.charAt(0).toUpperCase()
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 400, marginBottom: '0.5rem' }}>{model.name}</h1>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Tag type="outline">{model.category.replace('_', ' ')}</Tag>
              <Tag type="blue">{model.provider}</Tag>
            </div>
          </div>
        </div>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{model.description || 'No description available.'}</p>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Money size={20} /> Pricing
          </h2>
          <Tile style={{ backgroundColor: 'var(--bg-primary)', padding: '1rem' }}>
            {model.pricing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Number(model.pricing.monthly_subscription_price) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Monthly Subscription</span>
                    <strong>${Number(model.pricing.monthly_subscription_price)}/mo</strong>
                  </div>
                )}
                {Number(model.pricing.price_per_1k_input_tokens) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Input Tokens (per 1K)</span>
                    <strong>{formatPrice(model.pricing.price_per_1k_input_tokens)}</strong>
                  </div>
                )}
                {Number(model.pricing.price_per_1k_output_tokens) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Output Tokens (per 1K)</span>
                    <strong>{formatPrice(model.pricing.price_per_1k_output_tokens)}</strong>
                  </div>
                )}
                {Number(model.pricing.price_per_request) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Per Request</span>
                    <strong>{formatPrice(model.pricing.price_per_request)}</strong>
                  </div>
                )}
                {Number(model.pricing.included_tokens) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Included Tokens</span>
                    <strong>{Number(model.pricing.included_tokens).toLocaleString()}</strong>
                  </div>
                )}
              </div>
            ) : (
              <span>Free to use</span>
            )}
          </Tile>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Features</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Checkmark size={20} style={{ color: 'var(--success)' }} />
              <span>Max {model.max_tokens.toLocaleString()} output tokens</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Checkmark size={20} style={{ color: 'var(--success)' }} />
              <span>Streaming responses supported</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Checkmark size={20} style={{ color: 'var(--success)' }} />
              <span>RAG integration available</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Checkmark size={20} style={{ color: 'var(--success)' }} />
              <span>API & SDK access</span>
            </div>
          </div>
        </div>

        {/* Data Sources Section */}
        {model.data_sources && model.data_sources.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DataBase size={20} /> Knowledge Base
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              This model has access to the following data sources for enhanced responses:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {model.data_sources.map(ds => (
                <Tag key={ds.id} type="blue">{ds.name}</Tag>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem' }}>
          {subscription ? (
            <Button
              kind="primary"
              size="lg"
              renderIcon={ArrowRight}
              onClick={() => navigate(`/subscriptions/${subscription.id}`)}
            >
              Open Model
            </Button>
          ) : (
            <>
              <Button
                kind="primary"
                size="lg"
                onClick={() => subscribeMutation.mutate()}
                disabled={subscribeMutation.isPending}
              >
                {subscribeMutation.isPending ? <InlineLoading description="Processing..." /> : 'Subscribe Now'}
              </Button>
              <Button
                kind="tertiary"
                size="lg"
                renderIcon={Play}
                onClick={() => navigate(`/marketplace/${modelId}/test`)}
              >
                Test Model
              </Button>
            </>
          )}
        </div>
      </Tile>
    </div>
  );
}
