import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  makeStyles,
  tokens,
  Card,
  Text,
  Spinner,
  Badge,
  Button,
  Divider,
} from '@fluentui/react-components';
import {
  ArrowLeft24Regular,
  Chat24Regular,
  Money24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';
import { modelsApi, subscriptionsApi } from '../../services/api';
import { AIModel } from '../../types';

const useStyles = makeStyles({
  container: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  backButton: {
    marginBottom: tokens.spacingVerticalM,
  },
  card: {
    padding: tokens.spacingVerticalXL,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalL,
  },
  modelIcon: {
    width: '80px',
    height: '80px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: tokens.fontSizeHero900,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorBrandForeground1,
  },
  headerInfo: {
    flex: 1,
  },
  badges: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
  },
  section: {
    marginTop: tokens.spacingVerticalL,
  },
  pricingCard: {
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    marginTop: tokens.spacingVerticalM,
  },
  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalS,
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalM,
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalL,
  },
});

export default function ModelDetailPage() {
  const styles = useStyles();
  const { modelId } = useParams<{ modelId: string }>();
  const navigate = useNavigate();

  const { data: model, isLoading } = useQuery<AIModel>({
    queryKey: ['model', modelId],
    queryFn: () => modelsApi.get(modelId!).then(res => res.data),
    enabled: !!modelId,
  });

  const subscribeMutation = useMutation({
    mutationFn: () => subscriptionsApi.checkout({
      model_id: modelId!,
      success_url: `${window.location.origin}/marketplace/${modelId}?subscribed=true`,
      cancel_url: `${window.location.origin}/marketplace/${modelId}`,
    }),
    onSuccess: (response) => {
      window.location.href = response.data.url;
    },
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Spinner size="large" label="Loading model..." />
      </div>
    );
  }

  if (!model) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Text>Model not found</Text>
      </div>
    );
  }

  const formatPrice = (value: number) => `$${value.toFixed(4)}`;

  return (
    <div className={styles.container}>
      <Button
        className={styles.backButton}
        appearance="subtle"
        icon={<ArrowLeft24Regular />}
        onClick={() => navigate('/marketplace')}
      >
        Back to Marketplace
      </Button>

      <Card className={styles.card}>
        <div className={styles.header}>
          <div className={styles.modelIcon}>
            {model.icon_url ? (
              <img src={model.icon_url} alt={model.name} style={{ width: '100%', height: '100%' }} />
            ) : (
              model.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className={styles.headerInfo}>
            <Text size={700} weight="semibold" block>{model.name}</Text>
            <div className={styles.badges}>
              <Badge appearance="outline">{model.category.replace('_', ' ')}</Badge>
              <Badge appearance="outline" color="informative">{model.provider}</Badge>
            </div>
          </div>
        </div>

        <Text>{model.description || 'No description available.'}</Text>

        <Divider style={{ margin: `${tokens.spacingVerticalL} 0` }} />

        <div className={styles.section}>
          <Text size={500} weight="semibold" block>
            <Money24Regular style={{ marginRight: tokens.spacingHorizontalS }} />
            Pricing
          </Text>

          <div className={styles.pricingCard}>
            {model.pricing ? (
              <>
                {model.pricing.monthly_subscription_price > 0 && (
                  <div className={styles.priceRow}>
                    <Text>Monthly Subscription</Text>
                    <Text weight="semibold">${model.pricing.monthly_subscription_price}/mo</Text>
                  </div>
                )}
                {model.pricing.price_per_1k_input_tokens > 0 && (
                  <div className={styles.priceRow}>
                    <Text>Input Tokens (per 1K)</Text>
                    <Text weight="semibold">{formatPrice(model.pricing.price_per_1k_input_tokens)}</Text>
                  </div>
                )}
                {model.pricing.price_per_1k_output_tokens > 0 && (
                  <div className={styles.priceRow}>
                    <Text>Output Tokens (per 1K)</Text>
                    <Text weight="semibold">{formatPrice(model.pricing.price_per_1k_output_tokens)}</Text>
                  </div>
                )}
                {model.pricing.price_per_request > 0 && (
                  <div className={styles.priceRow}>
                    <Text>Per Request</Text>
                    <Text weight="semibold">{formatPrice(model.pricing.price_per_request)}</Text>
                  </div>
                )}
                {model.pricing.included_tokens > 0 && (
                  <div className={styles.priceRow}>
                    <Text>Included Tokens</Text>
                    <Text weight="semibold">{model.pricing.included_tokens.toLocaleString()}</Text>
                  </div>
                )}
              </>
            ) : (
              <Text>Free to use</Text>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <Text size={500} weight="semibold" block>Features</Text>
          <div className={styles.features}>
            <div className={styles.feature}>
              <Checkmark24Regular style={{ color: tokens.colorPaletteGreenForeground1 }} />
              <Text>Max {model.max_tokens.toLocaleString()} output tokens</Text>
            </div>
            <div className={styles.feature}>
              <Checkmark24Regular style={{ color: tokens.colorPaletteGreenForeground1 }} />
              <Text>Streaming responses supported</Text>
            </div>
            <div className={styles.feature}>
              <Checkmark24Regular style={{ color: tokens.colorPaletteGreenForeground1 }} />
              <Text>RAG integration available</Text>
            </div>
            <div className={styles.feature}>
              <Checkmark24Regular style={{ color: tokens.colorPaletteGreenForeground1 }} />
              <Text>API & SDK access</Text>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            appearance="primary"
            size="large"
            onClick={() => subscribeMutation.mutate()}
            disabled={subscribeMutation.isPending}
          >
            {subscribeMutation.isPending ? <Spinner size="tiny" /> : 'Subscribe Now'}
          </Button>
          <Button
            appearance="outline"
            size="large"
            icon={<Chat24Regular />}
            onClick={() => navigate(`/chat?model=${model.id}`)}
          >
            Try in Chat
          </Button>
        </div>
      </Card>
    </div>
  );
}
