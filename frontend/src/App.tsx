import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { Loading } from '@carbon/react';
import Layout from './components/common/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import MarketplacePage from './pages/marketplace/MarketplacePage';
import ModelDetailPage from './pages/marketplace/ModelDetailPage';
import TestModelPage from './pages/marketplace/TestModelPage';
import SubscriptionDetailPage from './pages/subscriptions/SubscriptionDetailPage';
import SettingsPage from './pages/settings/SettingsPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminModels from './pages/admin/AdminModels';
import AdminOrganizations from './pages/admin/AdminOrganizations';
import AdminClients from './pages/admin/AdminClients';
import AdminCategories from './pages/admin/AdminCategories';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import DataSourcesPage from './pages/DataSourcesPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isHydrated } = useAuthStore();

  if (!isHydrated || isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loading description="Loading..." withOverlay={false} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.is_platform_admin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { initialize, isHydrated } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) {
      initialize();
    }
  }, [initialize, isHydrated]);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="marketplace" element={<MarketplacePage />} />
        <Route path="marketplace/:modelId" element={<ModelDetailPage />} />
        <Route path="marketplace/:modelId/test" element={<TestModelPage />} />
        <Route path="subscriptions/:subscriptionId" element={<SubscriptionDetailPage />} />
        <Route path="data-sources" element={<DataSourcesPage />} />
        <Route path="settings/*" element={<SettingsPage />} />

        {/* Admin routes */}
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="admin/models"
          element={
            <AdminRoute>
              <AdminModels />
            </AdminRoute>
          }
        />
        <Route
          path="admin/organizations"
          element={
            <AdminRoute>
              <AdminOrganizations />
            </AdminRoute>
          }
        />
        <Route
          path="admin/clients"
          element={
            <AdminRoute>
              <AdminClients />
            </AdminRoute>
          }
        />
        <Route
          path="admin/categories"
          element={
            <AdminRoute>
              <AdminCategories />
            </AdminRoute>
          }
        />
        <Route
          path="admin/analytics"
          element={
            <AdminRoute>
              <AdminAnalytics />
            </AdminRoute>
          }
        />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
