import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Card,
  Text,
  Spinner,
  Badge,
  Button,
  Input,
  Dropdown,
  Option,
} from '@fluentui/react-components';
import { Search24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { modelsApi } from '../../services/api';
import { AIModel } from '../../types';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
  },
  filters: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  searchInput: {
    minWidth: '300px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  card: {
    padding: tokens.spacingVerticalL,
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease',
    '&:hover': {
      boxShadow: tokens.shadow16,
    },
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalM,
  },
  modelIcon: {
    width: '48px',
    height: '48px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: tokens.fontSizeBase600,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorBrandForeground1,
  },
  modelName: {
    marginBottom: tokens.spacingVerticalXS,
  },
  description: {
    color: tokens.colorNeutralForeground3,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    marginBottom: tokens.spacingVerticalM,
  },
  pricing: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
  },
});

const categories = [
  { value: '', label: 'All Categories' },
  { value: 'legal', label: 'Legal' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'customer_support', label: 'Customer Support' },
  { value: 'finance', label: 'Finance' },
  { value: 'education', label: 'Education' },
  { value: 'general', label: 'General' },
];

export default function MarketplacePage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const { data: models, isLoading } = useQuery<AIModel[]>({
    queryKey: ['models', category],
    queryFn: () => modelsApi.list({ category: category || undefined }).then(res => res.data),
  });

  const filteredModels = models?.filter(model =>
    model.name.toLowerCase().includes(search.toLowerCase()) ||
    model.description?.toLowerCase().includes(search.toLowerCase())
  );

  const formatPrice = (model: AIModel) => {
    if (!model.pricing) return 'Free';
    const { pricing } = model;
    if (pricing.monthly_subscription_price > 0) {
      return `$${pricing.monthly_subscription_price}/mo`;
    }
    if (pricing.price_per_1k_input_tokens > 0) {
      return `$${pricing.price_per_1k_input_tokens}/1K tokens`;
    }
    if (pricing.price_per_request > 0) {
      return `$${pricing.price_per_request}/request`;
    }
    return 'Free';
  };

  const getCategoryBadge = (cat: string) => {
    const colors: Record<string, 'brand' | 'success' | 'warning' | 'danger' | 'informative'> = {
      legal: 'brand',
      healthcare: 'success',
      ecommerce: 'warning',
      customer_support: 'informative',
      finance: 'brand',
      education: 'success',
      general: 'informative',
    };
    return colors[cat] || 'informative';
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Spinner size="large" label="Loading models..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Text size={700} weight="semibold" block>AI Model Marketplace</Text>
          <Text style={{ color: tokens.colorNeutralForeground3 }}>
            Browse and subscribe to specialized AI models
          </Text>
        </div>
        <div className={styles.filters}>
          <Input
            className={styles.searchInput}
            contentBefore={<Search24Regular />}
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Dropdown
            placeholder="Category"
            value={categories.find(c => c.value === category)?.label}
            onOptionSelect={(_, data) => setCategory(data.optionValue as string)}
          >
            {categories.map(cat => (
              <Option key={cat.value} value={cat.value}>{cat.label}</Option>
            ))}
          </Dropdown>
        </div>
      </div>

      <div className={styles.grid}>
        {filteredModels?.map(model => (
          <Card
            key={model.id}
            className={styles.card}
            onClick={() => navigate(`/marketplace/${model.id}`)}
          >
            <div className={styles.cardHeader}>
              <div className={styles.modelIcon}>
                {model.icon_url ? (
                  <img src={model.icon_url} alt={model.name} style={{ width: '100%', height: '100%' }} />
                ) : (
                  model.name.charAt(0).toUpperCase()
                )}
              </div>
              <Badge color={getCategoryBadge(model.category)} appearance="outline">
                {model.category.replace('_', ' ')}
              </Badge>
            </div>

            <Text size={500} weight="semibold" className={styles.modelName} block>
              {model.name}
            </Text>
            <Text size={300} className={styles.description}>
              {model.description || 'No description available'}
            </Text>

            <div className={styles.pricing}>
              <Text weight="semibold" style={{ color: tokens.colorBrandForeground1 }}>
                {formatPrice(model)}
              </Text>
              <Button appearance="primary" size="small">
                View Details
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredModels?.length === 0 && (
        <Card style={{ padding: tokens.spacingVerticalXL, textAlign: 'center' }}>
          <Text style={{ color: tokens.colorNeutralForeground3 }}>
            No models found matching your criteria.
          </Text>
        </Card>
      )}
    </div>
  );
}
