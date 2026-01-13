import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Card,
  CardHeader,
  Text,
  Input,
  Button,
  Spinner,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import { useAuthStore } from '../stores/authStore';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    padding: tokens.spacingVerticalXL,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  title: {
    textAlign: 'center',
    marginBottom: tokens.spacingVerticalL,
  },
  footer: {
    textAlign: 'center',
    marginTop: tokens.spacingVerticalM,
  },
  link: {
    color: tokens.colorBrandForeground1,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
});

export default function RegisterPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    organization_name: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await register(formData);
      navigate('/');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error
        ? err.message
        : (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Registration failed';
      setError(errorMessage);
    }
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <CardHeader
          header={
            <div className={styles.title}>
              <Text size={600} weight="semibold">
                Create an Account
              </Text>
              <Text size={300} block>
                Get started with Virtus AI
              </Text>
            </div>
          }
        />

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <MessageBar intent="error">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}

          <Input
            placeholder="Full Name"
            value={formData.full_name}
            onChange={handleChange('full_name')}
            required
          />

          <Input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange('email')}
            required
          />

          <Input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange('password')}
            required
          />

          <Input
            placeholder="Organization Name"
            value={formData.organization_name}
            onChange={handleChange('organization_name')}
            required
          />

          <Button appearance="primary" type="submit" disabled={isLoading}>
            {isLoading ? <Spinner size="tiny" /> : 'Create Account'}
          </Button>
        </form>

        <div className={styles.footer}>
          <Text>
            Already have an account?{' '}
            <Link to="/login" className={styles.link}>
              Sign in
            </Link>
          </Text>
        </div>
      </Card>
    </div>
  );
}
