import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, MapPin, Users } from 'lucide-react';
import { apiFetch, fetchTenantConfig } from '../lib/api';

interface Org {
  id: string;
  name: string;
  locations: number;
  employees: number;
  hasOrgSettings: boolean;
}

interface SettingsLandingProps {
  onSelectTenant?: () => void;
  onSelectOrg?: (orgId: string, orgName: string) => void;
  hasTenantAccess?: boolean;
}

export default function SettingsLanding({
  onSelectTenant,
  onSelectOrg,
  hasTenantAccess = true,
}: SettingsLandingProps = {}) {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    fetchTenantConfig()
      .then(cfg => { if (cfg.name) setTenantName(cfg.name); })
      .catch(() => {});
    apiFetch<{ items: any[] }>('/organizations/?limit=100')
      .then(resp => {
        if (resp.items?.length > 0) {
          setOrgs(resp.items.map((o: any) => ({
            id: o.id,
            name: o.name ?? '',
            locations: o.location_count ?? 0,
            employees: o.employee_count ?? 0,
            hasOrgSettings: true,
          })));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-full bg-theme-bg px-8 py-10 overflow-auto">
      <div className="max-w-2xl">
        <div className="mb-10">
          <h1 className="text-theme-xl font-semibold text-theme-text">Settings</h1>
          <p className="text-theme-sm text-theme-text-muted mt-1">
            Configure tenant-wide or organization-specific settings.
          </p>
        </div>

        {/* Tenant */}
        {hasTenantAccess && (
          <div className="mb-8">
            <p className="text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider mb-3">Tenant</p>
            <button
              onClick={() => onSelectTenant ? onSelectTenant() : navigate('/settings/tenant')}
              className="w-full flex items-center gap-4 p-4 bg-theme-surface border border-theme-border rounded-[--t-radius] hover:border-theme-border-strong hover:bg-theme-surface-hover transition-all group text-left shadow-sm"
            >
              <div className="w-10 h-10 bg-theme-primary rounded-[--t-radius] flex items-center justify-center text-theme-primary-fg font-bold text-sm shrink-0 shadow">
                {(tenantName || 'T').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-theme-base font-semibold text-theme-text">{tenantName || 'Tenant'}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {['General', 'Legal', 'Security', 'SSO', 'Modules', 'Certificates', 'Permissions'].map((t) => (
                    <span key={t} className="text-theme-xs text-theme-text-subtle">{t}</span>
                  ))}
                  <span className="text-theme-xs text-theme-text-subtle">+5 more</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-theme-text-subtle group-hover:text-theme-text-muted transition-colors shrink-0" />
            </button>
          </div>
        )}

        {/* Organizations */}
        <div>
          <p className="text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider mb-3">Organizations</p>
          <div className="space-y-2">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  if (!org.hasOrgSettings) return;
                  if (onSelectOrg) onSelectOrg(org.id, org.name);
                  else navigate(`/settings/org/${org.id}`);
                }}
                className={`w-full flex items-center gap-4 p-4 bg-theme-surface border rounded-[--t-radius] transition-all group text-left shadow-sm ${
                  org.hasOrgSettings
                    ? 'border-theme-border hover:border-theme-border-strong hover:bg-theme-surface-hover cursor-pointer'
                    : 'border-theme-border opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="w-10 h-10 bg-theme-bg border border-theme-border rounded-[--t-radius] flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-theme-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-theme-base font-semibold text-theme-text truncate">{org.name}</p>
                    {!org.hasOrgSettings && (
                      <span className="text-theme-xs text-theme-text-subtle border border-theme-border rounded px-1.5 py-0.5">
                        no access
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="flex items-center gap-1 text-theme-xs text-theme-text-muted">
                      <MapPin size={11} /> {org.locations} locations
                    </span>
                    <span className="flex items-center gap-1 text-theme-xs text-theme-text-muted">
                      <Users size={11} /> {org.employees} employees
                    </span>
                  </div>
                </div>
                {org.hasOrgSettings && (
                  <ChevronRight size={16} className="text-theme-text-subtle group-hover:text-theme-text-muted transition-colors shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
