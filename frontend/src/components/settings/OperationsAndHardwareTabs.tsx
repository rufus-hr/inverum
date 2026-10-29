import React, { useState, useRef, useContext, useEffect } from 'react';
import {
  ChevronRight, ShieldCheck, Clock, Upload, RefreshCw,
  Award, Trash2, Bot, FileText, Tag, Plus, Check, X, Eye, Download, Save,
} from 'lucide-react';
import {
  SettingsContext, TenantConfigData, apiFetch,
  SectionHeader, SettingRow, OrgSettingRow, Input, Select, Badge, SaveBar, Toggle,
} from './SettingsShared';
import { useApiQuery } from '../../hooks/useApi';
import { getAccessToken } from '../../lib/api';
import type { PagedResponse } from '../../types/api';

interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id?: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Certificates Tab
// ---------------------------------------------------------------------------

export function CertificatesTab() {
  const { isOrg, tenantConfig, setTenantConfig } = useContext(SettingsContext);
  const Row = isOrg ? OrgSettingRow : SettingRow;
  const pki = tenantConfig?.settings?.pki as Record<string, string> | undefined;
  const [tsaUrl, setTsaUrl] = useState('http://timestamp.digicert.com');
  const [tsaVendor, setTsaVendor] = useState('DigiCert');
  const [expiryAlert, setExpiryAlert] = useState('30 days');
  const [confirmRegen, setConfirmRegen] = useState(false);
  const caInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pki) return;
    if (pki.tsaUrl) setTsaUrl(pki.tsaUrl);
    if (pki.tsaVendor) setTsaVendor(pki.tsaVendor);
    if (pki.expiryAlert) setExpiryAlert(pki.expiryAlert);
  }, [pki]);

  const certCn = tenantConfig?.name || 'Inverum Tenant';
  const certOrg = tenantConfig?.code || 'INV';
  const countryCodeMap: Record<string, string> = {
    Croatia: 'HR',
    Germany: 'DE',
    Austria: 'AT',
    Slovenia: 'SI',
    Serbia: 'RS',
  };
  const certCountry = countryCodeMap[tenantConfig?.settings?.country || 'Croatia'] || 'HR';
  const isCertModuleDisabled = tenantConfig?.modules?.certificates === false;

  const enableCertModule = () => {
    apiFetch<TenantConfigData>('/tenants/config/modules', {
      method: 'PATCH',
      body: JSON.stringify({ certificates: true }),
    }).then((cfg) => {
      setTenantConfig(cfg);
      window.dispatchEvent(new CustomEvent('inverum-modules-updated', { detail: cfg.modules }));
    }).catch(() => {});
  };

  return (
    <div className="max-w-2xl space-y-8">
      {isCertModuleDisabled && (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-theme-xs">
          <span>The <strong>Certificates &amp; PKI</strong> module is currently disabled in <strong>Modules</strong>.</span>
          <button onClick={enableCertModule} className="px-3 py-1 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 transition-colors">
            Enable Module
          </button>
        </div>
      )}
      <div>
        <SectionHeader title="Document Signing" description="Certificate resolution: User cert → Organization cert → Tenant cert. Used to sign PDFs, work orders, and approval documents." />
        <div className="p-4 bg-theme-bg border border-theme-border rounded-lg mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-theme-xs font-medium text-theme-text">Certificate Resolution Chain</span>
          </div>
          <div className="flex items-center gap-2 text-theme-xs text-theme-text-muted">
            <span className="px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded">User cert</span>
            <ChevronRight size={12} />
            <span className="px-2 py-1 bg-theme-bg border border-theme-border rounded">Org cert</span>
            <ChevronRight size={12} />
            <span className="px-2 py-1 bg-theme-bg border border-theme-border rounded">Tenant cert</span>
            <span className="ml-2 text-theme-text-subtle">— first available is used</span>
          </div>
        </div>
        <p className="text-theme-xs font-medium text-theme-text-muted uppercase tracking-wider mb-3">Tenant-level certificate</p>
        <div className="border border-theme-border rounded-lg p-4 mb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span className="text-theme-sm font-medium text-theme-text">CN={certCn}, O={certOrg}, C={certCountry}</span>
                <Badge color="blue">auto-generated</Badge>
              </div>
              <p className="text-theme-xs text-theme-text-muted">Issuer: Self-signed (auto-generated · synced with General → Country)</p>
              <p className="text-theme-xs text-theme-text-subtle font-mono">SHA-256: 4A:3B:...:FF</p>
              <div className="flex items-center gap-2 mt-2">
                <Clock size={11} className="text-theme-text-muted" />
                <span className="text-theme-xs text-theme-text-muted">Expires 2027-04-10 (364 days)</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <button onClick={() => replaceInputRef.current?.click()} className="px-3 py-1.5 text-theme-xs text-theme-text-muted hover:text-theme-text border border-theme-border hover:border-theme-border-strong rounded transition-colors flex items-center gap-1.5">
                <Upload size={11} /> Replace
              </button>
              <input ref={replaceInputRef} type="file" accept=".pem,.p12,.pfx,.crt" className="hidden" />
              {confirmRegen ? (
                <div className="flex flex-col gap-1">
                  <p className="text-theme-xs text-amber-600">Regenerate? Old cert will be invalidated.</p>
                  <div className="flex gap-1">
                    <button onClick={() => setConfirmRegen(false)} className="px-2 py-1 text-theme-xs bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 transition-colors">Yes, regenerate</button>
                    <button onClick={() => setConfirmRegen(false)} className="px-2 py-1 text-theme-xs text-theme-text-muted hover:text-theme-text transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmRegen(true)} className="px-3 py-1.5 text-theme-xs text-theme-text-muted hover:text-theme-text border border-theme-border hover:border-theme-border-strong rounded transition-colors flex items-center gap-1.5">
                  <RefreshCw size={11} /> Regenerate
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="CA Certificates" description="Trusted certificate authorities for LDAPS and internal PKI" />
        <div className="border border-theme-border rounded-lg p-4 mb-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Award size={13} className="text-blue-500" />
                <span className="text-theme-sm font-medium text-theme-text">CN=HP Internal CA</span>
                <Badge color="blue">LDAPS</Badge>
              </div>
              <p className="text-theme-xs text-theme-text-subtle font-mono">SHA-256: 1C:2D:...:AA</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock size={11} className="text-theme-text-muted" />
                <span className="text-theme-xs text-theme-text-muted">Expires 2028-01-01</span>
              </div>
            </div>
            <button className="p-1.5 text-theme-text-subtle hover:text-theme-danger transition-colors"><Trash2 size={13} /></button>
          </div>
        </div>
        <button onClick={() => caInputRef.current?.click()} className="flex items-center gap-2 text-theme-sm text-theme-primary hover:text-theme-primary-hover mt-2 transition-colors">
          <Upload size={14} /> Import CA certificate
        </button>
        <input ref={caInputRef} type="file" accept=".pem,.crt,.cer" className="hidden" />
      </div>

      <div>
        <SectionHeader title="Timestamp Authority (TSA)" description="Trusted third-party timestamp for legally binding document signing" />
        <Row label="TSA URL" tenantValue={pki?.tsaUrl || 'http://timestamp.digicert.com'}><Input value={tsaUrl} onChange={setTsaUrl} className="w-72" /></Row>
        <Row label="TSA Vendor" tenantValue={pki?.tsaVendor || 'DigiCert'}><Input value={tsaVendor} onChange={setTsaVendor} className="w-44" /></Row>
        <Row label="Expiry Alert Threshold" description="Notify before certificate expires (used by Automation Rules)" tenantValue={pki?.expiryAlert || '30 days'}>
          <Select value={expiryAlert} onChange={setExpiryAlert} options={['7 days', '14 days', '30 days', '60 days', '90 days']} className="w-36" />
        </Row>
        <SaveBar onSave={() => {
          apiFetch<TenantConfigData>('/tenants/config/settings', {
            method: 'PATCH',
            body: JSON.stringify({
              pki: { tsaUrl, tsaVendor, expiryAlert },
            }),
          }).then(setTenantConfig).catch(() => {});
        }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Automation, Audit & Printing Tabs
// ---------------------------------------------------------------------------

interface AutomationRuleItem {
  id: string;
  name: string;
  description: string;
  linkedSetting: string;
  moduleKey?: string;
  enabled: boolean;
}

export function AutomationTab() {
  const { tenantConfig, saveTenantSettings } = useContext(SettingsContext);
  const pkiExpiry = (tenantConfig?.settings?.pki as Record<string, string> | undefined)?.expiryAlert || '30 days';
  const secCfg = (tenantConfig?.settings?.security ?? {}) as Record<string, unknown>;
  const fourEyesActive = secCfg.fourEyes === true;
  const requireReasonActive = secCfg.requireReason !== false;

  const defaultRules: AutomationRuleItem[] = [
    {
      id: 'cert_expiry',
      name: `X.509 & PKI Certificate Expiry Alert (${pkiExpiry})`,
      description: `Automatically notifies owners and creates a renewal task ${pkiExpiry} before a certificate expires.`,
      linkedSetting: `Certificates & PKI → Expiry Alert Threshold (${pkiExpiry})`,
      moduleKey: 'certificates',
      enabled: true,
    },
    {
      id: 'warranty_expiry',
      name: 'Asset Warranty & Calibration Due Reminder',
      description: 'Generates a preventive work order 30 days before asset warranty or calibration date expires.',
      linkedSetting: 'Asset Types → Custom Fields & Maintenance',
      moduleKey: 'maintenance',
      enabled: true,
    },
    {
      id: 'supply_reorder',
      name: 'Low Stock Supply Auto-Reorder Notification',
      description: 'Triggers a procurement alert when any consumable or spare part drops below its minimum threshold.',
      linkedSetting: 'Modules → Supplies',
      moduleKey: 'supplies',
      enabled: true,
    },
    {
      id: 'decommission_guard',
      name: 'Decommission Audit & 4-Eyes Approval Gate',
      description: `Enforces mandatory decommission reason (${requireReasonActive ? 'ON' : 'OFF'}) and 4-Eyes dual approval (${fourEyesActive ? 'ON' : 'OFF'}) on sensitive assets.`,
      linkedSetting: 'Security → 4-Eyes Principle & Asset Security',
      enabled: true,
    },
    {
      id: 'sop_checklist_lock',
      name: 'SOP Checklist Transition Lock',
      description: 'Prevents asset status transition to Active/Decommissioned until all attached SOP checklist items are signed off.',
      linkedSetting: 'Modules → SOP Checklists',
      moduleKey: 'checklists',
      enabled: true,
    },
  ];

  const [rules, setRules] = useState<AutomationRuleItem[]>(defaultRules);

  useEffect(() => {
    const saved = tenantConfig?.settings?.automation_rules;
    if (saved && Array.isArray(saved) && saved.length > 0) {
      const enabledMap = new Map(saved.map(r => [String(r.id), Boolean(r.enabled)]));
      setRules(defaultRules.map(r => ({
        ...r,
        enabled: enabledMap.has(r.id) ? enabledMap.get(r.id)! : r.enabled,
      })));
    } else {
      setRules(defaultRules);
    }
  }, [pkiExpiry, fourEyesActive, requireReasonActive, tenantConfig?.settings?.automation_rules]);

  const toggleRule = (id: string) => {
    const next = rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    setRules(next);
    void saveTenantSettings({
      automation_rules: next.map(r => ({ id: r.id, enabled: r.enabled })),
    });
  };

  return (
    <div className="max-w-3xl">
      <SectionHeader
        title="Automation Rules"
        description="System-wide lifecycle automations connected to Security, Certificates & PKI, Modules, and Asset Types"
      />
      <div className="space-y-3">
        {rules.map((r) => {
          const modDisabled = r.moduleKey && tenantConfig?.modules?.[r.moduleKey] === false;
          return (
            <div key={r.id} className={`p-4 rounded-lg border transition-colors ${r.enabled && !modDisabled ? 'border-theme-border bg-theme-surface' : 'border-theme-border bg-theme-bg opacity-60'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Bot size={14} className="text-theme-primary shrink-0" />
                    <span className="text-theme-sm font-semibold text-theme-text">{r.name}</span>
                    {modDisabled && <Badge color="amber">Module disabled in Modules</Badge>}
                  </div>
                  <p className="text-theme-xs text-theme-text-muted">{r.description}</p>
                  <p className="text-[11px] text-theme-text-subtle">
                    Linked setting: <span className="font-medium text-theme-text-muted">{r.linkedSetting}</span>
                  </p>
                </div>
                <Toggle value={r.enabled && !modDisabled} onChange={() => toggleRule(r.id)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AuditTab() {
  const { data: auditData, refetch } = useApiQuery<PagedResponse<AuditLogEntry>>('/audit/?limit=50');
  const entries = auditData?.items ?? [];

  if (entries.length === 0) {
    return (
      <div className="max-w-lg flex flex-col items-center justify-center py-20 mx-auto text-center">
        <div className="w-12 h-12 bg-theme-bg border border-theme-border rounded-full flex items-center justify-center mb-4">
          <FileText size={20} className="text-theme-text-muted" />
        </div>
        <p className="text-theme-text font-medium mb-1">Audit Log</p>
        <p className="text-theme-sm text-theme-text-muted">Full audit trail of all settings changes, user actions, and system events.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Audit Log" description="Immutable audit trail of system events and entity changes" />
        <button onClick={() => refetch()} className="flex items-center gap-1.5 text-theme-xs text-theme-text-muted hover:text-theme-text">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      <div className="border border-theme-border rounded-lg overflow-hidden">
        <table className="w-full text-theme-sm">
          <thead>
            <tr className="border-b border-theme-border bg-theme-bg">
              <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Timestamp</th>
              <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Action</th>
              <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Entity</th>
              <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Actor</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-b border-theme-border last:border-0 hover:bg-theme-surface-hover">
                <td className="px-4 py-2.5 font-mono text-theme-xs text-theme-text-subtle">{e.created_at.slice(0, 19).replace('T', ' ')}</td>
                <td className="px-4 py-2.5"><Badge color="blue">{e.action}</Badge></td>
                <td className="px-4 py-2.5 text-theme-xs text-theme-text">{e.entity_type} · <span className="font-mono text-theme-text-subtle">{String(e.entity_id).slice(0, 8)}</span></td>
                <td className="px-4 py-2.5 text-theme-xs text-theme-text-muted">{e.user_id ? String(e.user_id).slice(0, 8) : 'System'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface DocumentTemplateItem {
  id: string;
  tenant_id: string;
  name: string;
  template_type: string;
  engine: 'svg' | 'typst' | 'html';
  content: string;
  requires_signature: boolean;
  is_system: boolean;
  is_active: boolean;
}

export function PrintingTab() {
  const { data, isLoading, refetch } = useApiQuery<PagedResponse<DocumentTemplateItem>>('/document-templates?limit=50');
  const templates = data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<{
    mime: string;
    url?: string;
    svgText?: string;
    sha256?: string | null;
  } | null>(null);

  const activeTpl = templates.find(t => t.id === selectedId) ?? templates[0] ?? null;

  useEffect(() => {
    if (activeTpl) {
      setSelectedId(activeTpl.id);
      setEditedContent(activeTpl.content);
    }
  }, [activeTpl?.id]);

  const handlePreviewTemplate = async (tpl: DocumentTemplateItem) => {
    setIsPreviewing(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/v1/document-templates/${tpl.id}/preview`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const mime = res.headers.get('content-type') || 'application/pdf';
      const sha256 = res.headers.get('X-Document-SHA256');
      if (mime.includes('svg')) {
        const svgText = await res.text();
        setPreviewData({ mime: 'image/svg+xml', svgText, sha256 });
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPreviewData({ mime: 'application/pdf', url, sha256 });
      }
    } catch {
      // ignore
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!activeTpl) return;
    setIsSaving(true);
    try {
      await apiFetch(`/document-templates/${activeTpl.id}`, {
        method: 'PUT',
        body: JSON.stringify({ content: editedContent }),
      });
      refetch();
      handlePreviewTemplate({ ...activeTpl, content: editedContent });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-theme-sm text-theme-text-muted">Loading document &amp; label templates...</div>;
  }

  return (
    <div className="flex min-h-full">
      {/* Left list of templates */}
      <div className="w-64 shrink-0 border-r border-theme-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border">
          <p className="text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider">
            Stickers &amp; Templates ({templates.length})
          </p>
          <button onClick={() => refetch()} className="p-1 text-theme-text-subtle hover:text-theme-text">
            <RefreshCw size={12} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedId(t.id);
                setEditedContent(t.content);
                setPreviewData(null);
              }}
              className={`w-full text-left px-4 py-2.5 border-b border-theme-border/40 transition-colors ${
                activeTpl?.id === t.id
                  ? 'bg-theme-surface-hover text-theme-text'
                  : 'text-theme-text-muted hover:bg-theme-surface-hover'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-theme-xs font-medium truncate">{t.name.split(' — ')[0]}</span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-theme-bg border border-theme-border">
                  {t.engine}
                </span>
              </div>
              <p className="text-[11px] text-theme-text-subtle truncate mt-0.5">
                {t.name.split(' — ')[1] || t.template_type}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Right editor & live preview */}
      {activeTpl && (
        <div className="flex-1 px-8 py-6 overflow-auto space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-theme-lg font-semibold text-theme-text">{activeTpl.name}</h2>
                <Badge color={activeTpl.engine === 'svg' ? 'blue' : 'green'}>
                  {activeTpl.engine.toUpperCase()}
                </Badge>
                {activeTpl.requires_signature && (
                  <Badge color="amber">eIDAS PAdES-B-LTA</Badge>
                )}
              </div>
              <p className="text-theme-xs text-theme-text-muted mt-1">
                Zero-UI deterministički predložak s Jinja2 varijablama (<code>{'{{ asset_name }}'}</code>, <code>{'{{ inventory_number }}'}</code>, <code>{'{{ qrcode_svg }}'}</code>, <code>{'{{ barcode_svg }}'}</code>).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handlePreviewTemplate(activeTpl)}
                disabled={isPreviewing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-theme-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition-colors disabled:opacity-50"
              >
                <Eye size={13} />
                {isPreviewing ? 'Rendering…' : 'Live Preview'}
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={isSaving || editedContent === activeTpl.content}
                className="flex items-center gap-1.5 px-3 py-1.5 text-theme-xs border border-theme-border hover:border-theme-border-strong text-theme-text rounded transition-colors disabled:opacity-40"
              >
                <Save size={13} />
                {isSaving ? 'Saving…' : 'Save Template'}
              </button>
            </div>
          </div>

          {previewData && (
            <div className="border border-theme-border rounded-xl overflow-hidden bg-theme-bg">
              <div className="px-4 py-2.5 border-b border-theme-border flex items-center justify-between bg-theme-surface">
                <div className="flex items-center gap-2 text-theme-xs font-medium text-theme-text">
                  <Eye size={13} className="text-indigo-500" />
                  <span>Live Render Preview ({previewData.mime})</span>
                  {previewData.sha256 && (
                    <span className="font-mono text-[10px] text-emerald-500 ml-2">
                      PAdES SHA-256: {previewData.sha256.slice(0, 16)}…
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setPreviewData(null)}
                  className="text-theme-xs text-theme-text-muted hover:text-theme-text"
                >
                  Close Preview ✕
                </button>
              </div>
              <div className="p-6 flex items-center justify-center bg-slate-100">
                {previewData.svgText ? (
                  <div
                    className="bg-white p-4 rounded-lg shadow border border-slate-200"
                    dangerouslySetInnerHTML={{ __html: previewData.svgText }}
                  />
                ) : previewData.url ? (
                  <iframe
                    src={previewData.url}
                    title="Template PDF Preview"
                    className="w-full h-[520px] rounded border border-slate-300 bg-white"
                  />
                ) : null}
              </div>
            </div>
          )}

          <div>
            <label className="block text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider mb-2">
              Template Source ({activeTpl.engine === 'svg' ? 'SVG + Jinja2' : 'Typst + Jinja2'})
            </label>
            <textarea
              value={editedContent}
              onChange={e => setEditedContent(e.target.value)}
              rows={14}
              className="w-full font-mono text-xs bg-theme-bg border border-theme-border rounded-lg p-3.5 text-theme-text focus:outline-none focus:border-theme-primary"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports Tab — 16 ISO/IEC 27001:2022, NIS2 (ZKS) & GDPR Periodic Reports
// ---------------------------------------------------------------------------

type ReportFormat   = 'PDF' | 'CSV' | 'XLSX';
type ReportSchedule = 'on_demand' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface ReportTemplate { id: string; name: string; isDefault: boolean; }
interface ReportDefinition {
  id: string;
  name: string;
  category: string;
  isoControl?: string;
  nis2Ref?: string;
  gdprRef?: string;
  description: string;
  schedule: ReportSchedule;
  format: ReportFormat;
  templates: ReportTemplate[];
  activeTemplateId: string;
  recipients: string;
  enabled: boolean;
  lastRun: string | null;
  lastHash?: string | null;
}

const SCHEDULE_LABELS: Record<ReportSchedule, string> = {
  on_demand: 'On demand', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly',
};

const INITIAL_REPORTS: ReportDefinition[] = [
  {
    id: 'iso_a5_9_roa', name: 'ISO A.5.9 & A.5.12 — Register of Assets & Classification (RoA)', category: 'Assets',
    isoControl: 'ISO 27001 A.5.9, A.5.12', nis2Ref: 'NIS2 Art. 21.2(a),(i)', gdprRef: 'GDPR Art. 30',
    description: 'Cjeloviti registar aktivne imovine po klasifikaciji (PUBLIC/INTERNAL/CONFIDENTIAL/SECRET), vlasništvu i lokaciji, uz detekciju imovine bez vlasnika.',
    schedule: 'monthly', format: 'PDF', enabled: true, lastRun: '2026-04-01 03:30',
    templates: [{ id: 't1', name: 'PAdES-B-LTA — ISO A.5.9 RoA Template', isDefault: true }],
    activeTemplateId: 't1', recipients: 'ciso@posta.hr, it-admin@posta.hr',
  },
  {
    id: 'iso_a5_10_handover', name: 'ISO A.5.10 & A.5.11 — Handover, Return & Signed Reversi', category: 'HR & Endpoints',
    isoControl: 'ISO 27001 A.5.10, A.5.11', nis2Ref: 'NIS2 Art. 21.2(i)', gdprRef: 'GDPR Art. 32.4',
    description: 'Mjesečni pregled svih aktivnih zaduženja opreme (AssetAssignment), vraćene opreme i provjera jesu li sva zaduženja pokrivena PAdES potpisanim reversom.',
    schedule: 'monthly', format: 'PDF', enabled: true, lastRun: '2026-04-01 03:30',
    templates: [{ id: 't2', name: 'PAdES-B-LTA — Handover & Return Audit', isDefault: true }],
    activeTemplateId: 't2', recipients: 'hr@posta.hr, ciso@posta.hr',
  },
  {
    id: 'iso_a5_13_labelling', name: 'ISO A.5.13 — Asset Labelling & Naming Schema Coverage', category: 'Assets',
    isoControl: 'ISO 27001 A.5.13', nis2Ref: 'NIS2 Art. 21.2(a)', gdprRef: '—',
    description: 'Provjera imaju li svi asseti, kutije i ormari valjani inventarni broj, serijski broj i klasifikacijsku oznaku za QR/Code128 naljepnice.',
    schedule: 'monthly', format: 'PDF', enabled: true, lastRun: '2026-04-01 03:30',
    templates: [{ id: 't3', name: 'Default — ISO A.5.13 Labelling Audit', isDefault: true }],
    activeTemplateId: 't3', recipients: 'it-admin@posta.hr',
  },
  {
    id: 'iso_a5_15_access', name: 'ISO A.5.15 & A.5.18 — User Access Rights & Clearance Review (UAR)', category: 'Security & RBAC',
    isoControl: 'ISO 27001 A.5.15, A.5.18, A.8.2', nis2Ref: 'NIS2 Art. 21.2(i),(j)', gdprRef: 'GDPR Art. 32',
    description: 'Matrica svih aktivnih i deaktiviranih korisnika, dodijeljenih rola, 2FA/MFA statusa i provjera usklađenosti sigurnosne razine (Clearance).',
    schedule: 'monthly', format: 'PDF', enabled: true, lastRun: '2026-04-01 03:30',
    templates: [{ id: 't4', name: 'PAdES-B-LTA — Access Rights Review', isDefault: true }],
    activeTemplateId: 't4', recipients: 'ciso@posta.hr',
  },
  {
    id: 'iso_a5_19_supply_chain', name: 'ISO A.5.19–A.5.22 & NIS2 — Supply Chain Security & Vendor SLA', category: 'Supply Chain',
    isoControl: 'ISO 27001 A.5.19–A.5.22', nis2Ref: 'NIS2 Art. 21.2(d)', gdprRef: 'GDPR Art. 28',
    description: 'Pregled svih dobavljača (Vendor), aktivnih ugovora, SLA/MTTR metrika i ugovora koji istječu u idućih 90 dana.',
    schedule: 'monthly', format: 'PDF', enabled: true, lastRun: '2026-04-01 03:30',
    templates: [{ id: 't5', name: 'NIS2 Supply Chain & SLA Evaluation', isDefault: true }],
    activeTemplateId: 't5', recipients: 'procurement@posta.hr, ciso@posta.hr',
  },
  {
    id: 'iso_a5_24_incidents', name: 'ISO A.5.24 & GDPR Art. 33/34 — Lost/Stolen Assets & FDE Evidence', category: 'Security & Incidents',
    isoControl: 'ISO 27001 A.5.24, A.5.28', nis2Ref: 'NIS2 Art. 23 (24h/72h)', gdprRef: 'GDPR Art. 33 & 34.3(a)',
    description: 'Forenzički popis izgubljene/ukradene opreme s dokazom BitLocker/LUKS enkripcije iz SOP checklista za izuzeće po GDPR Čl. 34.',
    schedule: 'daily', format: 'PDF', enabled: true, lastRun: '2026-04-12 05:30',
    templates: [{ id: 't6', name: 'AZOP / CSIRT Forensic Encryption Report', isDefault: true }],
    activeTemplateId: 't6', recipients: 'dpo@posta.hr, ciso@posta.hr',
  },
  {
    id: 'iso_a6_5_offboarding', name: 'ISO A.6.5 — Offboarding & Termination Asset Recovery Audit', category: 'HR & Endpoints',
    isoControl: 'ISO 27001 A.6.5, A.5.11', nis2Ref: 'NIS2 Art. 21.2(i)', gdprRef: 'GDPR Art. 32.4',
    description: 'Detekcija deaktiviranih ili bivših zaposlenika koji još uvijek drže nerazduženu opremu, RFID kartice, ključeve ili tokene.',
    schedule: 'weekly', format: 'PDF', enabled: true, lastRun: '2026-04-07 06:00',
    templates: [{ id: 't7', name: 'Default — Offboarding Clearance Audit', isDefault: true }],
    activeTemplateId: 't7', recipients: 'hr@posta.hr, it-admin@posta.hr',
  },
  {
    id: 'iso_a7_1_physical', name: 'ISO A.7.1–A.7.8 — Physical Perimeters, Server Rooms & Rack Audit', category: 'Physical Security',
    isoControl: 'ISO 27001 A.7.1, A.7.4, A.7.8', nis2Ref: 'NIS2 Art. 21.2(c)', gdprRef: 'GDPR Art. 32',
    description: 'Pregled lokacija, serverskih ormara (Rack U-slot popunjenost), sefova, zaključavanja i razina fizičke zaštite (Level 1–5).',
    schedule: 'monthly', format: 'PDF', enabled: true, lastRun: '2026-04-01 03:30',
    templates: [{ id: 't8', name: 'Datacenter & Physical Security Report', isDefault: true }],
    activeTemplateId: 't8', recipients: 'facilities@posta.hr, ciso@posta.hr',
  },
  {
    id: 'iso_a7_9_transit', name: 'ISO A.7.9 & A.7.10 — Off-Premises Assets & Box Custody Transit', category: 'Physical Security',
    isoControl: 'ISO 27001 A.7.9, A.7.10, A.5.14', nis2Ref: 'NIS2 Art. 21.2(c)', gdprRef: 'GDPR Art. 28 & 32',
    description: 'Nadzor opreme na vanjskom servisu i transportnih kutija (Box) u tranzitu s provjerom sigurnosnih plombi (Tamper-Evident Seal).',
    schedule: 'weekly', format: 'PDF', enabled: true, lastRun: '2026-04-07 06:00',
    templates: [{ id: 't9', name: 'Chain of Custody & Transit Report', isDefault: true }],
    activeTemplateId: 't9', recipients: 'logistics@posta.hr',
  },
  {
    id: 'iso_a7_13_maintenance', name: 'ISO A.7.13 — Preventive Maintenance, Calibration & Overdue WOs', category: 'Maintenance',
    isoControl: 'ISO 27001 A.7.13', nis2Ref: 'NIS2 Art. 21.2(c)', gdprRef: '—',
    description: 'Status redovnih planova održavanja (UPS, agregati, klima, vatrodojava, kalibracije) i prekoračenih radnih naloga (WorkOrder).',
    schedule: 'monthly', format: 'PDF', enabled: true, lastRun: '2026-04-01 03:30',
    templates: [{ id: 't10', name: 'ISO A.7.13 Maintenance Compliance', isDefault: true }],
    activeTemplateId: 't10', recipients: 'maintenance@posta.hr',
  },
  {
    id: 'iso_a7_14_sanitization', name: 'ISO A.7.14 & A.8.10 — Reassignment Sanitization & 4-Eyes Disposal', category: 'Security & GDPR',
    isoControl: 'ISO 27001 A.7.14, A.8.10', nis2Ref: 'NIS2 Art. 21.2(e)', gdprRef: 'GDPR Art. 5.1(f) & 17',
    description: 'Registar svih sanitizacija pri prijelazu laptopa (User A → User B) i NIST 800-88 certifikata o brisanju kod rashoda uz 4-oči potvrdu.',
    schedule: 'monthly', format: 'PDF', enabled: true, lastRun: '2026-04-01 03:30',
    templates: [{ id: 't11', name: 'NIST 800-88 & GDPR Sanitization Register', isDefault: true }],
    activeTemplateId: 't11', recipients: 'dpo@posta.hr, ciso@posta.hr',
  },
  {
    id: 'iso_a8_1_endpoints', name: 'ISO A.8.1 & A.8.24 — Endpoint Hardening (FDE, MDM/EDR & SOPs)', category: 'HR & Endpoints',
    isoControl: 'ISO 27001 A.8.1, A.8.7, A.8.24', nis2Ref: 'NIS2 Art. 21.2(g),(h)', gdprRef: 'GDPR Art. 32.1(a)',
    description: 'Pregled svih izdanih krajnjih uređaja i statusa izvršenih sigurnosnih SOP checklista (BitLocker/LUKS, EDR, ukidanje lokalnog admina).',
    schedule: 'monthly', format: 'PDF', enabled: true, lastRun: '2026-04-01 03:30',
    templates: [{ id: 't12', name: 'Endpoint Cyber Hygiene Report', isDefault: true }],
    activeTemplateId: 't12', recipients: 'it-admin@posta.hr, ciso@posta.hr',
  },
  {
    id: 'iso_a8_8_eol', name: 'ISO A.8.8 & NIS2 Art. 21.2(e) — EoL / EoS Hardware & Expired Warranties', category: 'Assets',
    isoControl: 'ISO 27001 A.8.8', nis2Ref: 'NIS2 Art. 21.2(e)', gdprRef: 'GDPR Art. 32',
    description: 'Popis opreme s isteklom garancijom ili pred istekom podrške proizvođača (EoL/EoS) koja ne prima sigurnosne zakrpe.',
    schedule: 'monthly', format: 'PDF', enabled: true, lastRun: '2026-04-01 03:30',
    templates: [{ id: 't13', name: 'NIS2 EoL & Vulnerability Horizon', isDefault: true }],
    activeTemplateId: 't13', recipients: 'ciso@posta.hr, procurement@posta.hr',
  },
  {
    id: 'iso_a8_14_bcp_spares', name: 'ISO A.8.14 & NIS2 Art. 21.2(c) — Critical Spares & Minimum Stock (BCP)', category: 'Supplies',
    isoControl: 'ISO 27001 A.8.14', nis2Ref: 'NIS2 Art. 21.2(c)', gdprRef: 'GDPR Art. 32.1(c)',
    description: 'Stanje kritičnih rezervnih dijelova (HDD, PSU, SFP), potrošnog materijala i opreme ispod minimalnog praga za kontinuitet poslovanja.',
    schedule: 'monthly', format: 'CSV', enabled: true, lastRun: '2026-04-01 03:30',
    templates: [{ id: 't14', name: 'BCP Critical Spares & Stock Thresholds', isDefault: true }],
    activeTemplateId: 't14', recipients: 'warehouse@posta.hr',
  },
  {
    id: 'iso_a8_15_audit_log', name: 'ISO A.8.15 & A.8.16 — Immutable Audit Trail & Privileged Actions', category: 'Security & RBAC',
    isoControl: 'ISO 27001 A.8.15, A.8.16', nis2Ref: 'NIS2 Art. 21.2(b),(i)', gdprRef: 'GDPR Art. 5.2',
    description: 'Mjesečni izvadak iz nepromjenjivog AuditLoga za sigurnosno osjetljive akcije, promjene rola, konfiguracije i brisanja.',
    schedule: 'monthly', format: 'PDF', enabled: true, lastRun: '2026-04-01 03:30',
    templates: [{ id: 't15', name: 'Immutable Security Audit Log Summary', isDefault: true }],
    activeTemplateId: 't15', recipients: 'ciso@posta.hr',
  },
  {
    id: 'iso_a8_24_pki_tsa', name: 'ISO A.8.24 & eIDAS — Signing Certificates & PAdES-LTA Timestamps', category: 'Certificates',
    isoControl: 'ISO 27001 A.8.24, A.5.33', nis2Ref: 'NIS2 Art. 21.2(h)', gdprRef: 'GDPR Art. 5.1(f)',
    description: 'Status svih kriptografski potpisanih dokumenata u arhivi (AssetDocument), SHA-256 integritet, broj žigova i rokovi LTA obnove.',
    schedule: 'monthly', format: 'PDF', enabled: true, lastRun: '2026-04-01 03:30',
    templates: [{ id: 't16', name: 'PAdES-B-LTA Archival Integrity Report', isDefault: true }],
    activeTemplateId: 't16', recipients: 'compliance@posta.hr, ciso@posta.hr',
  },
];

const REPORT_CATEGORIES = ['Assets', 'HR & Endpoints', 'Security & RBAC', 'Supply Chain', 'Security & Incidents', 'Physical Security', 'Maintenance', 'Security & GDPR', 'Supplies', 'Certificates'];
const FORMAT_OPTIONS: ReportFormat[] = ['PDF', 'CSV', 'XLSX'];
const SCHEDULE_OPTIONS: ReportSchedule[] = ['on_demand', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

function FormatBadge({ format }: { format: ReportFormat }) {
  const colors: Record<ReportFormat, string> = {
    PDF:  'text-red-700 bg-red-50 border-red-200',
    CSV:  'text-emerald-700 bg-emerald-50 border-emerald-200',
    XLSX: 'text-green-700 bg-green-50 border-green-200',
  };
  return <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${colors[format]}`}>{format}</span>;
}

export function ReportsTab() {
  const { tenantConfig, setTenantConfig } = useContext(SettingsContext);
  const [reports, setReports] = useState<ReportDefinition[]>(INITIAL_REPORTS);
  const [selected, setSelected] = useState<string>(INITIAL_REPORTS[0].id);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Assets');
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [runningId, setRunningId] = useState<string | null>(null);
  const [reportPreview, setReportPreview] = useState<{
    reportName: string;
    format: ReportFormat;
    pdfUrl?: string;
    csvRows?: string[][];
    sha256?: string | null;
    tsaExpires?: string | null;
    downloadBlobUrl: string;
    downloadFileName: string;
  } | null>(null);

  useEffect(() => {
    const saved = tenantConfig?.settings?.report_schedules;
    if (Array.isArray(saved) && saved.length > 0) {
      setReports(saved as unknown as ReportDefinition[]);
    }
  }, [tenantConfig?.settings?.report_schedules]);

  const cur = reports.find(r => r.id === selected) ?? reports[0];

  const persistReports = (next: ReportDefinition[]) => {
    setReports(next);
    apiFetch<TenantConfigData>('/tenants/config/settings', {
      method: 'PATCH',
      body: JSON.stringify({ report_schedules: next }),
    }).then(setTenantConfig).catch(() => {});
  };

  const update = (id: string, patch: Partial<ReportDefinition>) => {
    const next = reports.map(r => r.id === id ? { ...r, ...patch } : r);
    persistReports(next);
  };

  const executeReport = async (r: ReportDefinition, mode: 'preview' | 'download') => {
    setRunningId(r.id);
    const token = getAccessToken();
    try {
      const targetFormat = mode === 'preview' && r.format === 'XLSX' ? 'PDF' : r.format;
      const res = await fetch(`/api/v1/documents/compliance-reports/${r.id}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ format: targetFormat }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const sha256 = res.headers.get('X-Document-SHA256');
      const tsaExpires = res.headers.get('X-Document-TSA-Expires');
      const blob = await res.blob();
      const ext = targetFormat.toLowerCase();
      const url = URL.createObjectURL(blob);
      const fileName = `${r.id}_${new Date().toISOString().slice(0, 10)}.${ext}`;

      if (mode === 'download') {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else if (targetFormat === 'CSV') {
        const text = await blob.text();
        const rows = text
          .trim()
          .split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.split(';'));
        setReportPreview({
          reportName: r.name,
          format: 'CSV',
          csvRows: rows,
          sha256,
          tsaExpires,
          downloadBlobUrl: url,
          downloadFileName: fileName,
        });
      } else {
        setReportPreview({
          reportName: r.name,
          format: 'PDF',
          pdfUrl: url,
          sha256,
          tsaExpires,
          downloadBlobUrl: url,
          downloadFileName: fileName,
        });
      }

      const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
      update(r.id, { lastRun: nowStr, lastHash: sha256 });
    } catch {
      update(r.id, { lastRun: new Date().toISOString().slice(0, 16).replace('T', ' ') });
    } finally {
      setRunningId(null);
    }
  };

  const addReport = () => {
    if (!newName.trim()) return;
    const id = Date.now().toString();
    const tmplId = id + '_t';
    const next: ReportDefinition[] = [...reports, {
      id, name: newName.trim(), category: newCategory,
      description: '', schedule: 'on_demand', format: 'PDF',
      templates: [{ id: tmplId, name: 'Default', isDefault: true }],
      activeTemplateId: tmplId, recipients: '', enabled: false, lastRun: null,
    }];
    persistReports(next);
    setSelected(id);
    setNewName(''); setAdding(false);
  };

  const addTemplate = () => {
    if (!newTemplateName.trim()) return;
    const tmplId = Date.now().toString();
    update(cur.id, { templates: [...cur.templates, { id: tmplId, name: newTemplateName.trim(), isDefault: false }] });
    setNewTemplateName(''); setAddingTemplate(false);
  };

  const removeTemplate = (tmplId: string) => {
    if (cur.templates.length <= 1) return;
    const next = cur.templates.filter(t => t.id !== tmplId);
    update(cur.id, {
      templates: next,
      activeTemplateId: cur.activeTemplateId === tmplId ? next[0].id : cur.activeTemplateId,
    });
  };

  return (
    <div className="flex min-h-full">
      <div className="w-56 shrink-0 border-r border-theme-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border">
          <p className="text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider">Reports</p>
          <button onClick={() => setAdding(true)} className="p-0.5 text-theme-text-subtle hover:text-theme-primary transition-colors"><Plus size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {reports.map(r => (
            <button key={r.id} onClick={() => setSelected(r.id)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${selected === r.id ? 'bg-theme-surface-hover text-theme-text' : 'text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text'}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.enabled ? 'bg-emerald-500' : 'bg-theme-border-strong'}`} />
              <span className="text-theme-sm flex-1 truncate">{r.name}</span>
            </button>
          ))}
          {adding && (
            <div className="px-3 py-2 border-t border-theme-border space-y-2">
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addReport(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
                placeholder="Report name" className="w-full text-theme-xs bg-theme-bg border border-theme-border rounded px-2 py-1 focus:outline-none focus:border-theme-primary" />
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                className="w-full text-theme-xs bg-theme-bg border border-theme-border rounded px-2 py-1 focus:outline-none">
                {REPORT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <div className="flex gap-1">
                <button onClick={addReport} className="flex-1 py-1 text-theme-xs bg-theme-primary text-theme-primary-fg rounded transition-colors">Add</button>
                <button onClick={() => { setAdding(false); setNewName(''); }} className="px-2 py-1 text-theme-xs text-theme-text-muted hover:text-theme-text transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-8 py-6 overflow-auto">
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-theme-lg font-semibold text-theme-text">{cur.name}</h2>
              <FormatBadge format={cur.format} />
              <span className="text-theme-xs text-theme-text-subtle bg-theme-bg border border-theme-border px-1.5 py-0.5 rounded">{cur.category}</span>
              {cur.isoControl && (
                <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                  ISO 27001 {cur.isoControl}
                </span>
              )}
              {cur.nis2Ref && cur.nis2Ref !== '—' && (
                <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                  {cur.nis2Ref}
                </span>
              )}
              {cur.gdprRef && cur.gdprRef !== '—' && (
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                  {cur.gdprRef}
                </span>
              )}
            </div>
            <p className="text-theme-xs text-theme-text-muted mt-0.5">
              {cur.lastRun ? `Last run: ${cur.lastRun}` : 'Never run'}
              {cur.lastHash && (
                <span className="ml-2 font-mono text-[10px] text-emerald-400">
                  PAdES-B-LTA SHA-256: {cur.lastHash.slice(0, 16)}…
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => executeReport(cur, 'preview')}
              disabled={runningId === cur.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-theme-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition-colors disabled:opacity-50"
            >
              <Eye size={12} />
              {runningId === cur.id ? 'Generating…' : 'Preview Report'}
            </button>
            <button
              onClick={() => executeReport(cur, 'download')}
              disabled={runningId === cur.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-theme-xs border border-theme-border hover:border-theme-border-strong text-theme-text-muted hover:text-theme-text rounded transition-colors disabled:opacity-50"
            >
              <Download size={12} />
              Download ({cur.format})
            </button>
            <Toggle value={cur.enabled} onChange={v => update(cur.id, { enabled: v })} />
          </div>
        </div>

        {reportPreview && (
          <div className="mt-5 border border-theme-border rounded-xl overflow-hidden bg-theme-bg shadow-lg">
            <div className="px-4 py-3 border-b border-theme-border bg-theme-surface flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-indigo-500" />
                  <span className="text-theme-sm font-semibold text-theme-text">
                    {reportPreview.reportName}
                  </span>
                  <FormatBadge format={reportPreview.format} />
                </div>
                {reportPreview.sha256 && (
                  <p className="text-[11px] font-mono text-emerald-500 mt-0.5">
                    eIDAS PAdES-B-LTA SHA-256: {reportPreview.sha256}
                    {reportPreview.tsaExpires ? ` · TSA Valid Until: ${reportPreview.tsaExpires.slice(0, 10)}` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={reportPreview.downloadBlobUrl}
                  download={reportPreview.downloadFileName}
                  className="flex items-center gap-1 px-2.5 py-1 text-theme-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium"
                >
                  <Download size={12} /> Download
                </a>
                <button
                  onClick={() => setReportPreview(null)}
                  className="px-2.5 py-1 text-theme-xs text-theme-text-muted hover:text-theme-text border border-theme-border rounded"
                >
                  Close ✕
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-100">
              {reportPreview.pdfUrl ? (
                <iframe
                  src={reportPreview.pdfUrl}
                  title="Compliance Report PDF Preview"
                  className="w-full h-[560px] rounded border border-slate-300 bg-white"
                />
              ) : reportPreview.csvRows ? (
                <div className="max-h-[480px] overflow-auto bg-white rounded border border-slate-300 p-3">
                  <table className="w-full text-xs border-collapse">
                    <tbody>
                      {reportPreview.csvRows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={
                            row[0]?.startsWith('#')
                              ? 'bg-slate-50 text-slate-600 font-mono'
                              : 'border-b border-slate-200 hover:bg-slate-50'
                          }
                        >
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-2.5 py-1.5 text-slate-800">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className="mt-6 space-y-6">
          <div>
            <p className="text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider mb-3">General</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-theme-xs text-theme-text-muted w-28 shrink-0">Description</label>
                <input value={cur.description} onChange={e => update(cur.id, { description: e.target.value })}
                  placeholder="What this report covers…"
                  className="flex-1 text-theme-sm bg-theme-bg border border-theme-border rounded px-3 py-1.5 focus:outline-none focus:border-theme-primary text-theme-text" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-theme-xs text-theme-text-muted w-28 shrink-0">Category</label>
                <select value={cur.category} onChange={e => update(cur.id, { category: e.target.value })}
                  className="text-theme-sm bg-theme-bg border border-theme-border rounded px-3 py-1.5 focus:outline-none focus:border-theme-primary text-theme-text w-40">
                  {REPORT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-theme-xs text-theme-text-muted w-28 shrink-0">Output format</label>
                <div className="flex gap-1">
                  {FORMAT_OPTIONS.map(f => (
                    <button key={f} onClick={() => update(cur.id, { format: f })}
                      className={`px-3 py-1 text-theme-xs rounded border transition-colors ${cur.format === f ? 'border-theme-primary text-theme-primary bg-theme-primary/5' : 'border-theme-border text-theme-text-muted hover:border-theme-border-strong'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider mb-3">Schedule</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-theme-xs text-theme-text-muted w-28 shrink-0">Frequency</label>
                <div className="flex gap-1 flex-wrap">
                  {SCHEDULE_OPTIONS.map(s => (
                    <button key={s} onClick={() => update(cur.id, { schedule: s })}
                      className={`px-3 py-1 text-theme-xs rounded border transition-colors ${cur.schedule === s ? 'border-theme-primary text-theme-primary bg-theme-primary/5' : 'border-theme-border text-theme-text-muted hover:border-theme-border-strong'}`}>
                      {SCHEDULE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              {cur.schedule !== 'on_demand' && (
                <div className="flex items-center gap-3">
                  <label className="text-theme-xs text-theme-text-muted w-28 shrink-0">Recipients</label>
                  <input value={cur.recipients} onChange={e => update(cur.id, { recipients: e.target.value })}
                    placeholder="email@company.com, another@company.com"
                    className="flex-1 text-theme-sm bg-theme-bg border border-theme-border rounded px-3 py-1.5 focus:outline-none focus:border-theme-primary text-theme-text font-mono text-theme-xs" />
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider">Templates</p>
                <p className="text-theme-xs text-theme-text-muted mt-0.5">Define layout and included columns. One template is active per report.</p>
              </div>
              <button onClick={() => setAddingTemplate(true)} className="flex items-center gap-1 text-theme-xs text-theme-primary hover:text-theme-primary-hover transition-colors">
                <Plus size={12} /> New template
              </button>
            </div>
            <div className="border border-theme-border rounded-lg overflow-hidden">
              {cur.templates.map((t, i) => (
                <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${i < cur.templates.length - 1 ? 'border-b border-theme-border' : ''} hover:bg-theme-surface-hover`}>
                  <input type="radio" checked={cur.activeTemplateId === t.id}
                    onChange={() => update(cur.id, { activeTemplateId: t.id })}
                    className="accent-[var(--t-primary)]" />
                  <span className="text-theme-sm text-theme-text flex-1">{t.name}</span>
                  {t.isDefault && <Badge color="slate">default</Badge>}
                  {cur.activeTemplateId === t.id && <Badge color="green">active</Badge>}
                  {!t.isDefault && (
                    <button onClick={() => removeTemplate(t.id)} className="p-1 text-theme-text-subtle hover:text-theme-danger transition-colors">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              {addingTemplate && (
                <div className="flex items-center gap-2 px-4 py-2.5 border-t border-theme-border bg-theme-bg">
                  <input autoFocus value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTemplate(); if (e.key === 'Escape') { setAddingTemplate(false); setNewTemplateName(''); } }}
                    placeholder="Template name" className="flex-1 text-theme-sm bg-theme-surface border border-theme-border rounded px-2.5 py-1 focus:outline-none focus:border-theme-primary text-theme-text" />
                  <button onClick={addTemplate} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                  <button onClick={() => { setAddingTemplate(false); setNewTemplateName(''); }} className="p-1 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
