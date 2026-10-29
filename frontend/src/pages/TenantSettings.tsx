import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Building2, Shield, KeyRound, Puzzle, Plug, Layers, Hash, Database,
  Award, Users, Bot, FileText, Tag, ChevronDown,
  Plus, Check, X, BarChart2, UserCog,
} from 'lucide-react';
import {
  SettingsContext, AssetCategory, NamingSchema, ReferenceGroup, TenantConfigData, OrgScopeItem,
  INITIAL_CATEGORIES, INITIAL_NAMING_SCHEMAS, INITIAL_REFERENCE_GROUPS, apiFetch,
} from '../components/settings/SettingsShared';
import type { PagedResponse, OrganizationResponse } from '../types/api';
import {
  GeneralOrgTab, GeneralTab, LegalTab, SecurityTab, SSOTab,
} from '../components/settings/AccountAndSecurityTabs';
import {
  ModulesTab, IntegrationsTab, PermissionsTab, UsersTab,
} from '../components/settings/OrganizationAndUsersTabs';
import {
  AssetTypesTab, NamingTab, ReferenceDataTab,
} from '../components/settings/AssetDataTabs';
import {
  CertificatesTab, AutomationTab, AuditTab, PrintingTab, ReportsTab,
} from '../components/settings/OperationsAndHardwareTabs';

// ---------------------------------------------------------------------------
// Navigation & Orgs
// ---------------------------------------------------------------------------

type NavId = 'general' | 'legal' | 'security' | 'sso' | 'modules' | 'users' | 'integrations' | 'asset-types' | 'naming' | 'reference-data' | 'certificates' | 'permissions' | 'automation' | 'audit' | 'printing' | 'reports';

interface NavGroup { group: string; items: { id: NavId; label: string; icon: React.ReactNode; badge?: string }[]; }

const NAV: NavGroup[] = [
  { group: 'Account', items: [
    { id: 'general',  label: 'General',        icon: <Building2 size={15} /> },
    { id: 'legal',    label: 'Legal Entity',   icon: <FileText size={15} /> },
    { id: 'security', label: 'Security',       icon: <Shield size={15} /> },
    { id: 'sso',      label: 'SSO / Identity', icon: <KeyRound size={15} /> },
  ]},
  { group: 'Organization', items: [
    { id: 'modules',      label: 'Modules',             icon: <Puzzle size={15} /> },
    { id: 'users',        label: 'Users',               icon: <UserCog size={15} /> },
    { id: 'permissions',  label: 'Roles & Permissions', icon: <Users size={15} /> },
    { id: 'integrations', label: 'Integrations',        icon: <Plug size={15} /> },
  ]},
  { group: 'Asset Data', items: [
    { id: 'asset-types',    label: 'Asset Types',    icon: <Layers size={15} /> },
    { id: 'naming',         label: 'Naming Schemas', icon: <Hash size={15} /> },
    { id: 'reference-data', label: 'Reference Data', icon: <Database size={15} /> },
  ]},
  { group: 'Operations', items: [
    { id: 'certificates', label: 'Certificates & PKI', icon: <Award size={15} /> },
    { id: 'reports',      label: 'Reports',            icon: <BarChart2 size={15} /> },
    { id: 'automation',   label: 'Automation',         icon: <Bot size={15} /> },
    { id: 'audit',        label: 'Audit Log',          icon: <FileText size={15} /> },
  ]},
  { group: 'Hardware', items: [
    { id: 'printing', label: 'Barcode & Printing', icon: <Tag size={15} /> },
  ]},
];

const DEFAULT_TENANT_SCOPE: OrgScopeItem = {
  id: 'tenant',
  name: 'Tenant',
  sub: 'Tenant settings',
  isTenant: true,
};

const ORG_SCOPED: NavId[] = ['general', 'legal', 'security', 'sso', 'users', 'integrations', 'naming', 'certificates', 'reports'];

const TAB_COMPONENTS: Record<NavId, React.FC> = {
  general: GeneralTab,
  legal: LegalTab,
  security: SecurityTab,
  sso: SSOTab,
  modules: ModulesTab,
  users: UsersTab,
  integrations: IntegrationsTab,
  'asset-types': AssetTypesTab,
  naming: NamingTab,
  'reference-data': ReferenceDataTab,
  certificates: CertificatesTab,
  permissions: PermissionsTab,
  automation: AutomationTab,
  audit: AuditTab,
  printing: PrintingTab,
  reports: ReportsTab,
};

const FULL_HEIGHT_TABS: NavId[] = ['sso', 'permissions', 'reports', 'printing'];

export default function TenantSettings({ type }: { type?: 'tenant' | 'org' }) {
  const { orgId } = useParams<{ orgId?: string }>();
  const [active, setActive] = useState<NavId>('general');
  const [orgs, setOrgs] = useState<OrgScopeItem[]>([DEFAULT_TENANT_SCOPE]);
  const [selectedOrg, setSelectedOrg] = useState<OrgScopeItem>(DEFAULT_TENANT_SCOPE);
  const [orgDropdown, setOrgDropdown] = useState(false);
  const [addingOrg, setAddingOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [assetCategories, setAssetCategories] = useState<AssetCategory[]>(INITIAL_CATEGORIES);
  const [namingSchemas,   setNamingSchemas]   = useState<NamingSchema[]>(INITIAL_NAMING_SCHEMAS);
  const [referenceGroups, setReferenceGroups] = useState<ReferenceGroup[]>(INITIAL_REFERENCE_GROUPS);
  const [tenantConfig, setTenantConfig] = useState<TenantConfigData | null>(null);

  const saveTenantSettings = useCallback(async (patch: Record<string, unknown>) => {
    try {
      const updated = await apiFetch<TenantConfigData>('/tenants/config/settings', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setTenantConfig(updated);
    } catch {
      // Keep local state if offline
    }
  }, []);

  const loadOrgs = useCallback((tName?: string) => {
    const rootItem: OrgScopeItem = {
      id: 'tenant',
      name: tName || tenantConfig?.name || 'Tenant',
      sub: 'Tenant settings',
      isTenant: true,
    };
    apiFetch<PagedResponse<OrganizationResponse> | OrganizationResponse[]>('/organizations/?limit=100')
      .then((res) => {
        const items = Array.isArray(res) ? res : (res?.items ?? []);
        const mapped: OrgScopeItem[] = items.map(o => ({
          id: o.id,
          name: o.name,
          sub: o.description || 'Organization',
          isTenant: false,
          description: o.description,
        }));
        const all = [rootItem, ...mapped];
        setOrgs(all);
        if (type === 'org' && orgId) {
          const matchedOrg = mapped.find(x => x.id === orgId);
          if (matchedOrg) {
            setSelectedOrg(matchedOrg);
            return;
          }
        }
        setSelectedOrg(prev => all.find(x => x.id === prev.id) ?? rootItem);
      })
      .catch(() => {
        setOrgs([rootItem]);
        setSelectedOrg(prev => prev.isTenant ? rootItem : prev);
      });
  }, [tenantConfig?.name, type, orgId]);

  useEffect(() => {
    apiFetch<TenantConfigData>('/tenants/config')
      .then((cfg) => {
        setTenantConfig(cfg);
        if (cfg.settings?.asset_categories && Array.isArray(cfg.settings.asset_categories) && cfg.settings.asset_categories.length > 0) {
          setAssetCategories(cfg.settings.asset_categories);
        }
        if (cfg.settings?.naming_schemas && Array.isArray(cfg.settings.naming_schemas) && cfg.settings.naming_schemas.length > 0) {
          setNamingSchemas(cfg.settings.naming_schemas);
        }
        if (cfg.settings?.reference_groups && Array.isArray(cfg.settings.reference_groups) && cfg.settings.reference_groups.length > 0) {
          setReferenceGroups(cfg.settings.reference_groups);
        }
        loadOrgs(cfg.name);
      })
      .catch(() => {
        loadOrgs();
      });
  }, [loadOrgs]);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    const trimmed = newOrgName.trim();
    try {
      const created = await apiFetch<OrganizationResponse>('/organizations/', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed, is_active: true }),
      });
      setNewOrgName('');
      setAddingOrg(false);
      loadOrgs();
      selectOrg({
        id: created.id,
        name: created.name,
        sub: created.description || 'Organization',
        isTenant: false,
        description: created.description,
      });
    } catch {
      setAddingOrg(false);
    }
  };

  const isOrg = !selectedOrg.isTenant;
  const ActiveComponent = (isOrg && active === 'general') ? GeneralOrgTab : TAB_COMPONENTS[active];
  const isFullHeight = FULL_HEIGHT_TABS.includes(active);

  const selectOrg = (org: OrgScopeItem) => {
    setSelectedOrg(org);
    setOrgDropdown(false);
    if (!org.isTenant && !ORG_SCOPED.includes(active)) setActive('general');
  };

  return (
    <SettingsContext.Provider value={{
      isOrg,
      selectedOrg,
      orgs,
      refreshOrgs: () => loadOrgs(),
      assetCategories,
      setAssetCategories,
      namingSchemas,
      setNamingSchemas,
      referenceGroups,
      setReferenceGroups,
      tenantConfig,
      setTenantConfig,
      saveTenantSettings,
    }}>
      <div className="flex h-full bg-theme-bg text-theme-text">
        <aside className="w-56 shrink-0 border-r border-theme-border bg-theme-surface flex flex-col">
          <div className="p-3 border-b border-theme-border relative">
            <button onClick={() => setOrgDropdown(!orgDropdown)} className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-theme-bg hover:bg-theme-surface-hover border border-theme-border transition-colors text-left">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedOrg.isTenant ? 'bg-theme-primary' : 'bg-emerald-500'}`} />
                  <p className="text-theme-xs font-semibold text-theme-text truncate">{selectedOrg.name}</p>
                </div>
                <p className="text-[11px] text-theme-text-subtle pl-3 truncate">{selectedOrg.sub}</p>
              </div>
              <ChevronDown size={13} className="text-theme-text-subtle shrink-0 ml-1" />
            </button>
            {orgDropdown && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-theme-surface border border-theme-border rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-1.5 border-b border-theme-border">
                  <p className="text-[10px] font-semibold text-theme-text-subtle uppercase tracking-wider">Configure scope</p>
                </div>
                {orgs.map((org) => (
                  <button key={org.id} onClick={() => selectOrg(org)} className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-theme-surface-hover transition-colors ${selectedOrg.id === org.id ? 'bg-theme-surface-hover' : ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${org.isTenant ? 'bg-theme-primary' : 'bg-emerald-500'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-theme-xs font-medium text-theme-text truncate">{org.name}</p>
                      <p className="text-[11px] text-theme-text-subtle truncate">{org.sub}</p>
                    </div>
                    {selectedOrg.id === org.id && <Check size={12} className="text-theme-primary shrink-0" />}
                  </button>
                ))}
                <div className="border-t border-theme-border px-3 py-2">
                  {addingOrg ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={newOrgName}
                        onChange={e => setNewOrgName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreateOrg(); if (e.key === 'Escape') { setAddingOrg(false); setNewOrgName(''); } }}
                        placeholder="Org name..."
                        className="w-full text-theme-xs bg-theme-bg border border-theme-border rounded px-2 py-1 text-theme-text focus:outline-none focus:border-theme-primary"
                      />
                      <button onClick={handleCreateOrg} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={12} /></button>
                      <button onClick={() => { setAddingOrg(false); setNewOrgName(''); }} className="p-1 text-theme-text-subtle hover:text-theme-text"><X size={12} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingOrg(true)} className="flex items-center gap-1.5 text-theme-xs text-theme-primary hover:text-theme-primary-hover transition-colors">
                      <Plus size={12} /> Add organization
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
            {NAV.map((group) => {
              const visibleItems = group.items.filter(item => selectedOrg.isTenant || ORG_SCOPED.includes(item.id));
              if (visibleItems.length === 0) return null;
              return (
                <div key={group.group}>
                  <p className="px-2.5 mb-1 text-[10px] font-semibold text-theme-text-subtle uppercase tracking-wider">{group.group}</p>
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const isActive = active === item.id;
                      const isModDisabled = (item.id === 'certificates' && tenantConfig?.modules?.certificates === false)
                        || (item.id === 'reports' && tenantConfig?.modules?.reports === false);
                      const badgeText = isModDisabled ? 'off' : item.badge;
                      return (
                        <button key={item.id} onClick={() => setActive(item.id)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-colors text-theme-sm ${isActive ? 'bg-theme-primary/10 text-theme-primary font-medium' : 'text-theme-text-muted hover:text-theme-text hover:bg-theme-surface-hover'}`}>
                          <span className={isActive ? 'text-theme-primary' : 'text-theme-text-subtle'}>{item.icon}</span>
                          <span className="flex-1 truncate">{item.label}</span>
                          {badgeText && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isModDisabled ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-theme-bg text-theme-text-subtle border-theme-border'}`}>{badgeText}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        <main className={`flex-1 flex flex-col min-w-0 ${isFullHeight ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {!selectedOrg.isTenant && (
            <div className="flex items-center justify-between px-8 py-2.5 bg-emerald-50 border-b border-emerald-200 shrink-0">
              <span className="flex items-center gap-2 text-theme-xs text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Configuring <strong>{selectedOrg.name}</strong> — organization-scoped settings only.
              </span>
              <button onClick={() => selectOrg(orgs[0])} className="text-theme-xs text-theme-text-muted hover:text-theme-text transition-colors">
                Switch to tenant →
              </button>
            </div>
          )}
          <div className={isFullHeight ? 'flex-1 overflow-hidden flex flex-col' : 'px-8 py-7'}>
            <ActiveComponent />
          </div>
        </main>
      </div>
    </SettingsContext.Provider>
  );
}
