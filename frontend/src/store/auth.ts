import { create } from 'zustand';
import { setTokens, clearTokens, getStoredRefreshToken, saveLastTenantSlug, login as apiLogin, logout as apiLogout, onUnauthorized, type LoginPayload } from '../lib/api';
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  sub: string;       // user_id
  tenant_id: string;
  exp: number;
}

interface AuthUser {
  userId: string;
  tenantId: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  hydrateFromStorage: () => boolean;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Register global 401 handler
  onUnauthorized(() => {
    set({ user: null, isAuthenticated: false });
  });

  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    login: async (payload) => {
      set({ isLoading: true, error: null });
      try {
        const tokens = await apiLogin(payload);
        setTokens(tokens.access_token, tokens.refresh_token);
        saveLastTenantSlug(payload.tenant_slug);
        const decoded = jwtDecode<JwtPayload>(tokens.access_token);
        set({
          user: { userId: decoded.sub, tenantId: decoded.tenant_id },
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Login failed';
        set({ error: msg, isLoading: false });
      }
    },

    logout: async () => {
      await apiLogout();
      set({ user: null, isAuthenticated: false });
    },

    hydrateFromStorage: () => {
      const rt = getStoredRefreshToken();
      if (!rt) return false;
      // Access token is in-memory only; will be refreshed on first 401
      // Just mark as authenticated so the app loads, first API call will refresh
      try {
        const decoded = jwtDecode<JwtPayload>(rt);
        if (decoded.exp * 1000 < Date.now()) {
          clearTokens();
          return false;
        }
        set({
          user: { userId: decoded.sub, tenantId: decoded.tenant_id },
          isAuthenticated: true,
        });
        return true;
      } catch {
        clearTokens();
        return false;
      }
    },

    clearError: () => set({ error: null }),
  };
});
