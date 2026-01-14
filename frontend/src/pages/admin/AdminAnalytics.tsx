import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Tile,
  Loading,
  Dropdown,
  Tag,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import { ArrowUp, ArrowDown } from '@carbon/icons-react';
import { LineChart, SimpleBarChart, DonutChart } from '@carbon/charts-react';
import { ScaleTypes } from '@carbon/charts';
import '@carbon/charts-react/styles.css';
import { adminApi } from '../../services/api';

const timeRanges = [
  { id: 7, text: 'Last 7 days' },
  { id: 14, text: 'Last 14 days' },
  { id: 30, text: 'Last 30 days' },
  { id: 60, text: 'Last 60 days' },
  { id: 90, text: 'Last 90 days' },
];

interface UsageData {
  date: string;
  total_tokens: number;
  requests: number;
  revenue: number;
}

interface TopModel {
  model_id: string;
  model_name: string;
  provider: string;
  total_tokens: number;
  total_requests: number;
  total_revenue: number;
}

interface TopOrg {
  organization_id: string;
  organization_name: string;
  plan: string;
  total_tokens: number;
  total_requests: number;
  total_spent: number;
}

interface AnalyticsSummary {
  this_month: {
    requests: number;
    tokens: number;
    revenue: number;
    new_users: number;
    new_subscriptions: number;
  };
  last_month: {
    requests: number;
    tokens: number;
    revenue: number;
    new_users: number;
    new_subscriptions: number;
  };
  changes: {
    requests: number;
    tokens: number;
    revenue: number;
    new_users: number;
    new_subscriptions: number;
  };
}

export default function AdminAnalytics() {
  const [days, setDays] = useState(30);

  const { data: summary, isLoading: summaryLoading } = useQuery<AnalyticsSummary>({
    queryKey: ['analytics-summary'],
    queryFn: () => adminApi.getAnalyticsSummary().then(res => res.data),
  });

  const { data: usageOverTime, isLoading: usageLoading } = useQuery<UsageData[]>({
    queryKey: ['usage-over-time', days],
    queryFn: () => adminApi.getUsageOverTime(days).then(res => res.data),
  });

  const { data: topModels } = useQuery<TopModel[]>({
    queryKey: ['top-models', days],
    queryFn: () => adminApi.getTopModels({ days, limit: 10 }).then(res => res.data),
  });

  const { data: topOrgs } = useQuery<TopOrg[]>({
    queryKey: ['top-orgs', days],
    queryFn: () => adminApi.getTopOrganizations({ days, limit: 10 }).then(res => res.data),
  });

  const { data: revenueByModel } = useQuery({
    queryKey: ['revenue-by-model', days],
    queryFn: () => adminApi.getRevenueByModel(days).then(res => res.data),
  });

  if (summaryLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading analytics..." withOverlay={false} />
      </div>
    );
  }

  const ChangeIndicator = ({ value }: { value: number }) => {
    const isPositive = value >= 0;
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        color: isPositive ? 'var(--support-success)' : 'var(--support-error)',
        fontSize: '0.75rem',
      }}>
        {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        {Math.abs(value)}%
      </span>
    );
  };

  // Prepare chart data
  const usageChartData = usageOverTime?.map(d => ({
    group: 'Requests',
    date: d.date,
    value: d.requests,
  })) || [];

  const tokenChartData = usageOverTime?.map(d => ({
    group: 'Tokens',
    date: d.date,
    value: d.total_tokens,
  })) || [];

  const revenueDonutData = revenueByModel?.map((m: { model_name: string; revenue: number }) => ({
    group: m.model_name,
    value: m.revenue,
  })) || [];

  const chartOptions = {
    axes: {
      bottom: {
        mapsTo: 'date',
        scaleType: ScaleTypes.TIME,
      },
      left: {
        mapsTo: 'value',
        scaleType: ScaleTypes.LINEAR,
      },
    },
    height: '300px',
    theme: 'g90' as const,
    toolbar: { enabled: false },
    legend: { enabled: false },
    grid: { x: { enabled: false }, y: { enabled: true } },
  };

  const donutOptions = {
    height: '300px',
    theme: 'g90' as const,
    resizable: true,
    donut: { center: { label: 'Revenue' } },
    legend: { position: 'right' as const },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 400, marginBottom: '0.5rem' }}>Analytics</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Platform usage trends and insights</p>
        </div>
        <Dropdown
          id="time-range"
          titleText=""
          label="Select time range"
          items={timeRanges}
          itemToString={(item) => item?.text || ''}
          selectedItem={timeRanges.find(t => t.id === days)}
          onChange={({ selectedItem }) => setDays(selectedItem?.id || 30)}
          style={{ minWidth: '160px' }}
        />
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <Tile style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Requests (This Month)
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 300 }}>
            {summary?.this_month.requests.toLocaleString() || 0}
          </div>
          <ChangeIndicator value={summary?.changes.requests || 0} />
        </Tile>

        <Tile style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Tokens (This Month)
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 300 }}>
            {(summary?.this_month.tokens || 0).toLocaleString()}
          </div>
          <ChangeIndicator value={summary?.changes.tokens || 0} />
        </Tile>

        <Tile style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Revenue (This Month)
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 300 }}>
            ${(summary?.this_month.revenue || 0).toFixed(2)}
          </div>
          <ChangeIndicator value={summary?.changes.revenue || 0} />
        </Tile>

        <Tile style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            New Users (This Month)
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 300 }}>
            {summary?.this_month.new_users || 0}
          </div>
          <ChangeIndicator value={summary?.changes.new_users || 0} />
        </Tile>

        <Tile style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            New Subscriptions
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 300 }}>
            {summary?.this_month.new_subscriptions || 0}
          </div>
          <ChangeIndicator value={summary?.changes.new_subscriptions || 0} />
        </Tile>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <Tile style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Requests Over Time</h2>
          {usageLoading ? (
            <Loading small withOverlay={false} />
          ) : usageChartData.length > 0 ? (
            <LineChart data={usageChartData} options={chartOptions} />
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '4rem' }}>
              No usage data available
            </p>
          )}
        </Tile>

        <Tile style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Revenue by Model</h2>
          {revenueDonutData.length > 0 ? (
            <DonutChart data={revenueDonutData} options={donutOptions} />
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '4rem' }}>
              No revenue data
            </p>
          )}
        </Tile>
      </div>

      {/* Token Usage Chart */}
      <Tile style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Token Usage Over Time</h2>
        {usageLoading ? (
          <Loading small withOverlay={false} />
        ) : tokenChartData.length > 0 ? (
          <SimpleBarChart
            data={tokenChartData}
            options={{
              ...chartOptions,
              bars: { maxWidth: 20 },
            }}
          />
        ) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '4rem' }}>
            No usage data available
          </p>
        )}
      </Tile>

      {/* Tables Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Top Models */}
        <Tile style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Top Models by Usage</h2>
          {topModels && topModels.length > 0 ? (
            <Table size="sm">
              <TableHead>
                <TableRow>
                  <TableHeader>Model</TableHeader>
                  <TableHeader>Requests</TableHeader>
                  <TableHeader>Revenue</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {topModels.slice(0, 5).map((model) => (
                  <TableRow key={model.model_id}>
                    <TableCell>
                      <div style={{ fontWeight: 500 }}>{model.model_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{model.provider}</div>
                    </TableCell>
                    <TableCell>{model.total_requests.toLocaleString()}</TableCell>
                    <TableCell>${model.total_revenue.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
              No model data
            </p>
          )}
        </Tile>

        {/* Top Organizations */}
        <Tile style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Top Organizations by Spend</h2>
          {topOrgs && topOrgs.length > 0 ? (
            <Table size="sm">
              <TableHead>
                <TableRow>
                  <TableHeader>Organization</TableHeader>
                  <TableHeader>Plan</TableHeader>
                  <TableHeader>Spent</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {topOrgs.slice(0, 5).map((org) => (
                  <TableRow key={org.organization_id}>
                    <TableCell>
                      <div style={{ fontWeight: 500 }}>{org.organization_name}</div>
                    </TableCell>
                    <TableCell>
                      <Tag type="blue" size="sm">{org.plan}</Tag>
                    </TableCell>
                    <TableCell>${org.total_spent.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
              No organization data
            </p>
          )}
        </Tile>
      </div>
    </div>
  );
}
