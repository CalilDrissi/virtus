import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  TabList,
  Tab,
  Avatar,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Button,
  Text,
  Divider,
} from '@fluentui/react-components';
import {
  Home24Regular,
  Store24Regular,
  Chat24Regular,
  Database24Regular,
  Settings24Regular,
  Shield24Regular,
  SignOut24Regular,
  Person24Regular,
} from '@fluentui/react-icons';
import { useAuthStore } from '../../stores/authStore';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXL}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  logoText: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorBrandForeground1,
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  main: {
    flex: 1,
    overflow: 'auto',
    padding: tokens.spacingHorizontalXL,
  },
  orgName: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
});

export default function Layout() {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, organization, logout } = useAuthStore();

  const navItems = [
    { value: '/', icon: <Home24Regular />, label: 'Dashboard' },
    { value: '/marketplace', icon: <Store24Regular />, label: 'Marketplace' },
    { value: '/chat', icon: <Chat24Regular />, label: 'Chat' },
    { value: '/data-sources', icon: <Database24Regular />, label: 'Data Sources' },
    { value: '/settings', icon: <Settings24Regular />, label: 'Settings' },
  ];

  if (user?.is_platform_admin) {
    navItems.push({ value: '/admin', icon: <Shield24Regular />, label: 'Admin' });
  }

  const getCurrentTab = () => {
    const path = location.pathname;
    if (path === '/') return '/';
    const match = navItems.find(item => item.value !== '/' && path.startsWith(item.value));
    return match?.value || '/';
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <Text className={styles.logoText}>Virtus AI</Text>
        </div>

        <nav className={styles.nav}>
          <TabList
            selectedValue={getCurrentTab()}
            onTabSelect={(_, data) => navigate(data.value as string)}
          >
            {navItems.map((item) => (
              <Tab key={item.value} value={item.value} icon={item.icon}>
                {item.label}
              </Tab>
            ))}
          </TabList>
        </nav>

        <div className={styles.userSection}>
          <div>
            <Text weight="semibold">{user?.full_name || user?.email}</Text>
            <Text className={styles.orgName} block>{organization?.name}</Text>
          </div>
          <Menu>
            <MenuTrigger>
              <Button appearance="subtle" icon={<Avatar name={user?.full_name || user?.email} size={32} />} />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem icon={<Person24Regular />} onClick={() => navigate('/settings/profile')}>
                  Profile
                </MenuItem>
                <MenuItem icon={<Settings24Regular />} onClick={() => navigate('/settings')}>
                  Settings
                </MenuItem>
                <Divider />
                <MenuItem icon={<SignOut24Regular />} onClick={logout}>
                  Sign out
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
