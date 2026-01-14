import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Tile, ContainedList, ContainedListItem } from '@carbon/react';
import { User, Enterprise, Password, Wallet } from '@carbon/icons-react';
import ProfileSettings from './ProfileSettings';
import OrganizationSettings from './OrganizationSettings';
import APIKeysSettings from './APIKeysSettings';
import BillingSettings from './BillingSettings';

const tabs = [
  { value: '/settings/profile', icon: User, label: 'Profile' },
  { value: '/settings/organization', icon: Enterprise, label: 'Organization' },
  { value: '/settings/api-keys', icon: Password, label: 'API Keys' },
  { value: '/settings/billing', icon: Wallet, label: 'Billing' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = tabs.find(t => location.pathname.startsWith(t.value))?.value || '/settings/profile';

  return (
    <div style={{ display: 'flex', gap: '1.5rem', height: '100%' }}>
      <Tile style={{ width: '240px', flexShrink: 0, padding: '1rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>Settings</h3>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => navigate(tab.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  borderRadius: '0',
                  backgroundColor: isActive ? 'var(--border-subtle)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                  width: '100%',
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </Tile>

      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<ProfileSettings />} />
          <Route path="/profile" element={<ProfileSettings />} />
          <Route path="/organization" element={<OrganizationSettings />} />
          <Route path="/api-keys" element={<APIKeysSettings />} />
          <Route path="/billing" element={<BillingSettings />} />
        </Routes>
      </div>
    </div>
  );
}
