import { useQuery, useMutation } from '@tanstack/react-query';
import {
  makeStyles,
  tokens,
  Card,
  Text,
  Button,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Badge,
  Spinner,
} from '@fluentui/react-components';
import { Open24Regular } from '@fluentui/react-icons';
import { billingApi } from '../../services/api';
import { UsageSummary } from '../../types';

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalXL,
    marginBottom: tokens.spacingVerticalL,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalL,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalL,
  },
  stat: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    textAlign: 'center',
  },
  statValue: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
  },
  statLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
});

export default function BillingSettings() {
  const styles = useStyles();

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
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Spinner size="large" label="Loading billing information..." />
      </div>
    );
  }

  return (
    <div>
      <Card className={styles.card}>
        <div className={styles.header}>
          <div>
            <Text size={600} weight="semibold" block>Current Usage</Text>
            <Text style={{ color: tokens.colorNeutralForeground3 }}>
              {usage?.period_start && new Date(usage.period_start).toLocaleDateString()} - {usage?.period_end && new Date(usage.period_end).toLocaleDateString()}
            </Text>
          </div>
          <Button
            appearance="outline"
            icon={<Open24Regular />}
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
          >
            Manage Billing
          </Button>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.stat}>
            <Text className={styles.statValue} block>
              {usage?.total_requests?.toLocaleString() || 0}
            </Text>
            <Text className={styles.statLabel}>Requests</Text>
          </div>
          <div className={styles.stat}>
            <Text className={styles.statValue} block>
              {((usage?.total_input_tokens || 0) + (usage?.total_output_tokens || 0)).toLocaleString()}
            </Text>
            <Text className={styles.statLabel}>Tokens</Text>
          </div>
          <div className={styles.stat}>
            <Text className={styles.statValue} block>
              ${usage?.total_cost?.toFixed(2) || '0.00'}
            </Text>
            <Text className={styles.statLabel}>Current Bill</Text>
          </div>
        </div>

        {usage?.by_model && usage.by_model.length > 0 && (
          <>
            <Text weight="semibold" block style={{ marginBottom: tokens.spacingVerticalS }}>
              Usage by Model
            </Text>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Model</TableHeaderCell>
                  <TableHeaderCell>Requests</TableHeaderCell>
                  <TableHeaderCell>Tokens</TableHeaderCell>
                  <TableHeaderCell>Cost</TableHeaderCell>
                </TableRow>
              </TableHeader>
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
      </Card>

      <Card className={styles.card}>
        <Text size={600} weight="semibold" block style={{ marginBottom: tokens.spacingVerticalL }}>
          Invoices
        </Text>

        {invoicesLoading ? (
          <Spinner size="small" />
        ) : invoices?.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Period</TableHeaderCell>
                <TableHeaderCell>Amount</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
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
                    <Badge color={invoice.status === 'paid' ? 'success' : 'warning'}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {invoice.pdf_url && (
                      <Button
                        appearance="subtle"
                        size="small"
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
          <Text style={{ color: tokens.colorNeutralForeground3 }}>
            No invoices yet.
          </Text>
        )}
      </Card>
    </div>
  );
}
