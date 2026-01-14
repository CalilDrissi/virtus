import { useState } from 'react';
import { Tile, TextInput, Button } from '@carbon/react';
import { useAuthStore } from '../../stores/authStore';

export default function ProfileSettings() {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const initials = (user?.full_name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <Tile style={{ padding: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '1.5rem' }}>
        Profile Settings
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          backgroundColor: 'var(--brand-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--white)',
          fontSize: '1.5rem',
          fontWeight: 400,
        }}>
          {initials}
        </div>
        <Button kind="tertiary">Change Avatar</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '400px' }}>
        <TextInput
          id="full_name"
          labelText="Full Name"
          value={formData.full_name}
          onChange={handleChange('full_name')}
        />

        <TextInput
          id="email"
          type="email"
          labelText="Email"
          value={formData.email}
          onChange={handleChange('email')}
        />

        <TextInput
          id="role"
          labelText="Role"
          value={user?.role || ''}
          disabled
        />

        <Button kind="primary">Save Changes</Button>
      </div>
    </Tile>
  );
}
