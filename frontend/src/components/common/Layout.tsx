import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Header,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem,
  HeaderGlobalBar,
  HeaderGlobalAction,
  Content,
} from '@carbon/react';
import { Logout, Settings, UserAdmin } from '@carbon/icons-react';
import { useAuthStore } from '../../stores/authStore';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, organization, logout } = useAuthStore();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <Header aria-label="Virtus AI">
        <HeaderName href="#" prefix="" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          Virtus AI
        </HeaderName>
        <HeaderNavigation aria-label="Main navigation">
          <HeaderMenuItem
            isActive={isActive('/')}
            onClick={() => navigate('/')}
          >
            Dashboard
          </HeaderMenuItem>
          <HeaderMenuItem
            isActive={isActive('/marketplace')}
            onClick={() => navigate('/marketplace')}
          >
            Marketplace
          </HeaderMenuItem>
          <HeaderMenuItem
            isActive={isActive('/chat')}
            onClick={() => navigate('/chat')}
          >
            Chat
          </HeaderMenuItem>
          <HeaderMenuItem
            isActive={isActive('/data-sources')}
            onClick={() => navigate('/data-sources')}
          >
            Data Sources
          </HeaderMenuItem>
          <HeaderMenuItem
            isActive={isActive('/settings')}
            onClick={() => navigate('/settings')}
          >
            Settings
          </HeaderMenuItem>
          {user?.is_platform_admin && (
            <HeaderMenuItem
              isActive={isActive('/admin')}
              onClick={() => navigate('/admin')}
            >
              Admin
            </HeaderMenuItem>
          )}
        </HeaderNavigation>
        <HeaderGlobalBar>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 1rem',
            color: 'var(--gray-30)',
            fontSize: '0.875rem'
          }}>
            <span style={{ color: 'var(--white)' }}>{user?.full_name || user?.email}</span>
            {organization && (
              <span style={{ marginLeft: '0.5rem', color: 'var(--gray-50)' }}>
                ({organization.name})
              </span>
            )}
          </div>
          {user?.is_platform_admin && (
            <HeaderGlobalAction
              aria-label="Admin"
              onClick={() => navigate('/admin')}
            >
              <UserAdmin size={20} />
            </HeaderGlobalAction>
          )}
          <HeaderGlobalAction
            aria-label="Settings"
            onClick={() => navigate('/settings')}
          >
            <Settings size={20} />
          </HeaderGlobalAction>
          <HeaderGlobalAction
            aria-label="Logout"
            onClick={logout}
          >
            <Logout size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>

      <Content style={{ marginTop: '48px', padding: '1.5rem', minHeight: 'calc(100vh - 48px)' }}>
        <Outlet />
      </Content>
    </>
  );
}
