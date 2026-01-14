import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Tile,
  Button,
  Loading,
  Tag,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import { Launch, ArrowRight } from '@carbon/icons-react';
import { billingApi, subscriptionsApi, organizationsApi } from '../../services/api';

interface UsageSummary {
  period_start: string;
  period_end: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_requests: number;
  total_cost: number;
  by_model: Array<{
    model_id: string;
    model_name: string;
    input_tokens: number;
    output_tokens: number;
    requests: number;
    cost: number;
  }>;
}

interface SubscriptionWithUsage {
  id: string;
  organization_id: string;
  model_id: string;
  status: string;
  usage_this_period: number;
  cost_this_period: number;
  model?: {
    name: string;
    provider: string;
    category: string;
    pricing?: {
      monthly_subscription_price: number;
      price_per_1k_input_tokens: number;
      included_tokens: number;
    };
  };
}

export default function BillingSettings() {
  const navigate = useNavigate();

  const { data: organization, isLoading: orgLoading, error: orgError } = useQuery({
    queryKey: ['current-org'],
    queryFn: () => organizationsApi.getCurrent().then(res => res.data),
  });

  const { data: usage, isLoading: usageLoading, error: usageError } = useQuery<UsageSummary>({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.getUsage().then(res => res.data),
  });

  const { data: subscriptions, isLoading: subsLoading } = useQuery<SubscriptionWithUsage[]>({
    queryKey: ['active-subscriptions'],
    queryFn: () => subscriptionsApi.listActive().then(res => res.data),
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery<Array<{
    id: string;
    period_start: string;
    period_end: string;
    amount_due: number;
    currency: string;
    status: string;
    pdf_url?: string;
  }>>({
    queryKey: ['invoices'],
    queryFn: () => billingApi.getInvoices().then(res => res.data),
  });

  const portalMutation = useMutation({
    mutationFn: () => billingApi.getPortal(window.location.href),
    onSuccess: (response) => {
      window.location.href = response.data.url;
    },
  });

  if (usageLoading || orgLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading billing information..." withOverlay={false} />
      </div>
    );
  }

  if (orgError || usageError) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p>Failed to load billing information. Please try again later.</p>
      </div>
    );
  }

  const totalRequests = Number(usage?.total_requests) || 0;
  const totalInputTokens = Number(usage?.total_input_tokens) || 0;
  const totalOutputTokens = Number(usage?.total_output_tokens) || 0;
  const totalCost = Number(usage?.total_cost) || 0;
  const creditBalance = Number(organization?.credit_balance) || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Credit Balance and Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        <Tile style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Credit Balance</div>
          <div style={{ fontSize: '2rem', fontWeight: 300, color: creditBalance > 0 ? 'var(--support-success)' : 'var(--text-primary)' }}>
            ${creditBalance.toFixed(2)}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Available credits for usage
          </p>
        </Tile>

        <Tile style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Current Period Cost</div>
          <div style={{ fontSize: '2rem', fontWeight: 300 }}>${totalCost.toFixed(2)}</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {usage?.period_start ? new Date(usage.period_start).toLocaleDateString() : ''} - {usage?.period_end ? new Date(usage.period_end).toLocaleDateString() : ''}
          </p>
        </Tile>

        <Tile style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Active Subscriptions</div>
          <div style={{ fontSize: '2rem', fontWeight: 300 }}>{subscriptions?.length || 0}</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Model subscriptions
          </p>
        </Tile>
      </div>

      {/* Active Subscriptions */}
      <Tile style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Active Subscriptions</h2>
          <Button kind="ghost" size="sm" onClick={() => navigate('/marketplace')}>
            Browse Models
          </Button>
        </div>

        {subsLoading ? (
          <Loading small withOverlay={false} />
        ) : subscriptions && subscriptions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/subscriptions/${sub.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{sub.model?.name || 'Unknown Model'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {sub.model?.provider || 'Unknown'} • {sub.model?.category || 'Unknown'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Tag type="green" size="sm">{sub.status}</Tag>
                    <ArrowRight size={16} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Usage</div>
                    <div>{(sub.usage_this_period || 0).toLocaleString()} tokens</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Cost</div>
                    <div>${Number(sub.cost_this_period || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Price</div>
                    <div>
                      {sub.model?.pricing?.monthly_subscription_price
                        ? `$${sub.model.pricing.monthly_subscription_price}/mo`
                        : sub.model?.pricing?.price_per_1k_input_tokens
                        ? `$${sub.model.pricing.price_per_1k_input_tokens}/1K tokens`
                        : 'Free'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            <p>No active subscriptions</p>
            <Button kind="primary" size="sm" style={{ marginTop: '1rem' }} onClick={() => navigate('/marketplace')}>
              Browse Marketplace
            </Button>
          </div>
        )}
      </Tile>

      {/* Usage Summary */}
      <Tile style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Usage Summary</h2>
          <Button
            kind="tertiary"
            size="sm"
            renderIcon={Launch}
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
          >
            Manage Billing
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 300 }}>{totalRequests.toLocaleString()}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Requests</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 300 }}>{totalInputTokens.toLocaleString()}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Input Tokens</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 300 }}>{totalOutputTokens.toLocaleString()}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Output Tokens</div>
          </div>
        </div>

        {usage?.by_model && usage.by_model.length > 0 && (
          <>
            <h3 style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.875rem' }}>Usage by Model</h3>
            <Table size="sm">
              <TableHead>
                <TableRow>
                  <TableHeader>Model</TableHeader>
                  <TableHeader>Requests</TableHeader>
                  <TableHeader>Tokens</TableHeader>
                  <TableHeader>Cost</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {usage.by_model.map((model, index) => (
                  <TableRow key={index}>
                    <TableCell>{model.model_name}</TableCell>
                    <TableCell>{Number(model.requests).toLocaleString()}</TableCell>
                    <TableCell>{(Number(model.input_tokens) + Number(model.output_tokens)).toLocaleString()}</TableCell>
                    <TableCell>${Number(model.cost).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Tile>

      {/* Invoices */}
      <Tile style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Invoices</h2>

        {invoicesLoading ? (
          <Loading small withOverlay={false} />
        ) : invoices && invoices.length > 0 ? (
          <Table size="sm">
            <TableHead>
              <TableRow>
                <TableHeader>Period</TableHeader>
                <TableHeader>Amount</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    ${(Number(invoice.amount_due) / 100).toFixed(2)} {invoice.currency.toUpperCase()}
                  </TableCell>
                  <TableCell>
                    <Tag type={invoice.status === 'paid' ? 'green' : 'magenta'} size="sm">
                      {invoice.status}
                    </Tag>
                  </TableCell>
                  <TableCell>
                    {invoice.pdf_url && (
                      <Button
                        kind="ghost"
                        size="sm"
                        onClick={() => window.open(invoice.pdf_url, '_blank')}
                      >
                        Download
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>No invoices yet.</p>
        )}
      </Tile>
    </div>
  );
}
