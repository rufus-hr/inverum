import { create } from 'zustand';
import { fetchTenantConfig, updateTenantModules, TenantConfig, TenantModules } from '../lib/api';

// Svi moduli off — sigurni default dok se config ne učita
const MODULES_OFF: TenantModules = {
  vendors: false,
  supplies: false,
  storage: false,
  maintenance: false,
  checklists: false,
  advanced_permissions: false,
};

interface TenantConfigState {
  config: TenantConfig | null;
  modules: TenantModules;
  isLoaded: boolean;

  load: () => Promise<void>;
  setModule: (key: keyof TenantModules, value: boolean) => Promise<void>;
}

export const useTenantConfig = create<TenantConfigState>((set, get) => ({
  config: null,
  modules: MODULES_OFF,
  isLoaded: false,

  load: async () => {
    try {
      const config = await fetchTenantConfig();
      set({
        config,
        modules: config.modules,
        isLoaded: true,
      });
    } catch {
      // Nije autenticiran ili nema tenanta — ostavi defaults
      set({ isLoaded: true });
    }
  },

  setModule: async (key, value) => {
    const updated = await updateTenantModules({ [key]: value });
    set({ config: updated, modules: updated.modules });
  },
}));
