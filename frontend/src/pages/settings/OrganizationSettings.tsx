import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  makeStyles,
  tokens,
  Card,
  Text,
  Input,
  Button,
  Badge,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import { useAuthStore } from '../../stores/authStore';
import { organizationsApi } from '../../services/api';

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalXL,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    maxWidth: '400px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  planSection: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalL,
  },
});

export default function OrganizationSettings() {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const { organization, fetchUser } = useAuthStore();
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    slug: organization?.slug || '',
  });
  const [success, setSuccess] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => organizationsApi.update(data),
    onSuccess: () => {
      fetchUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const getPlanBadgeColor = (plan: string) => {
    const colors: Record<string, 'informative' | 'success' | 'warning' | 'brand'> = {
      free: 'informative',
      starter: 'success',
      pro: 'warning',
      enterprise: 'brand',
    };
    return colors[plan] || 'informative';
  };

  return (
    <Card className={styles.card}>
      <Text size={600} weight="semibold" block style={{ marginBottom: tokens.spacingVerticalL }}>
        Organization Settings
      </Text>

      <div className={styles.planSection}>
        <Text weight="semibold">Current Plan:</Text>
        <Badge color={getPlanBadgeColor(organization?.plan || 'free')} size="large">
          {organization?.plan?.toUpperCase()}
        </Badge>
        <Button appearance="outline" size="small">Upgrade</Button>
      </div>

      {success && (
        <MessageBar intent="success" style={{ marginBottom: tokens.spacingVerticalM }}>
          <MessageBarBody>Settings saved successfully!</MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.form}>
        <div className={styles.field}>
          <Text weight="semibold">Organization Name</Text>
          <Input
            value={formData.name}
            onChange={handleChange('name')}
          />
        </div>

        <div className={styles.field}>
          <Text weight="semibold">Slug</Text>
          <Input
            value={formData.slug}
            onChange={handleChange('slug')}
          />
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Used in URLs and API calls
          </Text>
        </div>

        <Button
          appearance="primary"
          onClick={() => updateMutation.mutate(formData)}
          disabled={updateMutation.isPending}
        >
          Save Changes
        </Button>
      </div>
    </Card>
  );
}
