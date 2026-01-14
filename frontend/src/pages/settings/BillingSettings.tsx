import { useQuery, useMutation } from '@tanstack/react-query';
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
import { Launch } from '@carbon/icons-react';
import { billingApi } from '../../services/api';
import { UsageSummary } from '../../types';

export default function BillingSettings() {
  const { data: usage, isLoading: usageLoading } = useQuery<UsageSummary>({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.getUsage().then(res => res.data),
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => billingApi.getInvoices().then(res => res.data),
  });

  const portalMutation = useMutation({
    mutationFn: () => billingApi.getPortal(window.location.href),
    onSuccess: (response) => {
      window.location.href = response.data.url;
    },
  });

  if (usageLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading billing information..." withOverlay={false} />
      </div>
    );
  }

  const totalRequests = Number(usage?.total_requests) || 0;
  const totalInputTokens = Number(usage?.total_input_tokens) || 0;
  const totalOutputTokens = Number(usage?.total_output_tokens) || 0;
  const totalCost = Number(usage?.total_cost) || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Tile style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '0.5rem' }}>Current Usage</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {usage?.period_start && new Date(usage.period_start).toLocaleDateString()} - {usage?.period_end && new Date(usage.period_end).toLocaleDateString()}
            </p>
          </div>
          <Button
            kind="tertiary"
            renderIcon={Launch}
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
          >
            Manage Billing
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 300 }}>{totalRequests.toLocaleString()}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Requests</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 300 }}>{(totalInputTokens + totalOutputTokens).toLocaleString()}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Tokens</div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-primary)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 300 }}>${totalCost.toFixed(2)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Current Bill</div>
          </div>
        </div>

        {usage?.by_model && usage.by_model.length > 0 && (
          <>
            <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Usage by Model</h3>
            <Table>
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
                    <TableCell>{model.requests.toLocaleString()}</TableCell>
                    <TableCell>{(model.input_tokens + model.output_tokens).toLocaleString()}</TableCell>
                    <TableCell>${model.cost.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Tile>

      <Tile style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '1.5rem' }}>Invoices</h2>

        {invoicesLoading ? (
          <Loading small withOverlay={false} />
        ) : invoices?.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Period</TableHeader>
                <TableHeader>Amount</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((invoice: { id: string; period_start: string; period_end: string; amount_due: number; currency: string; status: string; pdf_url?: string }) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    ${(invoice.amount_due / 100).toFixed(2)} {invoice.currency.toUpperCase()}
                  </TableCell>
                  <TableCell>
                    <Tag type={invoice.status === 'paid' ? 'green' : 'magenta'}>
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
