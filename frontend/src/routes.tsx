import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { useAuthStore } from './store/auth';

// Lazy-loaded pages
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ImportWizard = lazy(() => import('./components/ImportWizard'));
const AssetsView = lazy(() => import('./views/AssetsView'));
const LocationsView = lazy(() => import('./views/LocationsView'));
const EmployeesView = lazy(() => import('./views/EmployeesView'));
const WorkOrdersView = lazy(() => import('./views/WorkOrdersView'));
const ChecklistsView = lazy(() => import('./views/ChecklistsView'));
const VendorsView = lazy(() => import('./views/VendorsView'));
const SettingsLanding = lazy(() => import('./pages/SettingsLanding'));
const TenantSettings = lazy(() => import('./pages/TenantSettings'));
const ExecutiveDashboard = lazy(() => import('./components/ExecutiveDashboard'));
const BoxesDashboard = lazy(() => import('./components/BoxComponents'));
const StorageUnitDashboard = lazy(() => import('./components/StorageUnitComponents'));
const SupplyDashboard = lazy(() => import('./components/SupplyComponents'));
const RacksDashboard = lazy(() => import('./components/RackComponents'));

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <AuthGuard>
              <AppLayout />
            </AuthGuard>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="assets" element={<AssetsView />} />
          <Route path="import" element={<ImportWizard />} />
          <Route path="locations" element={<LocationsView />} />
          <Route path="employees" element={<EmployeesView />} />
          <Route path="boxes" element={<BoxesDashboard />} />
          <Route path="storage-units" element={<StorageUnitDashboard />} />
          <Route path="supply" element={<SupplyDashboard />} />
          <Route path="racks" element={<RacksDashboard />} />
          <Route path="work-orders" element={<WorkOrdersView />} />
          <Route path="checklists" element={<ChecklistsView />} />
          <Route path="vendors" element={<VendorsView />} />
          <Route path="settings" element={<SettingsLanding />} />
          <Route path="settings/tenant" element={<TenantSettings />} />
          <Route path="settings/org/:orgId" element={<TenantSettings type="org" />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}