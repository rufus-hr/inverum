import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppTheme, THEME_LIGHT, getThemeById } from '../lib/theme';

// Cascade: user preference → org override → tenant default → built-in light
// For now the backend cascade will be wired in when auth/tenant API is ready.
// The store holds the resolved theme and lets you override per-user.

interface ThemeStore {
  // IDs set at each level (null = not set = inherit from below)
  userThemeId:   string | null;
  orgThemeId:    string | null;
  tenantThemeId: string | null;

  // Resolved theme (read this everywhere in the UI)
  theme: AppTheme;

  setUserTheme:   (id: string | null) => void;
  setOrgTheme:    (id: string | null) => void;
  setTenantTheme: (id: string | null) => void;
}

function resolve(
  userThemeId: string | null,
  orgThemeId: string | null,
  tenantThemeId: string | null,
): AppTheme {
  const id = userThemeId ?? orgThemeId ?? tenantThemeId ?? 'light';
  return getThemeById(id);
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      userThemeId:   null,
      orgThemeId:    null,
      tenantThemeId: null,
      theme: THEME_LIGHT,

      setUserTheme: (id) => {
        const { orgThemeId, tenantThemeId } = get();
        set({ userThemeId: id, theme: resolve(id, orgThemeId, tenantThemeId) });
      },
      setOrgTheme: (id) => {
        const { userThemeId, tenantThemeId } = get();
        set({ orgThemeId: id, theme: resolve(userThemeId, id, tenantThemeId) });
      },
      setTenantTheme: (id) => {
        const { userThemeId, orgThemeId } = get();
        set({ tenantThemeId: id, theme: resolve(userThemeId, orgThemeId, id) });
      },
    }),
    { name: 'inverum-theme' },
  ),
);
