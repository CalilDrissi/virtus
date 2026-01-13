import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Card,
  TabList,
  Tab,
} from '@fluentui/react-components';
import {
  Person24Regular,
  Organization24Regular,
  Key24Regular,
  Payment24Regular,
} from '@fluentui/react-icons';
import ProfileSettings from './ProfileSettings';
import OrganizationSettings from './OrganizationSettings';
import APIKeysSettings from './APIKeysSettings';
import BillingSettings from './BillingSettings';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    gap: tokens.spacingHorizontalXL,
    height: '100%',
  },
  sidebar: {
    width: '240px',
    flexShrink: 0,
  },
  content: {
    flex: 1,
  },
});

const tabs = [
  { value: '/settings/profile', icon: <Person24Regular />, label: 'Profile' },
  { value: '/settings/organization', icon: <Organization24Regular />, label: 'Organization' },
  { value: '/settings/api-keys', icon: <Key24Regular />, label: 'API Keys' },
  { value: '/settings/billing', icon: <Payment24Regular />, label: 'Billing' },
];

export default function SettingsPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = tabs.find(t => location.pathname.startsWith(t.value))?.value || '/settings/profile';

  return (
    <div className={styles.container}>
      <Card className={styles.sidebar} style={{ padding: tokens.spacingVerticalM }}>
        <TabList
          vertical
          selectedValue={currentTab}
          onTabSelect={(_, data) => navigate(data.value as string)}
        >
          {tabs.map(tab => (
            <Tab key={tab.value} value={tab.value} icon={tab.icon}>
              {tab.label}
            </Tab>
          ))}
        </TabList>
      </Card>

      <div className={styles.content}>
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
