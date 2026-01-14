import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Tile,
  ClickableTile,
  Loading,
  Tag,
  Button,
  TextInput,
  Dropdown,
} from '@carbon/react';
import { useState } from 'react';
import { modelsApi } from '../../services/api';
import { AIModel } from '../../types';

const categories = [
  { id: '', text: 'All Categories' },
  { id: 'legal', text: 'Legal' },
  { id: 'healthcare', text: 'Healthcare' },
  { id: 'ecommerce', text: 'E-Commerce' },
  { id: 'customer_support', text: 'Customer Support' },
  { id: 'finance', text: 'Finance' },
  { id: 'education', text: 'Education' },
  { id: 'general', text: 'General' },
];

export default function MarketplacePage() {
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

  const getCategoryColor = (cat: string): 'blue' | 'green' | 'magenta' | 'purple' | 'teal' | 'cyan' => {
    const colors: Record<string, 'blue' | 'green' | 'magenta' | 'purple' | 'teal' | 'cyan'> = {
      legal: 'blue',
      healthcare: 'green',
      ecommerce: 'magenta',
      customer_support: 'teal',
      finance: 'purple',
      education: 'cyan',
      general: 'teal',
    };
    return colors[cat] || 'teal';
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading models..." withOverlay={false} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 400, marginBottom: '0.5rem' }}>AI Model Marketplace</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Browse and subscribe to specialized AI models</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <TextInput
            id="search"
            labelText=""
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: '280px' }}
          />
          <Dropdown
            id="category"
            titleText=""
            label="Category"
            items={categories}
            itemToString={(item) => item?.text || ''}
            selectedItem={categories.find(c => c.id === category)}
            onChange={({ selectedItem }) => setCategory(selectedItem?.id || '')}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {filteredModels?.map(model => (
          <ClickableTile
            key={model.id}
            onClick={() => navigate(`/marketplace/${model.id}`)}
            style={{ padding: '1.5rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
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
              }}>
                {model.icon_url ? (
                  <img src={model.icon_url} alt={model.name} style={{ width: '100%', height: '100%', borderRadius: '8px' }} />
                ) : (
                  model.name.charAt(0).toUpperCase()
                )}
              </div>
              <Tag type={getCategoryColor(model.category)}>
                {model.category.replace('_', ' ')}
              </Tag>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{model.name}</h3>
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              marginBottom: '1rem',
              minHeight: '2.5rem',
            }}>
              {model.description || 'No description available'}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{formatPrice(model)}</span>
              <Button size="sm" kind="primary">View Details</Button>
            </div>
          </ClickableTile>
        ))}
      </div>

      {filteredModels?.length === 0 && (
        <Tile style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No models found matching your criteria.</p>
        </Tile>
      )}
    </div>
  );
}
