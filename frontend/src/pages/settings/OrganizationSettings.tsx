import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Tile,
  TextInput,
  Button,
  Tag,
  InlineNotification,
} from '@carbon/react';
import { useAuthStore } from '../../stores/authStore';
import { organizationsApi } from '../../services/api';

export default function OrganizationSettings() {
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

  const getPlanColor = (plan: string): 'blue' | 'green' | 'magenta' | 'purple' => {
    const colors: Record<string, 'blue' | 'green' | 'magenta' | 'purple'> = {
      free: 'blue',
      starter: 'green',
      pro: 'magenta',
      enterprise: 'purple',
    };
    return colors[plan] || 'blue';
  };

  return (
    <Tile style={{ padding: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '1.5rem' }}>
        Organization Settings
      </h2>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
        backgroundColor: 'var(--bg-primary)',
        marginBottom: '1.5rem',
      }}>
        <span style={{ fontWeight: 600 }}>Current Plan:</span>
        <Tag type={getPlanColor(organization?.plan || 'free')} size="md">
          {organization?.plan?.toUpperCase()}
        </Tag>
        <Button kind="tertiary" size="sm">Upgrade</Button>
      </div>

      {success && (
        <InlineNotification
          kind="success"
          title="Success"
          subtitle="Settings saved successfully!"
          lowContrast
          hideCloseButton
          style={{ marginBottom: '1rem' }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '400px' }}>
        <TextInput
          id="org_name"
          labelText="Organization Name"
          value={formData.name}
          onChange={handleChange('name')}
        />

        <div>
          <TextInput
            id="org_slug"
            labelText="Slug"
            value={formData.slug}
            onChange={handleChange('slug')}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Used in URLs and API calls
          </p>
        </div>

        <Button
          kind="primary"
          onClick={() => updateMutation.mutate(formData)}
          disabled={updateMutation.isPending}
        >
          Save Changes
        </Button>
      </div>
    </Tile>
  );
}
