import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Tile,
  ClickableTile,
  Loading,
  Tag,
  Button,
  TextInput,
} from '@carbon/react';
import {
  Grid,
  Policy,
  Hospital,
  ShoppingCart,
  Chat,
  Finance,
  Education,
  Apps,
  Bot,
  Document,
  Analytics,
  Email,
  Cloud,
  Code,
  DataBase,
  Help,
} from '@carbon/icons-react';
import { useState } from 'react';
import { modelsApi, categoriesApi } from '../../services/api';
import { AIModel } from '../../types';

interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sort_order: number;
  is_active: boolean;
}

// Map icon names from database to Carbon icons
const iconMap: Record<string, typeof Grid> = {
  Grid,
  Policy,
  DocumentView: Policy,
  Hospital,
  ShoppingCart,
  Chat,
  Finance,
  Currency: Finance,
  Education,
  Apps,
  Bot,
  Document,
  Analytics,
  Email,
  Cloud,
  Code,
  DataBase,
  Help,
};

const getIcon = (iconName?: string): typeof Grid => {
  if (!iconName) return Apps;
  return iconMap[iconName] || Apps;
};

export default function MarketplacePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  // Fetch categories from API
  const { data: categoriesData } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list({ active_only: true }).then(res => res.data),
  });

  const { data: models, isLoading, isFetching } = useQuery<AIModel[]>({
    queryKey: ['models', category],
    queryFn: () => modelsApi.list({ category: category || undefined }).then(res => res.data),
  });

  // Build categories array with "All" option
  const categories = [
    { id: '', slug: '', name: 'All', icon: 'Grid', color: 'gray' },
    ...(categoriesData || []).map(cat => ({
      id: cat.slug,
      slug: cat.slug,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
    })),
  ];

  const filteredModels = models?.filter(model =>
    model.name.toLowerCase().includes(search.toLowerCase()) ||
    model.description?.toLowerCase().includes(search.toLowerCase())
  );

  const formatPrice = (model: AIModel) => {
    if (!model.pricing) return 'Free';
    const { pricing } = model;
    if (Number(pricing.monthly_subscription_price) > 0) {
      return `$${Number(pricing.monthly_subscription_price)}/mo`;
    }
    if (Number(pricing.price_per_1k_input_tokens) > 0) {
      return `$${Number(pricing.price_per_1k_input_tokens)}/1K tokens`;
    }
    if (Number(pricing.price_per_request) > 0) {
      return `$${Number(pricing.price_per_request)}/request`;
    }
    return 'Free';
  };

  const getCategoryColor = (cat: string): 'blue' | 'green' | 'magenta' | 'purple' | 'teal' | 'cyan' | 'gray' => {
    const categoryData = categoriesData?.find(c => c.slug === cat);
    const color = categoryData?.color || 'teal';
    // Map to valid Carbon tag types
    const validColors = ['blue', 'green', 'magenta', 'purple', 'teal', 'cyan', 'gray'];
    return validColors.includes(color) ? color as any : 'teal';
  };

  const getCategoryName = (slug: string): string => {
    const categoryData = categoriesData?.find(c => c.slug === slug);
    return categoryData?.name || slug.replace('_', ' ');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 400, marginBottom: '0.5rem' }}>AI Model Marketplace</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Browse and subscribe to specialized AI models</p>
      </div>

      {/* Category Filter Buttons + Search */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}>
          {categories.map((cat) => {
            const Icon = getIcon(cat.icon);
            const isActive = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '9999px',
                  backgroundColor: isActive ? 'var(--brand-primary)' : 'var(--layer-01)',
                  color: isActive ? 'var(--white)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 2px 8px rgba(0, 82, 255, 0.3)' : 'none',
                }}
              >
                <Icon size={16} />
                {cat.name}
              </button>
            );
          })}
        </div>
        <TextInput
          id="search"
          labelText=""
          placeholder="Search models..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: '240px', maxWidth: '300px' }}
        />
      </div>

      {/* Models Grid */}
      <div style={{ position: 'relative', minHeight: '200px' }}>
        {/* Loading overlay for grid only */}
        {isFetching && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            borderRadius: '8px',
          }}>
            <Loading description="Loading models..." withOverlay={false} small />
          </div>
        )}

        {!isLoading && filteredModels && filteredModels.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {filteredModels.map(model => (
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
                    {getCategoryName(model.category)}
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
        )}

        {!isLoading && filteredModels?.length === 0 && (
          <Tile style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No models found matching your criteria.</p>
          </Tile>
        )}
      </div>
    </div>
  );
}
