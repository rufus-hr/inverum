import React, { useState, useEffect } from 'react';
import ToastProvider from './components/ui/ToastProvider';
import { useToast } from './hooks/useToast';
import { useAuthStore } from './store/auth';
import Login from './pages/Login';
import { AppProvider } from './contexts/AppContext';
import AppRoutes from './routes';

export default function App() {
  const { isAuthenticated, hydrateFromStorage } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);
  const { toasts, remove } = useToast();

  useEffect(() => {
    hydrateFromStorage();
    setHydrated(true);
  }, []);

  // Auth guard — all hooks must be above this line
  if (!hydrated) return null;
  if (!isAuthenticated) return <Login />;

  return (
    <AppProvider>
      <AppRoutes />
      <ToastProvider toasts={toasts} onRemove={remove} />
    </AppProvider>
  );
}
