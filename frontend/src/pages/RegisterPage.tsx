import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Tile,
  TextInput,
  Button,
  InlineLoading,
  InlineNotification,
} from '@carbon/react';
import { useAuthStore } from '../stores/authStore';

export default function RegisterPage() {
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
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
    }}>
      <Tile style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Create an Account
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Get started with Virtus AI
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <InlineNotification
              kind="error"
              title="Error"
              subtitle={error}
              lowContrast
              hideCloseButton
            />
          )}

          <TextInput
            id="full_name"
            labelText="Full Name"
            placeholder="Enter your full name"
            value={formData.full_name}
            onChange={handleChange('full_name')}
            required
          />

          <TextInput
            id="email"
            type="email"
            labelText="Email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange('email')}
            required
          />

          <TextInput
            id="password"
            type="password"
            labelText="Password"
            placeholder="Choose a password"
            value={formData.password}
            onChange={handleChange('password')}
            required
          />

          <TextInput
            id="organization_name"
            labelText="Organization Name"
            placeholder="Enter your organization name"
            value={formData.organization_name}
            onChange={handleChange('organization_name')}
            required
          />

          <Button type="submit" disabled={isLoading} style={{ width: '100%' }}>
            {isLoading ? <InlineLoading description="Creating account..." /> : 'Create Account'}
          </Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <p style={{ fontSize: '0.875rem' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--brand-primary)' }}>
              Sign in
            </Link>
          </p>
        </div>
      </Tile>
    </div>
  );
}
