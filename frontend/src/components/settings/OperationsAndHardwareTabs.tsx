import React, { useState, useRef } from 'react';
import {
  ChevronRight, ShieldCheck, Clock, Upload, RefreshCw,
  Award, Trash2, Bot, FileText, Tag, Plus, Check, X,
} from 'lucide-react';
import {
  SectionHeader, SettingRow, Input, Select, Badge, SaveBar, Toggle,
} from './SettingsShared';
import { useApiQuery } from '../../hooks/useApi';
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
  const [tsaUrl, setTsaUrl] = useState('http://timestamp.digicert.com');
  const [tsaVendor, setTsaVendor] = useState('DigiCert');
  const [expiryAlert, setExpiryAlert] = useState('30 days');
  const [confirmRegen, setConfirmRegen] = useState(false);
  const caInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="max-w-2xl space-y-8">
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
                <span className="text-theme-sm font-medium text-theme-text">CN=Hrvatska Pošta d.d., O=HP, C=HR</span>
                <Badge color="blue">auto-generated</Badge>
              </div>
              <p className="text-theme-xs text-theme-text-muted">Issuer: Self-signed (auto-generated)</p>
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
        <SettingRow label="TSA URL"><Input value={tsaUrl} onChange={setTsaUrl} className="w-72" /></SettingRow>
        <SettingRow label="TSA Vendor"><Input value={tsaVendor} onChange={setTsaVendor} className="w-44" /></SettingRow>
        <SettingRow label="Expiry Alert Threshold" description="Notify before certificate expires">
          <Select value={expiryAlert} onChange={setExpiryAlert} options={['7 days', '14 days', '30 days', '60 days', '90 days']} className="w-36" />
        </SettingRow>
        <SaveBar onSave={() => {}} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Automation, Audit & Printing Tabs
// ---------------------------------------------------------------------------

export function AutomationTab() {
  return (
    <div className="max-w-lg flex flex-col items-center justify-center py-20 mx-auto text-center">
      <div className="w-12 h-12 bg-theme-bg border border-theme-border rounded-full flex items-center justify-center mb-4">
        <Bot size={20} className="text-theme-text-muted" />
      </div>
      <p className="text-theme-text font-medium mb-1">Automation Rules</p>
      <p className="text-theme-sm text-theme-text-muted">Trigger-based automation for asset lifecycle, notifications, and integrations. Coming in Phase 3.</p>
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

export function PrintingTab() {
  return (
    <div className="max-w-lg flex flex-col items-center justify-center py-20 mx-auto text-center">
      <div className="w-12 h-12 bg-theme-bg border border-theme-border rounded-full flex items-center justify-center mb-4">
        <Tag size={20} className="text-theme-text-muted" />
      </div>
      <p className="text-theme-text font-medium mb-1">Barcode &amp; Printing</p>
      <p className="text-theme-sm text-theme-text-muted">Label templates, printer configuration, barcode formats (QR, Code128, DataMatrix). Coming in Phase 3.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports Tab
// ---------------------------------------------------------------------------

type ReportFormat   = 'PDF' | 'CSV' | 'XLSX';
type ReportSchedule = 'on_demand' | 'daily' | 'weekly' | 'monthly' | 'quarterly';

interface ReportTemplate { id: string; name: string; isDefault: boolean; }
interface ReportDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  schedule: ReportSchedule;
  format: ReportFormat;
  templates: ReportTemplate[];
  activeTemplateId: string;
  recipients: string;
  enabled: boolean;
  lastRun: string | null;
}

const SCHEDULE_LABELS: Record<ReportSchedule, string> = {
  on_demand: 'On demand', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly',
};

const INITIAL_REPORTS: ReportDefinition[] = [
  {
    id: 'r1', name: 'Asset Inventory', category: 'Assets',
    description: 'Full list of all assets with current status, location, and assigned employee.',
    schedule: 'monthly', format: 'XLSX', enabled: true, lastRun: '2026-04-01 03:00',
    templates: [{ id: 't1', name: 'Default — Asset Inventory', isDefault: true }],
    activeTemplateId: 't1', recipients: 'it-admin@posta.hr',
  },
  {
    id: 'r2', name: 'Asset Lifecycle', category: 'Assets',
    description: 'Assets approaching end-of-life based on warranty expiry and purchase date.',
    schedule: 'quarterly', format: 'PDF', enabled: true, lastRun: '2026-01-01 03:00',
    templates: [{ id: 't2', name: 'Default — Asset Lifecycle', isDefault: true }],
    activeTemplateId: 't2', recipients: '',
  },
  {
    id: 'r3', name: 'Work Order Summary', category: 'Maintenance',
    description: 'Summary of completed, pending, and overdue work orders per period.',
    schedule: 'weekly', format: 'PDF', enabled: true, lastRun: '2026-04-07 03:00',
    templates: [{ id: 't3', name: 'Default — Work Orders', isDefault: true }],
    activeTemplateId: 't3', recipients: 'maintenance@posta.hr',
  },
  {
    id: 'r4', name: 'Stock Level Report', category: 'Supplies',
    description: 'Current stock levels for all supplies, flagging items below minimum threshold.',
    schedule: 'weekly', format: 'CSV', enabled: false, lastRun: null,
    templates: [{ id: 't4', name: 'Default — Stock Levels', isDefault: true }],
    activeTemplateId: 't4', recipients: '',
  },
  {
    id: 'r5', name: 'Compliance Report', category: 'Certificates',
    description: 'Assets and certificates with expiring or missing compliance documents.',
    schedule: 'monthly', format: 'PDF', enabled: true, lastRun: '2026-04-01 03:00',
    templates: [{ id: 't5', name: 'Default — Compliance', isDefault: true }],
    activeTemplateId: 't5', recipients: 'compliance@posta.hr',
  },
];

const REPORT_CATEGORIES = ['Assets', 'Maintenance', 'Supplies', 'Certificates', 'Finance', 'HR'];
const FORMAT_OPTIONS: ReportFormat[] = ['PDF', 'CSV', 'XLSX'];
const SCHEDULE_OPTIONS: ReportSchedule[] = ['on_demand', 'daily', 'weekly', 'monthly', 'quarterly'];

function FormatBadge({ format }: { format: ReportFormat }) {
  const colors: Record<ReportFormat, string> = {
    PDF:  'text-red-700 bg-red-50 border-red-200',
    CSV:  'text-emerald-700 bg-emerald-50 border-emerald-200',
    XLSX: 'text-green-700 bg-green-50 border-green-200',
  };
  return <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${colors[format]}`}>{format}</span>;
}

export function ReportsTab() {
  const [reports, setReports] = useState<ReportDefinition[]>(INITIAL_REPORTS);
  const [selected, setSelected] = useState<string>(INITIAL_REPORTS[0].id);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Assets');
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  const cur = reports.find(r => r.id === selected)!;

  const update = (id: string, patch: Partial<ReportDefinition>) =>
    setReports(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));

  const addReport = () => {
    if (!newName.trim()) return;
    const id = Date.now().toString();
    const tmplId = id + '_t';
    setReports(rs => [...rs, {
      id, name: newName.trim(), category: newCategory,
      description: '', schedule: 'on_demand', format: 'PDF',
      templates: [{ id: tmplId, name: 'Default', isDefault: true }],
      activeTemplateId: tmplId, recipients: '', enabled: false, lastRun: null,
    }]);
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
            <div className="flex items-center gap-2">
              <h2 className="text-theme-lg font-semibold text-theme-text">{cur.name}</h2>
              <FormatBadge format={cur.format} />
              <span className="text-theme-xs text-theme-text-subtle bg-theme-bg border border-theme-border px-1.5 py-0.5 rounded">{cur.category}</span>
            </div>
            <p className="text-theme-xs text-theme-text-muted mt-0.5">
              {cur.lastRun ? `Last run: ${cur.lastRun}` : 'Never run'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-theme-xs border border-theme-border hover:border-theme-border-strong text-theme-text-muted hover:text-theme-text rounded transition-colors">
              <RefreshCw size={11} /> Run now
            </button>
            <Toggle value={cur.enabled} onChange={v => update(cur.id, { enabled: v })} />
          </div>
        </div>

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
