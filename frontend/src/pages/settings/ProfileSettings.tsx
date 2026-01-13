import { useState } from 'react';
import {
  makeStyles,
  tokens,
  Card,
  Text,
  Input,
  Button,
  Avatar,
} from '@fluentui/react-components';
import { useAuthStore } from '../../stores/authStore';

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
  avatarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalL,
  },
});

export default function ProfileSettings() {
  const styles = useStyles();
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  return (
    <Card className={styles.card}>
      <Text size={600} weight="semibold" block style={{ marginBottom: tokens.spacingVerticalL }}>
        Profile Settings
      </Text>

      <div className={styles.avatarSection}>
        <Avatar name={user?.full_name || user?.email} size={72} />
        <Button appearance="outline">Change Avatar</Button>
      </div>

      <div className={styles.form}>
        <div className={styles.field}>
          <Text weight="semibold">Full Name</Text>
          <Input
            value={formData.full_name}
            onChange={handleChange('full_name')}
          />
        </div>

        <div className={styles.field}>
          <Text weight="semibold">Email</Text>
          <Input
            type="email"
            value={formData.email}
            onChange={handleChange('email')}
          />
        </div>

        <div className={styles.field}>
          <Text weight="semibold">Role</Text>
          <Input value={user?.role || ''} disabled />
        </div>

        <Button appearance="primary">Save Changes</Button>
      </div>
    </Card>
  );
}
