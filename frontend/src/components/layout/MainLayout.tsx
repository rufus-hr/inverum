import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuthStore } from '../../store/auth';
import { useTenantConfig } from '../../store/tenantConfig';

export default function MainLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { load, isLoaded } = useTenantConfig();

  useEffect(() => {
    if (isAuthenticated && !isLoaded) {
      load();
    }
  }, [isAuthenticated, isLoaded, load]);

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] text-slate-900 font-sans relative overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header />
        <div className="flex-1 overflow-auto relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
