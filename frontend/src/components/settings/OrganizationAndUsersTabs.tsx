import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  AlertTriangle, Filter, Plus, X, Shuffle, Zap, ArrowRight,
  Webhook, Activity, Edit2, Trash2, RefreshCw, CheckCircle2,
  ChevronRight, Server, Lock, Check, Info, Search, Link2,
} from 'lucide-react';
import {
  SettingsContext, TenantConfigData, apiFetch,
  SectionHeader, Toggle, Input, Select, Badge,
} from './SettingsShared';
import { useApiQuery } from '../../hooks/useApi';
import type { PagedResponse } from '../../types/api';

// ---------------------------------------------------------------------------
// Modules Tab
// ---------------------------------------------------------------------------

export function ModulesTab() {
  const { tenantConfig, setTenantConfig } = useContext(SettingsContext);
  const modules = [
    { key: 'vendors', name: 'Vendors', description: 'Full vendor cards, contracts, reliability metrics, MTTR tracking.', icon: '🏭' },
    { key: 'supplies', name: 'Supplies', description: 'Consumables, spare parts, accessories. Stock instances, movements ledger.', icon: '🛒' },
    { key: 'storage', name: 'Storage & Boxes', description: 'Storage units (cabinets, racks, safes), shelves, drawers. Box tracking.', icon: '📦' },
    { key: 'maintenance', name: 'Maintenance', description: 'Scheduled work orders, maintenance templates, recurring tasks.', icon: '🔧' },
    { key: 'checklists', name: 'SOP Checklists', description: 'Attach SOP checklists to asset transitions. Asset locked until complete.', icon: '📋' },
    { key: 'advanced_permissions', name: 'Advanced Permissions', description: 'Location and organization-scoped roles, role inheritance.', icon: '🔐' },
  ];
  const fallback: Record<string, boolean> = { vendors: false, supplies: false, storage: false, maintenance: false, checklists: false, advanced_permissions: false };
  const [states, setStates] = useState<Record<string, boolean>>(fallback);
  const [confirmOff, setConfirmOff] = useState<string | null>(null);

  useEffect(() => {
    if (tenantConfig?.modules) setStates(prev => ({ ...prev, ...tenantConfig.modules }));
  }, [tenantConfig]);

  const patchModule = useCallback((key: string, value: boolean) => {
    setStates(s => ({ ...s, [key]: value }));
    apiFetch<TenantConfigData>('/tenants/config/modules', {
      method: 'PATCH',
      body: JSON.stringify({ [key]: value }),
    }).then(setTenantConfig).catch(() => {});
  }, [setTenantConfig]);

  const toggle = (key: string) => states[key] ? setConfirmOff(key) : patchModule(key, true);
  return (
    <div className="max-w-2xl">
      <SectionHeader title="Feature Modules" description="Disabled modules are completely hidden from all users. Data is preserved when a module is turned off." />
      <div className="space-y-2">
        {modules.map((m) => (
          <div key={m.key} className={`p-4 rounded-lg border transition-colors ${states[m.key] ? 'border-theme-border-strong bg-theme-surface' : 'border-theme-border bg-theme-bg'}`}>
            {confirmOff === m.key ? (
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-theme-sm font-medium text-theme-text">Disable {m.name}?</p>
                  <p className="text-theme-xs text-theme-text-muted mt-1">All data will be preserved but the module will be hidden from all users.</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => { patchModule(m.key, false); setConfirmOff(null); }} className="px-3 py-1 text-theme-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded transition-colors">Disable anyway</button>
                    <button onClick={() => setConfirmOff(null)} className="px-3 py-1 text-theme-xs text-theme-text-muted hover:text-theme-text transition-colors">Cancel</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-lg leading-none mt-0.5">{m.icon}</span>
                  <div>
                    <p className={`text-theme-sm font-medium ${states[m.key] ? 'text-theme-text' : 'text-theme-text-muted'}`}>{m.name}</p>
                    <p className="text-theme-xs text-theme-text-subtle mt-0.5 max-w-md">{m.description}</p>
                  </div>
                </div>
                <Toggle value={states[m.key]} onChange={() => toggle(m.key)} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Integrations Tab
// ---------------------------------------------------------------------------

const EVENTS = [
  { group: 'Asset',        value: 'asset.created',           label: 'Asset created' },
  { group: 'Asset',        value: 'asset.updated',           label: 'Asset updated' },
  { group: 'Asset',        value: 'asset.status_changed',    label: 'Asset status changed' },
  { group: 'Asset',        value: 'asset.assigned',          label: 'Asset assigned to employee' },
  { group: 'Asset',        value: 'asset.unassigned',        label: 'Asset unassigned' },
  { group: 'Asset',        value: 'asset.decommissioned',    label: 'Asset decommissioned' },
  { group: 'Asset',        value: 'asset.in_repair',         label: 'Asset marked in repair' },
  { group: 'Asset',        value: 'asset.warranty_expiring', label: 'Asset warranty expiring (< 30 days)' },
  { group: 'Asset',        value: 'asset.location_changed',  label: 'Asset location changed' },
  { group: 'Work Order',   value: 'work_order.created',      label: 'Work order created' },
  { group: 'Work Order',   value: 'work_order.assigned',     label: 'Work order assigned to technician' },
  { group: 'Work Order',   value: 'work_order.completed',    label: 'Work order completed' },
  { group: 'Work Order',   value: 'work_order.overdue',      label: 'Work order overdue' },
  { group: 'Work Order',   value: 'work_order.cancelled',    label: 'Work order cancelled' },
  { group: 'Supply',       value: 'supply.low_stock',        label: 'Supply below minimum stock' },
  { group: 'Supply',       value: 'supply.out_of_stock',     label: 'Supply out of stock' },
  { group: 'Supply',       value: 'supply.stock_in',         label: 'Supply stock received' },
  { group: 'Supply',       value: 'supply.reorder_triggered',label: 'Supply auto-reorder triggered' },
  { group: 'Certificate',  value: 'certificate.expiring',    label: 'Certificate expiring (< 30 days)' },
  { group: 'Certificate',  value: 'certificate.expired',     label: 'Certificate expired' },
  { group: 'Certificate',  value: 'certificate.renewed',     label: 'Certificate renewed' },
  { group: 'Maintenance',  value: 'maintenance.due',         label: 'Scheduled maintenance due' },
  { group: 'Maintenance',  value: 'maintenance.overdue',     label: 'Scheduled maintenance overdue' },
  { group: 'Employee',     value: 'employee.created',        label: 'Employee added' },
  { group: 'Employee',     value: 'employee.deactivated',    label: 'Employee deactivated' },
  { group: 'Import',       value: 'import.completed',        label: 'Import job completed' },
  { group: 'Import',       value: 'import.failed',           label: 'Import job failed' },
];

function getEventDomain(event: string): string {
  if (event.startsWith('asset.'))       return 'asset';
  if (event.startsWith('supply.'))      return 'supply';
  if (event.startsWith('work_order.'))  return 'work_order';
  if (event.startsWith('certificate.')) return 'certificate';
  if (event.startsWith('maintenance.')) return 'maintenance';
  if (event.startsWith('employee.'))    return 'employee';
  if (event.startsWith('import.'))      return 'import';
  return 'asset';
}

const SCOPE_FIELDS_BY_DOMAIN: Record<string, Array<{ value: string; label: string; values: string[] }>> = {
  asset: [
    { value: 'asset_type',     label: 'Asset Type',     values: ['Laptop', 'Desktop', 'Server', 'Printer', 'Network Switch', 'Mobile Phone', 'Tablet', 'UPS', 'IP Phone', 'Access Point'] },
    { value: 'asset_category', label: 'Asset Category', values: ['IT Equipment', 'Office Equipment', 'Network Infrastructure', 'Mobile Devices', 'Power Equipment'] },
    { value: 'location',       label: 'Location',       values: ['Zagreb HQ', 'Split office', 'Osijek office', 'Warehouse A', 'Warehouse B', 'Server Room'] },
    { value: 'department',     label: 'Department',     values: ['IT', 'Finance', 'HR', 'Operations', 'Management', 'Legal'] },
    { value: 'status',         label: 'Status',         values: ['active', 'in_repair', 'decommissioned', 'in_storage', 'assigned', 'pending'] },
    { value: 'classification', label: 'Classification', values: ['standard', 'critical', 'sensitive'] },
    { value: 'vendor',         label: 'Vendor',         values: ['Dell', 'HP', 'Lenovo', 'Cisco', 'Apple', 'Samsung'] },
  ],
  supply: [
    { value: 'supply_type',     label: 'Supply Type',     values: ['Consumable', 'Spare Part', 'Accessory', 'Component'] },
    { value: 'supply_category', label: 'Category',        values: ['Toner / Ink', 'Cables & Adapters', 'Memory', 'Batteries', 'Paper', 'Office Supplies', 'Cleaning'] },
    { value: 'location',        label: 'Warehouse',       values: ['Warehouse A', 'Warehouse B', 'Server Room', 'Zagreb HQ'] },
  ],
  work_order: [
    { value: 'wo_type',     label: 'Type',       values: ['Repair', 'Maintenance', 'Installation', 'Audit', 'Return', 'Other'] },
    { value: 'wo_priority', label: 'Priority',   values: ['low', 'normal', 'high', 'critical'] },
    { value: 'location',    label: 'Location',   values: ['Zagreb HQ', 'Split office', 'Osijek office', 'Warehouse A', 'Warehouse B', 'Server Room'] },
    { value: 'department',  label: 'Department', values: ['IT', 'Finance', 'HR', 'Operations', 'Management', 'Legal'] },
  ],
  certificate: [
    { value: 'cert_type', label: 'Certificate Type', values: ['SSL/TLS', 'Code Signing', 'Client Auth', 'Device', 'Internal CA'] },
    { value: 'location',  label: 'Location',         values: ['Zagreb HQ', 'Split office', 'Server Room'] },
  ],
  maintenance: [
    { value: 'asset_type', label: 'Asset Type', values: ['Laptop', 'Desktop', 'Server', 'Printer', 'Network Switch', 'UPS'] },
    { value: 'location',   label: 'Location',   values: ['Zagreb HQ', 'Split office', 'Osijek office', 'Server Room'] },
  ],
  employee: [
    { value: 'department', label: 'Department', values: ['IT', 'Finance', 'HR', 'Operations', 'Management', 'Legal'] },
    { value: 'location',   label: 'Location',   values: ['Zagreb HQ', 'Split office', 'Osijek office'] },
  ],
  import: [
    { value: 'import_type',   label: 'Import Type', values: ['Assets', 'Employees', 'Supplies', 'Locations'] },
    { value: 'import_status', label: 'Result',      values: ['success', 'partial', 'failed'] },
  ],
};

interface ScopeFilter      { id: string; field: string; op: 'in' | 'not_in'; values: string[]; }
interface EntityCorrelation { inverumField: string; externalField: string; }
interface FieldMapping      { id: string; to: string; from: string; }
interface TriggerRule {
  id: string;
  enabled: boolean;
  name: string;
  event: string;
  scopeFilters: ScopeFilter[];
  entityCorrelation: EntityCorrelation | null;
  action: string;
  fieldMappings: FieldMapping[];
}

interface Integration {
  id: string;
  name: string;
  type: 'incoming' | 'outgoing';
  category: string;
  status: 'connected' | 'disabled';
  description: string;
  connFields: string[];
  actions: { value: string; label: string }[];
  inverumLinkFields: string[];
  externalLinkFields: string[];
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'zabbix', name: 'Zabbix', type: 'incoming', category: 'Monitoring', status: 'connected',
    description: 'Pull hardware status and alerts from Zabbix. Sync asset states based on host availability.',
    connFields: ['API URL', 'API Token', 'Host Group Filter'],
    actions: [
      { value: 'create_work_order',   label: 'Create work order' },
      { value: 'update_asset_status', label: 'Update asset status' },
      { value: 'update_asset_field',  label: 'Update asset field' },
    ],
    inverumLinkFields: ['asset.hostname', 'asset.ip_address', 'asset.serial_number', 'asset.inventory_number'],
    externalLinkFields: ['host.name', 'host.ip', 'host.dns', 'host.inventory.serialno_a'],
  },
  {
    id: 'sccm', name: 'SCCM / Intune', type: 'incoming', category: 'Endpoint Mgmt', status: 'disabled',
    description: 'Sync software inventory and device compliance from Microsoft Endpoint Manager.',
    connFields: ['Tenant ID', 'Client ID', 'Client Secret'],
    actions: [
      { value: 'sync_software_inventory', label: 'Sync software inventory' },
      { value: 'update_asset_field',      label: 'Update asset field' },
      { value: 'create_work_order',       label: 'Create work order' },
    ],
    inverumLinkFields: ['asset.hostname', 'asset.serial_number', 'asset.inventory_number'],
    externalLinkFields: ['device.deviceName', 'device.serialNumber', 'device.azureADDeviceId'],
  },
  {
    id: 'jira', name: 'Jira', type: 'outgoing', category: 'Ticketing', status: 'connected',
    description: 'Create and update Jira issues from work orders, asset events, and alerts.',
    connFields: ['Jira URL', 'API Token', 'Default Project Key'],
    actions: [
      { value: 'create_issue',     label: 'Create issue' },
      { value: 'add_comment',      label: 'Add comment to issue' },
      { value: 'transition_issue', label: 'Transition issue status' },
      { value: 'update_issue',     label: 'Update issue fields' },
    ],
    inverumLinkFields: ['asset.inventory_number', 'asset.serial_number', 'work_order.number', 'employee.email'],
    externalLinkFields: ['issue.cf_asset_tag', 'issue.cf_serial_number', 'issue.assignee.emailAddress', 'issue.labels'],
  },
  {
    id: 'slack', name: 'Slack', type: 'outgoing', category: 'Notifications', status: 'disabled',
    description: 'Send alerts, approval requests, and notifications to Slack channels.',
    connFields: ['Bot Token', 'Default Channel'],
    actions: [
      { value: 'send_message',      label: 'Send message' },
      { value: 'send_rich_message', label: 'Send rich block message' },
    ],
    inverumLinkFields: ['employee.slack_id', 'employee.email'],
    externalLinkFields: ['user.id', 'user.email', 'channel.name'],
  },
  {
    id: 'teams', name: 'Microsoft Teams', type: 'outgoing', category: 'Notifications', status: 'disabled',
    description: 'Send alerts and notifications to Teams channels via webhook.',
    connFields: ['Webhook URL'],
    actions: [
      { value: 'send_message',       label: 'Send message' },
      { value: 'send_adaptive_card', label: 'Send adaptive card' },
    ],
    inverumLinkFields: ['employee.email'],
    externalLinkFields: ['user.userPrincipalName'],
  },
];

const DEFAULT_TRIGGERS: Record<string, TriggerRule[]> = {
  jira: [
    {
      id: 't1', enabled: true, name: 'Work order created → Jira issue', event: 'work_order.created',
      scopeFilters: [], entityCorrelation: { inverumField: 'asset.inventory_number', externalField: 'issue.cf_asset_tag' },
      action: 'create_issue',
      fieldMappings: [{ id: 'm1', from: '{{work_order.title}}', to: 'summary' }, { id: 'm2', from: '{{work_order.description}}', to: 'description' }],
    },
    {
      id: 't2', enabled: true, name: 'Server decommissioned → Jira issue', event: 'asset.decommissioned',
      scopeFilters: [{ id: 'f1', field: 'asset_type', op: 'in', values: ['Server'] }],
      entityCorrelation: { inverumField: 'asset.inventory_number', externalField: 'issue.cf_asset_tag' },
      action: 'create_issue',
      fieldMappings: [{ id: 'm4', from: '{{asset.name}} decommissioned', to: 'summary' }, { id: 'm5', from: '{{reason}}', to: 'description' }],
    },
    {
      id: 't3', enabled: false, name: 'Work order completed → transition issue', event: 'work_order.completed',
      scopeFilters: [], entityCorrelation: null,
      action: 'transition_issue', fieldMappings: [],
    },
  ],
  zabbix: [
    {
      id: 't4', enabled: true, name: 'Zabbix problem → work order (servers only)', event: 'asset.status_changed',
      scopeFilters: [{ id: 'f2', field: 'asset_type', op: 'in', values: ['Server', 'Network Switch'] }],
      entityCorrelation: { inverumField: 'asset.hostname', externalField: 'host.name' },
      action: 'create_work_order',
      fieldMappings: [{ id: 'm6', from: '{{zabbix.problem.name}}', to: 'work_order.title' }, { id: 'm7', from: '{{zabbix.problem.severity}}', to: 'work_order.priority' }],
    },
  ],
};

function TriggerEditor({ rule, integration, onSave, onCancel }: {
  rule: Partial<TriggerRule>;
  integration: Integration;
  onSave: (r: TriggerRule) => void;
  onCancel: () => void;
}) {
  const [name,    setName]    = useState(rule.name    ?? '');
  const [event,   setEvent]   = useState(rule.event   ?? EVENTS[0].value);
  const [action,  setAction]  = useState(rule.action  ?? integration.actions[0].value);
  const [scopeFilters, setScopeFilters] = useState<ScopeFilter[]>(rule.scopeFilters ?? []);
  const [correlation,  setCorrelation]  = useState<EntityCorrelation | null>(rule.entityCorrelation ?? null);
  const [mappings,     setMappings]     = useState<FieldMapping[]>(rule.fieldMappings ?? []);
  const [useCorrelation, setUseCorrelation] = useState(rule.entityCorrelation != null);
  const [customInverumField,  setCustomInverumField]  = useState('');
  const [customExternalField, setCustomExternalField] = useState('');

  const domain = getEventDomain(event);
  const domainFields = SCOPE_FIELDS_BY_DOMAIN[domain] ?? [];

  const changeEvent = (newEvent: string) => {
    const newDomain = getEventDomain(newEvent);
    if (newDomain !== domain) setScopeFilters([]);
    setEvent(newEvent);
  };

  const addFilter    = () => setScopeFilters(f => [...f, { id: Date.now().toString(), field: domainFields[0]?.value ?? 'asset_type', op: 'in', values: [] }]);
  const removeFilter = (id: string) => setScopeFilters(f => f.filter(x => x.id !== id));
  const updateFilter = (id: string, key: keyof ScopeFilter, val: unknown) =>
    setScopeFilters(f => f.map(x => x.id === id ? { ...x, [key]: val } : x));
  const addFilterValue = (id: string, val: string) => {
    if (!val) return;
    setScopeFilters(f => f.map(x => x.id === id && !x.values.includes(val) ? { ...x, values: [...x.values, val] } : x));
  };
  const removeFilterValue = (id: string, val: string) =>
    setScopeFilters(f => f.map(x => x.id === id ? { ...x, values: x.values.filter(v => v !== val) } : x));

  const addMapping    = () => setMappings(m => [...m, { id: Date.now().toString(), to: '', from: '' }]);
  const removeMapping = (id: string) => setMappings(m => m.filter(x => x.id !== id));
  const updateMapping = (id: string, key: 'from' | 'to', val: string) =>
    setMappings(m => m.map(x => x.id === id ? { ...x, [key]: val } : x));

  const effectiveInverumField  = correlation?.inverumField  === '__custom__' ? customInverumField  : (correlation?.inverumField  ?? integration.inverumLinkFields[0]);
  const effectiveExternalField = correlation?.externalField === '__custom__' ? customExternalField : (correlation?.externalField ?? integration.externalLinkFields[0]);

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: rule.id ?? Date.now().toString(),
      enabled: rule.enabled ?? true,
      name: name.trim(), event, action, scopeFilters,
      entityCorrelation: useCorrelation
        ? { inverumField: effectiveInverumField, externalField: effectiveExternalField }
        : null,
      fieldMappings: mappings,
    });
  };

  return (
    <div className="border border-theme-border rounded-lg overflow-hidden bg-theme-surface">
      <div className="px-4 pt-4 pb-3 border-b border-theme-border flex items-end gap-3">
        <div className="flex-1">
          <label className="text-theme-xs text-theme-text-muted block mb-1">Name</label>
          <Input value={name} onChange={setName} placeholder="e.g. Servers below min stock → Slack" className="w-full" />
        </div>
        <div className="w-72 shrink-0">
          <label className="text-theme-xs text-theme-text-muted block mb-1">Event</label>
          <select value={event} onChange={(e) => changeEvent(e.target.value)}
            className="w-full px-2 py-1.5 text-theme-sm bg-theme-bg border border-theme-border rounded text-theme-text focus:outline-none focus:ring-1 focus:ring-theme-primary">
            {(() => {
              const groups = [...new Set(EVENTS.map(e => e.group))];
              return groups.map(g => (
                <optgroup key={g} label={g}>
                  {EVENTS.filter(e => e.group === g).map(e => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </optgroup>
              ));
            })()}
          </select>
        </div>
      </div>

      <div className="px-4 pt-3 pb-3 border-b border-theme-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-theme-xs font-medium text-theme-text-muted flex items-center gap-1.5">
            <Filter size={11} /> Scope <span className="text-theme-text-subtle font-normal">— which {domain.replace('_', ' ')}s trigger this (empty = all)</span>
          </span>
          {domainFields.length > 0 && (
            <button onClick={addFilter} className="flex items-center gap-1 text-theme-xs text-theme-primary hover:text-theme-primary-hover transition-colors">
              <Plus size={11} /> Add filter
            </button>
          )}
        </div>
        {domainFields.length === 0 ? (
          <p className="text-theme-xs text-theme-text-subtle italic">No scope filters available for this event type.</p>
        ) : scopeFilters.length === 0 ? (
          <p className="text-theme-xs text-theme-text-subtle italic">No scope — fires for all {domain.replace('_', ' ')}s. Add a filter to narrow it down.</p>
        ) : (
          <div className="space-y-2">
            {scopeFilters.map((f) => {
              const fieldDef = domainFields.find(x => x.value === f.field);
              const available = (fieldDef?.values ?? []).filter(v => !f.values.includes(v));
              return (
                <div key={f.id} className="flex items-start gap-2">
                  <select value={f.field}
                    onChange={(e) => updateFilter(f.id, 'field', e.target.value)}
                    className="px-2 py-1.5 text-theme-xs bg-theme-bg border border-theme-border rounded text-theme-text focus:outline-none focus:ring-1 focus:ring-theme-primary">
                    {domainFields.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </select>
                  <select value={f.op}
                    onChange={(e) => updateFilter(f.id, 'op', e.target.value as 'in' | 'not_in')}
                    className="px-2 py-1.5 text-theme-xs bg-theme-bg border border-theme-border rounded text-theme-text focus:outline-none focus:ring-1 focus:ring-theme-primary w-20">
                    <option value="in">is</option>
                    <option value="not_in">is not</option>
                  </select>
                  <div className="flex flex-wrap items-center gap-1 flex-1 min-h-[30px] px-2 py-1 bg-theme-bg border border-theme-border rounded">
                    {f.values.map(v => (
                      <span key={v} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-theme-primary/10 text-theme-primary rounded text-[11px]">
                        {v}
                        <button onClick={() => removeFilterValue(f.id, v)} className="hover:text-theme-danger transition-colors"><X size={9} /></button>
                      </span>
                    ))}
                    {available.length > 0 && (
                      <select onChange={(e) => { addFilterValue(f.id, e.target.value); e.target.value = ''; }} defaultValue=""
                        className="text-[11px] text-theme-text-muted bg-transparent outline-none cursor-pointer">
                        <option value="" disabled>+ add</option>
                        {available.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    )}
                  </div>
                  <button onClick={() => removeFilter(f.id)} className="p-1.5 text-theme-text-subtle hover:text-theme-danger transition-colors mt-0.5"><X size={13} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 pt-3 pb-3 border-b border-theme-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-theme-xs font-medium text-theme-text-muted flex items-center gap-1.5">
            <Shuffle size={11} /> Entity match <span className="text-theme-text-subtle font-normal">— find the record in {integration.name} by field</span>
          </span>
          <button onClick={() => setUseCorrelation(v => !v)} className={`text-theme-xs transition-colors ${useCorrelation ? 'text-theme-text-subtle hover:text-theme-danger' : 'text-theme-primary hover:text-theme-primary-hover'}`}>
            {useCorrelation ? 'Remove' : 'Configure'}
          </button>
        </div>
        {useCorrelation ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-theme-xs text-theme-text-muted w-14 shrink-0">Inverum</span>
              <select
                value={correlation?.inverumField ?? integration.inverumLinkFields[0]}
                onChange={(e) => setCorrelation(c => ({ inverumField: e.target.value, externalField: c?.externalField ?? integration.externalLinkFields[0] }))}
                className="px-2 py-1.5 text-theme-xs bg-theme-bg border border-theme-border rounded font-mono text-theme-text focus:outline-none focus:ring-1 focus:ring-theme-primary">
                {integration.inverumLinkFields.map(f => <option key={f} value={f}>{f}</option>)}
                <option value="__custom__">Custom field…</option>
              </select>
              {correlation?.inverumField === '__custom__' && (
                <Input value={customInverumField} onChange={setCustomInverumField}
                  placeholder="e.g. asset.zabbix_hostname" className="w-48 font-mono text-theme-xs" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-theme-xs text-theme-text-muted w-14 shrink-0">{integration.name}</span>
              <select
                value={correlation?.externalField ?? integration.externalLinkFields[0]}
                onChange={(e) => setCorrelation(c => ({ inverumField: c?.inverumField ?? integration.inverumLinkFields[0], externalField: e.target.value }))}
                className="px-2 py-1.5 text-theme-xs bg-theme-bg border border-theme-border rounded font-mono text-theme-text focus:outline-none focus:ring-1 focus:ring-theme-primary">
                {integration.externalLinkFields.map(f => <option key={f} value={f}>{f}</option>)}
                <option value="__custom__">Custom field…</option>
              </select>
              {correlation?.externalField === '__custom__' && (
                <Input value={customExternalField} onChange={setCustomExternalField}
                  placeholder="e.g. host.inventory.alias" className="w-48 font-mono text-theme-xs" />
              )}
            </div>
            <p className="text-theme-xs text-theme-text-subtle">Values must match exactly. Used to look up the record in {integration.name} before applying the action.</p>
          </div>
        ) : (
          <p className="text-theme-xs text-theme-text-subtle italic">No entity matching — action fires on the event payload without looking up a record in {integration.name}.</p>
        )}
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-theme-xs font-medium text-theme-text-muted flex items-center gap-1.5">
            <Zap size={11} /> Action
          </span>
        </div>
        <div className="mb-3">
          <label className="text-theme-xs text-theme-text-muted block mb-1">Action</label>
          <select value={action} onChange={(e) => setAction(e.target.value)}
            className="px-2 py-1.5 text-theme-sm bg-theme-bg border border-theme-border rounded text-theme-text focus:outline-none focus:ring-1 focus:ring-theme-primary">
            {integration.actions.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-theme-xs font-medium text-theme-text-muted flex items-center gap-1.5"><ArrowRight size={11} /> Field mappings <span className="text-theme-text-subtle font-normal">Inverum → {integration.name}</span></span>
            <button onClick={addMapping} className="flex items-center gap-1 text-theme-xs text-theme-primary hover:text-theme-primary-hover transition-colors"><Plus size={11} /> Add</button>
          </div>
          {mappings.length === 0 ? (
            <p className="text-theme-xs text-theme-text-subtle italic">No field mappings — use action defaults.</p>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center mb-1">
                <span className="text-theme-xs text-theme-text-subtle">Inverum value / template</span>
                <span />
                <span className="text-theme-xs text-theme-text-subtle">{integration.name} field</span>
                <span />
              </div>
              {mappings.map((m) => (
                <div key={m.id} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
                  <Input value={m.from} onChange={(v) => updateMapping(m.id, 'from', v)} placeholder="{{asset.hostname}}" className="font-mono text-theme-xs w-full" />
                  <ArrowRight size={13} className="text-theme-text-subtle shrink-0" />
                  <Input value={m.to} onChange={(v) => updateMapping(m.id, 'to', v)} placeholder="target.field" className="font-mono text-theme-xs w-full" />
                  <button onClick={() => removeMapping(m.id)} className="p-1 text-theme-text-subtle hover:text-theme-danger transition-colors"><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
          <p className="text-theme-xs text-theme-text-subtle mt-2">
            Template syntax: <code className="bg-theme-bg px-1 rounded border border-theme-border font-mono">{'{{'}<span>asset.hostname</span>{'}}'}</code>{' '}
            <code className="bg-theme-bg px-1 rounded border border-theme-border font-mono">{'{{'}<span>work_order.title</span>{'}}'}</code>{' '}
            <code className="bg-theme-bg px-1 rounded border border-theme-border font-mono">{'{{'}<span>reason</span>{'}}'}</code>
          </p>
        </div>

        <div className="flex gap-2 pt-3 mt-3 border-t border-theme-border">
          <button onClick={save} className="px-4 py-1.5 text-theme-xs bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded transition-colors">Save trigger</button>
          <button onClick={onCancel} className="px-4 py-1.5 text-theme-xs text-theme-text-muted hover:text-theme-text transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function TriggersPanel({ integration }: { integration: Integration }) {
  const [triggers, setTriggers] = useState<TriggerRule[]>(DEFAULT_TRIGGERS[integration.id] ?? []);
  const [editing, setEditing] = useState<string | null>(null);

  const toggleEnabled = (id: string) => setTriggers(ts => ts.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
  const deleteRule    = (id: string) => setTriggers(ts => ts.filter(t => t.id !== id));
  const saveRule      = (rule: TriggerRule) => {
    setTriggers(ts => editing === 'new' ? [...ts, rule] : ts.map(t => t.id === rule.id ? rule : t));
    setEditing(null);
  };

  const eventLabel = (val: string) => EVENTS.find(e => e.value === val)?.label ?? val;

  return (
    <div className="space-y-3">
      {triggers.length === 0 && editing !== 'new' && (
        <div className="py-10 text-center">
          <Webhook size={28} className="text-theme-text-subtle mx-auto mb-3" />
          <p className="text-theme-sm text-theme-text-muted mb-1">No triggers configured</p>
          <p className="text-theme-xs text-theme-text-subtle">Add a trigger to define what events fire this integration and how fields are mapped.</p>
        </div>
      )}

      {triggers.map((t) => (
        <div key={t.id}>
          {editing === t.id ? (
            <TriggerEditor rule={t} integration={integration} onSave={saveRule} onCancel={() => setEditing(null)} />
          ) : (
            <div className={`border rounded-lg transition-colors ${t.enabled ? 'border-theme-border bg-theme-surface' : 'border-theme-border bg-theme-bg'}`}>
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5"><Toggle value={t.enabled} onChange={() => toggleEnabled(t.id)} /></div>
                  <div className={`min-w-0 ${!t.enabled ? 'opacity-50' : ''}`}>
                    <p className="text-theme-sm font-medium text-theme-text">{t.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-theme-xs text-theme-text-muted">
                        <Activity size={10} /> {eventLabel(t.event)}
                      </span>
                      {t.scopeFilters.length > 0 && (
                        <>
                          <span className="text-theme-text-subtle">·</span>
                          {t.scopeFilters.map(f => {
                            const allDomainFields = Object.values(SCOPE_FIELDS_BY_DOMAIN).flat();
                            const fDef = allDomainFields.find(x => x.value === f.field);
                            return (
                              <span key={f.id} className="flex items-center gap-1 text-theme-xs">
                                <Filter size={9} className="text-theme-text-subtle" />
                                <span className="text-theme-text-muted">{fDef?.label ?? f.field}</span>
                                <span className="text-theme-text-subtle">{f.op === 'in' ? '=' : '≠'}</span>
                                <span className="text-theme-primary">{f.values.join(', ')}</span>
                              </span>
                            );
                          })}
                        </>
                      )}
                      {t.entityCorrelation && (
                        <>
                          <span className="text-theme-text-subtle">·</span>
                          <span className="text-theme-xs text-theme-text-subtle flex items-center gap-1">
                            <span className="font-mono">{t.entityCorrelation.inverumField}</span>
                            <span>↔</span>
                            <span className="font-mono">{t.entityCorrelation.externalField}</span>
                          </span>
                        </>
                      )}
                      <span className="text-theme-text-subtle">→</span>
                      <span className="text-theme-xs text-theme-primary">
                        {integration.actions.find(a => a.value === t.action)?.label ?? t.action}
                      </span>
                      {t.fieldMappings.length > 0 && (
                        <span className="text-theme-xs text-theme-text-subtle">({t.fieldMappings.length} mapping{t.fieldMappings.length > 1 ? 's' : ''})</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditing(t.id)} className="p-1.5 text-theme-text-subtle hover:text-theme-text transition-colors"><Edit2 size={13} /></button>
                  <button onClick={() => deleteRule(t.id)} className="p-1.5 text-theme-text-subtle hover:text-theme-danger transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {editing === 'new'
        ? <TriggerEditor rule={{}} integration={integration} onSave={saveRule} onCancel={() => setEditing(null)} />
        : (
          <button onClick={() => setEditing('new')} className="flex items-center gap-2 text-theme-sm text-theme-primary hover:text-theme-primary-hover transition-colors mt-1">
            <Plus size={14} /> New trigger
          </button>
        )
      }
    </div>
  );
}

function EventLogPanel({ integrationId: _integrationId }: { integrationId: string }) {
  const logs = [
    { id: '1', ts: '2026-04-12 08:14:02', event: 'work_order.created',   trigger: 'Work order created → Jira issue', status: 'success', duration: '241ms', response: '201 Created — JIRA-1042' },
    { id: '2', ts: '2026-04-12 07:55:18', event: 'asset.decommissioned', trigger: 'Server decommissioned → Jira issue', status: 'success', duration: '189ms', response: '201 Created — JIRA-1041' },
    { id: '3', ts: '2026-04-11 16:33:44', event: 'work_order.created',   trigger: 'Work order created → Jira issue', status: 'error',   duration: '5012ms', response: '500 Internal Server Error' },
    { id: '4', ts: '2026-04-11 14:12:09', event: 'work_order.created',   trigger: 'Work order created → Jira issue', status: 'success', duration: '203ms', response: '201 Created — JIRA-1040' },
    { id: '5', ts: '2026-04-11 09:01:55', event: 'asset.decommissioned', trigger: 'Server decommissioned → Jira issue', status: 'success', duration: '198ms', response: '201 Created — JIRA-1039' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-theme-xs text-theme-text-subtle">Last 50 events</p>
        <button className="flex items-center gap-1.5 text-theme-xs text-theme-text-muted hover:text-theme-text transition-colors">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      <div className="border border-theme-border rounded-lg overflow-hidden">
        <table className="w-full text-theme-sm">
          <thead>
            <tr className="border-b border-theme-border bg-theme-bg">
              <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Timestamp</th>
              <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Trigger</th>
              <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Status</th>
              <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Response</th>
              <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Duration</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-theme-border last:border-0 hover:bg-theme-surface-hover">
                <td className="px-4 py-2.5 font-mono text-theme-xs text-theme-text-subtle whitespace-nowrap">{l.ts}</td>
                <td className="px-4 py-2.5 text-theme-xs text-theme-text max-w-[220px] truncate">{l.trigger}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1 text-theme-xs font-medium ${l.status === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {l.status === 'success' ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-theme-xs text-theme-text-muted max-w-[180px] truncate">{l.response}</td>
                <td className="px-4 py-2.5 text-theme-xs text-theme-text-subtle">{l.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConnectionPanel({ integration }: { integration: Integration }) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const get = (f: string) => fields[f] ?? '';
  const set = (f: string, v: string) => setFields(p => ({ ...p, [f]: v }));

  return (
    <div className="space-y-3 max-w-lg">
      {integration.connFields.map((f) => (
        <div key={f} className="flex items-center gap-3">
          <label className="text-theme-xs text-theme-text-muted w-36 shrink-0">{f}</label>
          <Input value={get(f)} onChange={(v) => set(f, v)} placeholder={`Enter ${f.toLowerCase()}`} className="flex-1" />
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <button className="px-3 py-1.5 text-theme-xs bg-theme-bg hover:bg-theme-surface-hover text-theme-text rounded border border-theme-border transition-colors">
          Test Connection
        </button>
        <button className="px-3 py-1.5 text-theme-xs bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded transition-colors">
          Save
        </button>
      </div>
    </div>
  );
}

function IntegrationDetail({ integration, onBack }: { integration: Integration; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'connection' | 'triggers' | 'log'>('connection');
  const [enabled, setEnabled] = useState(integration.status === 'connected');

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-theme-xs text-theme-text-subtle hover:text-theme-text mb-2 transition-colors">
            <ChevronRight size={12} className="rotate-180" /> Back to Integrations
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-theme-bg rounded-lg border border-theme-border flex items-center justify-center text-theme-sm font-bold text-theme-text-muted">
              {integration.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-theme-lg font-semibold text-theme-text">{integration.name}</h2>
                <Badge color={enabled ? 'green' : 'slate'}>{enabled ? <><CheckCircle2 size={10} /> Connected</> : 'Disabled'}</Badge>
                <Badge color={integration.type === 'incoming' ? 'blue' : 'slate'}>{integration.type}</Badge>
              </div>
              <p className="text-theme-xs text-theme-text-muted mt-0.5">{integration.description}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-theme-xs text-theme-text-subtle">Enabled</span>
          <Toggle value={enabled} onChange={setEnabled} />
        </div>
      </div>

      <div className="flex border-b border-theme-border mb-6">
        {([
          { id: 'connection', label: 'Connection',  icon: <Server size={13} /> },
          { id: 'triggers',   label: 'Triggers',    icon: <Webhook size={13} /> },
          { id: 'log',        label: 'Event Log',   icon: <Activity size={13} /> },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-theme-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === t.id ? 'border-theme-primary text-theme-primary' : 'border-transparent text-theme-text-subtle hover:text-theme-text'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'connection' && <ConnectionPanel integration={integration} />}
      {activeTab === 'triggers'   && <TriggersPanel integration={integration} />}
      {activeTab === 'log'        && <EventLogPanel integrationId={integration.id} />}
    </div>
  );
}

interface ApiExternalService {
  id: string;
  name: string;
  service_type: string;
  is_active: boolean;
}

export function IntegrationsTab() {
  const { data: extServices } = useApiQuery<PagedResponse<ApiExternalService> | ApiExternalService[]>('/external-services/?limit=50');
  const [selected, setSelected] = useState<Integration | null>(null);

  const items = useCallback((): Integration[] => {
    const apiList = Array.isArray(extServices) ? extServices : extServices?.items;
    if (!apiList || apiList.length === 0) return INTEGRATIONS;
    return INTEGRATIONS.map(item => {
      const match = apiList.find(s => s.service_type.toLowerCase() === item.id || s.name.toLowerCase() === item.name.toLowerCase());
      return match ? { ...item, status: match.is_active ? 'connected' : 'disabled' } : item;
    });
  }, [extServices])();

  if (selected) {
    return <IntegrationDetail integration={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="max-w-3xl">
      <SectionHeader title="Integrations" description="Incoming data feeds and outgoing notifications/events" />
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between p-4 border border-theme-border rounded-lg hover:border-theme-border-strong transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 bg-theme-bg rounded-lg border border-theme-border flex items-center justify-center text-theme-xs font-bold text-theme-text-muted">
                {i.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-theme-sm font-medium text-theme-text">{i.name}</span>
                  <Badge color={i.type === 'incoming' ? 'blue' : 'slate'}>{i.type}</Badge>
                  <span className="text-theme-xs text-theme-text-subtle">{i.category}</span>
                  {DEFAULT_TRIGGERS[i.id]?.length > 0 && (
                    <span className="flex items-center gap-1 text-theme-xs text-theme-text-subtle">
                      <Webhook size={10} /> {DEFAULT_TRIGGERS[i.id].length} trigger{DEFAULT_TRIGGERS[i.id].length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-theme-xs text-theme-text-muted mt-0.5">{i.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge color={i.status === 'connected' ? 'green' : 'slate'}>
                {i.status === 'connected' ? <><CheckCircle2 size={10} /> Connected</> : 'Disabled'}
              </Badge>
              <button onClick={() => setSelected(i)} className="px-3 py-1.5 text-theme-xs text-theme-text-muted hover:text-theme-text border border-theme-border hover:border-theme-border-strong rounded transition-colors flex items-center gap-1">
                Configure <ChevronRight size={11} />
              </button>
            </div>
          </div>
        ))}
        <button className="flex items-center gap-2 text-theme-sm text-theme-primary hover:text-theme-primary-hover mt-4 transition-colors">
          <Plus size={14} /> Add integration
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permissions Tab — wired to /roles/
// ---------------------------------------------------------------------------

interface Role { id: string; name: string; users: number; description: string; system: boolean; }

const PERM_GROUPS: { group: string; perms: { id: string; label: string }[] }[] = [
  { group: 'Assets', perms: [
    { id: 'asset:read',         label: 'View assets' },
    { id: 'asset:write',        label: 'Create & edit assets' },
    { id: 'asset:delete',       label: 'Delete assets' },
    { id: 'asset:decommission', label: 'Decommission assets' },
    { id: 'asset:costs:read',   label: 'View asset costs' },
    { id: 'asset:import',       label: 'Import assets (CSV)' },
  ]},
  { group: 'Locations', perms: [
    { id: 'location:read',   label: 'View locations' },
    { id: 'location:write',  label: 'Create & edit locations' },
    { id: 'location:delete', label: 'Delete locations' },
  ]},
  { group: 'Employees', perms: [
    { id: 'employee:read',   label: 'View employees' },
    { id: 'employee:write',  label: 'Create & edit employees' },
    { id: 'employee:delete', label: 'Delete employees' },
  ]},
  { group: 'Supplies', perms: [
    { id: 'supply:read',      label: 'View supplies & stock' },
    { id: 'supply:write',     label: 'Create & edit supplies' },
    { id: 'supply:movements', label: 'Record stock movements' },
    { id: 'supply:delete',    label: 'Delete supplies' },
  ]},
  { group: 'Work Orders', perms: [
    { id: 'wo:read',   label: 'View work orders' },
    { id: 'wo:write',  label: 'Create & edit work orders' },
    { id: 'wo:close',  label: 'Close / resolve work orders' },
    { id: 'wo:delete', label: 'Delete work orders' },
  ]},
  { group: 'Storage', perms: [
    { id: 'storage:read',  label: 'View storage units & boxes' },
    { id: 'storage:write', label: 'Create & edit storage / boxes' },
  ]},
  { group: 'Certificates', perms: [
    { id: 'certificate:read',  label: 'View certificates' },
    { id: 'certificate:write', label: 'Create & edit certificates' },
  ]},
  { group: 'Reports', perms: [
    { id: 'report:read', label: 'View reports' },
    { id: 'report:run',  label: 'Run & export reports' },
  ]},
  { group: 'Users & Settings', perms: [
    { id: 'user:read',       label: 'View users' },
    { id: 'user:invite',     label: 'Invite users' },
    { id: 'user:deactivate', label: 'Deactivate users' },
    { id: 'settings:read',   label: 'View settings' },
    { id: 'settings:write',  label: 'Edit settings' },
    { id: 'audit:read',      label: 'View audit log' },
  ]},
];

const ALL_PERMS = PERM_GROUPS.flatMap(g => g.perms.map(p => p.id));

const ROLE_PERMS: Record<string, Set<string>> = {
  '1': new Set(ALL_PERMS),
  '2': new Set([
    'asset:read','asset:write','asset:delete','asset:decommission','asset:costs:read','asset:import',
    'location:read','location:write','employee:read','employee:write',
    'supply:read','supply:write','supply:movements',
    'wo:read','wo:write','wo:close',
    'storage:read','storage:write','certificate:read','certificate:write',
    'report:read','report:run','user:read','settings:read','audit:read',
  ]),
  '3': new Set([
    'asset:read','location:read','employee:read','supply:read','wo:read',
    'storage:read','certificate:read','report:read',
  ]),
  '4': new Set([
    'asset:read','asset:write','asset:decommission',
    'location:read','employee:read',
    'wo:read','wo:write','wo:close',
    'supply:read','supply:movements',
    'storage:read','certificate:read','report:read',
  ]),
  '5': new Set([
    'asset:read','location:read',
    'supply:read','supply:write','supply:movements',
    'storage:read','storage:write',
    'wo:read',
  ]),
};

interface ApiRole {
  id: string;
  name: string;
  description?: string | null;
  permissions?: string[];
  is_system?: boolean;
}

export function PermissionsTab() {
  const { data: apiRolesData } = useApiQuery<PagedResponse<ApiRole> | ApiRole[]>('/roles/?limit=50');
  const [roles, setRoles] = useState<Role[]>([
    { id: '1', name: 'Super Admin',   users: 2,  description: 'Full access to all tenant resources',        system: true },
    { id: '2', name: 'Asset Manager', users: 8,  description: 'CRUD on assets, locations, employees',       system: true },
    { id: '3', name: 'Viewer',        users: 34, description: 'Read-only access to assets and locations',   system: true },
    { id: '4', name: 'IT Technician', users: 12, description: 'Asset write + work order management',        system: false },
    { id: '5', name: 'Warehouse',     users: 5,  description: 'Storage, boxes, supply movements only',      system: false },
  ]);
  const [rolePerms, setRolePerms] = useState<Record<string, Set<string>>>(ROLE_PERMS);
  const [selectedId, setSelectedId] = useState('4');
  const [addingRole, setAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [editingDesc, setEditingDesc] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    const list = Array.isArray(apiRolesData) ? apiRolesData : apiRolesData?.items;
    if (!list || list.length === 0) return;
    setRoles(list.map(r => ({
      id: r.id,
      name: r.name,
      users: 1,
      description: r.description ?? '',
      system: r.is_system ?? false,
    })));
    const permsMap: Record<string, Set<string>> = {};
    for (const r of list) {
      permsMap[r.id] = new Set(r.permissions ?? []);
    }
    setRolePerms(permsMap);
    setSelectedId(list[0].id);
  }, [apiRolesData]);

  const role = roles.find(r => r.id === selectedId);
  const perms = rolePerms[selectedId] ?? new Set<string>();

  const togglePerm = (permId: string) => {
    if (role?.system) return;
    setRolePerms(prev => {
      const next = new Set(prev[selectedId] ?? []);
      if (next.has(permId)) next.delete(permId); else next.add(permId);
      return { ...prev, [selectedId]: next };
    });
  };

  const addRole = () => {
    if (!newRoleName.trim()) return;
    const id = Date.now().toString();
    setRoles(rs => [...rs, { id, name: newRoleName.trim(), description: newRoleDesc.trim(), users: 0, system: false }]);
    setRolePerms(prev => ({ ...prev, [id]: new Set() }));
    setSelectedId(id);
    setNewRoleName(''); setNewRoleDesc(''); setAddingRole(false);
  };

  const removeRole = (id: string) => {
    setRoles(rs => rs.filter(r => r.id !== id));
    setRolePerms(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (selectedId === id) setSelectedId(roles.find(r => r.id !== id)?.id ?? '');
  };

  const saveDesc = (id: string) => {
    setRoles(rs => rs.map(r => r.id === id ? { ...r, description: editDesc } : r));
    setEditingDesc(null);
  };

  const grantedCount = perms.size;
  const totalCount = ALL_PERMS.length;

  return (
    <div className="flex min-h-full">
      <div className="w-56 shrink-0 border-r border-theme-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border">
          <p className="text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider">Roles</p>
          <button onClick={() => setAddingRole(true)} className="p-0.5 text-theme-text-subtle hover:text-theme-primary transition-colors"><Plus size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {roles.map((r) => (
            <div key={r.id} className={`group/role flex items-center transition-colors ${selectedId === r.id ? 'bg-theme-surface-hover' : 'hover:bg-theme-surface-hover'}`}>
              <button onClick={() => setSelectedId(r.id)} className="flex-1 text-left px-4 py-2.5">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-theme-sm font-medium truncate ${selectedId === r.id ? 'text-theme-text' : 'text-theme-text-muted'}`}>{r.name}</span>
                  {r.system && <Lock size={10} className="text-theme-text-subtle shrink-0" />}
                </div>
                <p className="text-theme-xs text-theme-text-subtle mt-0.5">{r.users} users</p>
              </button>
              {!r.system && (
                <button onClick={() => removeRole(r.id)} className="p-1.5 mr-2 text-theme-text-subtle hover:text-theme-danger transition-colors opacity-0 group-hover/role:opacity-100 shrink-0">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
          {addingRole && (
            <div className="mx-3 my-2 p-3 border border-theme-border rounded-lg space-y-2 bg-theme-bg">
              <Input value={newRoleName} onChange={setNewRoleName} placeholder="Role name" className="w-full"
                onKeyDown={(e) => { if (e.key === 'Escape') { setAddingRole(false); setNewRoleName(''); setNewRoleDesc(''); } }} />
              <Input value={newRoleDesc} onChange={setNewRoleDesc} placeholder="Description" className="w-full"
                onKeyDown={(e) => { if (e.key === 'Enter') addRole(); if (e.key === 'Escape') { setAddingRole(false); setNewRoleName(''); setNewRoleDesc(''); } }} />
              <div className="flex gap-2">
                <button onClick={addRole} className="px-3 py-1 text-theme-xs bg-theme-primary text-theme-primary-fg rounded transition-colors">Add</button>
                <button onClick={() => { setAddingRole(false); setNewRoleName(''); setNewRoleDesc(''); }} className="px-2 py-1 text-theme-xs text-theme-text-muted hover:text-theme-text transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-8 py-6 overflow-auto">
        {role && (
          <>
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-theme-base font-semibold text-theme-text">{role.name}</h3>
                  {role.system
                    ? <Badge color="slate">system</Badge>
                    : <span className="text-theme-xs text-theme-text-subtle">{grantedCount} / {totalCount} permissions</span>
                  }
                </div>
                {editingDesc === role.id ? (
                  <div className="flex items-center gap-2">
                    <Input value={editDesc} onChange={setEditDesc} className="w-80"
                      onKeyDown={(e) => { if (e.key === 'Enter') saveDesc(role.id); if (e.key === 'Escape') setEditingDesc(null); }} />
                    <button onClick={() => saveDesc(role.id)} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                    <button onClick={() => setEditingDesc(null)} className="p-1 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group/desc">
                    <p className="text-theme-sm text-theme-text-muted">{role.description || <span className="italic text-theme-text-subtle">No description</span>}</p>
                    {!role.system && (
                      <button onClick={() => { setEditingDesc(role.id); setEditDesc(role.description); }}
                        className="p-0.5 text-theme-text-subtle hover:text-theme-text opacity-0 group-hover/desc:opacity-100 transition-opacity">
                        <Edit2 size={11} />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {role.system && (
                <div className="flex items-center gap-1.5 text-theme-xs text-theme-text-subtle bg-theme-bg border border-theme-border rounded px-2 py-1 shrink-0">
                  <Lock size={11} /> Read-only
                </div>
              )}
            </div>

            <div className="space-y-5">
              {PERM_GROUPS.map(({ group, perms: groupPerms }) => (
                <div key={group}>
                  <p className="text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider mb-2">{group}</p>
                  <div className="border border-theme-border rounded-lg overflow-hidden">
                    {groupPerms.map((p, i) => {
                      const granted = perms.has(p.id);
                      const locked = role.system;
                      return (
                        <label key={p.id}
                          className={`flex items-center gap-3 px-4 py-2.5 ${i < groupPerms.length - 1 ? 'border-b border-theme-border' : ''} ${!locked ? 'cursor-pointer hover:bg-theme-surface-hover' : ''} transition-colors`}>
                          <input type="checkbox" checked={granted} onChange={() => togglePerm(p.id)} disabled={locked}
                            className="accent-[var(--t-primary)] w-3.5 h-3.5 shrink-0" />
                          <span className={`text-theme-sm flex-1 ${granted ? 'text-theme-text' : 'text-theme-text-muted'}`}>{p.label}</span>
                          <span className="text-theme-xs font-mono text-theme-text-subtle">{p.id}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users Tab — wired to /users/
// ---------------------------------------------------------------------------

interface OrgUser { id: string; name: string; email: string; role: string; roleSource: 'manual' | 'ldap' | 'saml'; status: 'active' | 'invited' | 'deactivated'; lastLogin: string; }

interface ApiUserItem {
  id: string;
  username: string;
  email: string;
  full_name?: string | null;
  role?: string | null;
  is_active: boolean;
  last_login_at?: string | null;
}

export function UsersTab() {
  const { isOrg } = useContext(SettingsContext);
  const { data: apiUsersData } = useApiQuery<PagedResponse<ApiUserItem> | ApiUserItem[]>('/users/?limit=100');
  const [users, setUsers] = useState<OrgUser[]>([
    { id: '1', name: 'Ivan Horvat',        email: 'ivan.horvat@posta.hr',        role: 'Super Admin',   roleSource: 'manual', status: 'active',      lastLogin: '2026-04-12 09:14' },
    { id: '2', name: 'Maja Kovač',         email: 'maja.kovac@posta.hr',         role: 'Asset Manager', roleSource: 'ldap',   status: 'active',      lastLogin: '2026-04-11 14:22' },
    { id: '3', name: 'Tomislav Blažević',  email: 'tomislav.blazevic@posta.hr',  role: 'IT Technician', roleSource: 'ldap',   status: 'active',      lastLogin: '2026-04-10 08:55' },
    { id: '4', name: 'Ana Marić',          email: 'ana.maric@posta.hr',          role: 'Viewer',        roleSource: 'saml',   status: 'active',      lastLogin: '2026-04-09 16:40' },
    { id: '5', name: 'Nikola Šimić',       email: 'nikola.simic@posta.hr',       role: 'Warehouse',     roleSource: 'manual', status: 'invited',     lastLogin: '—' },
    { id: '6', name: 'Petra Babić',        email: 'petra.babic@posta.hr',        role: 'Viewer',        roleSource: 'manual', status: 'deactivated', lastLogin: '2026-02-15 11:30' },
  ]);

  useEffect(() => {
    const list = Array.isArray(apiUsersData) ? apiUsersData : apiUsersData?.items;
    if (!list || list.length === 0) return;
    setUsers(list.map(u => ({
      id: u.id,
      name: u.full_name || u.username,
      email: u.email,
      role: u.role || 'Super Admin',
      roleSource: 'manual',
      status: u.is_active ? 'active' : 'deactivated',
      lastLogin: u.last_login_at ? u.last_login_at.slice(0, 16).replace('T', ' ') : '—',
    })));
  }, [apiUsersData]);

  const ROLES = ['Super Admin', 'Asset Manager', 'IT Technician', 'Warehouse', 'Viewer'];
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Viewer');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'invited' | 'deactivated'>('all');
  const [search, setSearch] = useState('');

  const filtered = users.filter(u => {
    if (filterStatus !== 'all' && u.status !== filterStatus) return false;
    if (search.trim()) {
      const hay = `${u.name} ${u.email} ${u.role} ${u.status}`.toLowerCase();
      const hayWords = hay.split(/[\s.,@_-]+/).filter(Boolean);
      const matches = search.trim().toLowerCase().split(/\s+/).every(qw =>
        hayWords.some(hw => hw.startsWith(qw))
      );
      if (!matches) return false;
    }
    return true;
  });

  const setRole = (id: string, role: string) => { setUsers(us => us.map(u => u.id === id ? { ...u, role } : u)); setEditingRole(null); };
  const deactivate = (id: string) => {
    setUsers(us => us.map(u => u.id === id ? { ...u, status: 'deactivated' } : u));
    if (id.length > 5) void apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify({ is_active: false }) }).catch(() => {});
  };
  const reactivate = (id: string) => {
    setUsers(us => us.map(u => u.id === id ? { ...u, status: 'active' } : u));
    if (id.length > 5) void apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify({ is_active: true }) }).catch(() => {});
  };
  const sendInvite = () => {
    if (!inviteEmail.trim()) return;
    setUsers(us => [...us, { id: Date.now().toString(), name: inviteEmail.split('@')[0], email: inviteEmail.trim(), role: inviteRole, roleSource: 'manual', status: 'invited', lastLogin: '—' }]);
    setInviteEmail(''); setInviting(false);
  };

  const statusBadge = (s: OrgUser['status']) => {
    if (s === 'active')      return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>;
    if (s === 'invited')     return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />Invited</span>;
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-theme-text-subtle bg-theme-bg border border-theme-border px-1.5 py-0.5 rounded"><span className="w-1.5 h-1.5 rounded-full bg-theme-border-strong" />Inactive</span>;
  };

  const counts = { all: users.length, active: users.filter(u => u.status === 'active').length, invited: users.filter(u => u.status === 'invited').length, deactivated: users.filter(u => u.status === 'deactivated').length };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-theme-lg font-semibold text-theme-text">Users</h2>
          <p className="text-theme-xs text-theme-text-muted mt-0.5">
            {isOrg ? 'Users provisioned to this organization via SSO, LDAP, or direct invite' : 'All users with access to this tenant'}
          </p>
        </div>
        {!isOrg && (
          <button onClick={() => setInviting(true)} className="flex items-center gap-1.5 px-3 py-2 text-theme-sm bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded-lg transition-colors">
            <Plus size={14} /> Invite user
          </button>
        )}
      </div>

      {isOrg && (
        <div className="flex items-start gap-2 mb-5 px-3 py-2.5 bg-theme-bg border border-theme-border rounded-lg text-theme-xs text-theme-text-muted">
          <Info size={13} className="text-theme-text-subtle shrink-0 mt-px" />
          <span>Users appear here because they were provisioned through this organization's SSO or LDAP — they carry this org's <span className="font-mono">organization_id</span>. To manage who has access, configure group mappings under <span className="font-medium text-theme-text">SSO / Identity</span>.</span>
        </div>
      )}

      {!isOrg && inviting && (
        <div className="mb-4 p-4 border border-theme-border rounded-lg bg-theme-surface flex items-end gap-3">
          <div className="flex-1">
            <label className="text-theme-xs text-theme-text-muted block mb-1">Email address</label>
            <Input value={inviteEmail} onChange={setInviteEmail} placeholder="user@company.com" className="w-full"
              onKeyDown={(e) => { if (e.key === 'Enter') sendInvite(); if (e.key === 'Escape') { setInviting(false); setInviteEmail(''); } }} />
          </div>
          <div className="w-44">
            <label className="text-theme-xs text-theme-text-muted block mb-1">Role</label>
            <Select value={inviteRole} onChange={setInviteRole} options={ROLES} className="w-full" />
          </div>
          <button onClick={sendInvite} className="px-4 py-1.5 text-theme-sm bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded transition-colors">Send invite</button>
          <button onClick={() => { setInviting(false); setInviteEmail(''); }} className="px-3 py-1.5 text-theme-sm text-theme-text-muted hover:text-theme-text transition-colors">Cancel</button>
        </div>
      )}

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1 bg-theme-bg border border-theme-border rounded-lg p-0.5">
          {(['all', 'active', 'invited', 'deactivated'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 text-theme-xs rounded transition-colors capitalize ${filterStatus === s ? 'bg-theme-surface shadow-sm text-theme-text font-medium' : 'text-theme-text-muted hover:text-theme-text'}`}>
              {s} {s !== 'all' && <span className="text-theme-text-subtle">({counts[s]})</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-theme-surface border border-theme-border rounded-lg px-3 py-1.5 w-60">
          <Search size={13} className="text-theme-text-subtle shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…"
            className="flex-1 bg-transparent text-theme-sm text-theme-text placeholder-theme-text-subtle focus:outline-none" />
        </div>
      </div>

      <div className="border border-theme-border rounded-lg overflow-hidden">
        <table className="w-full text-theme-sm">
          <thead>
            <tr className="border-b border-theme-border bg-theme-bg">
              <th className="text-left px-4 py-2.5 text-theme-xs font-medium text-theme-text-muted">User</th>
              <th className="text-left px-4 py-2.5 text-theme-xs font-medium text-theme-text-muted">Role</th>
              <th className="text-left px-4 py-2.5 text-theme-xs font-medium text-theme-text-muted">Status</th>
              <th className="text-left px-4 py-2.5 text-theme-xs font-medium text-theme-text-muted">Last login</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className={`border-b border-theme-border last:border-0 hover:bg-theme-surface-hover ${u.status === 'deactivated' ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-theme-primary/10 text-theme-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                      {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-theme-sm font-medium text-theme-text leading-tight">{u.name}</p>
                      <p className="text-theme-xs text-theme-text-muted leading-tight">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.roleSource !== 'manual' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-theme-sm text-theme-text">{u.role}</span>
                      <span title={`Role is managed by ${u.roleSource.toUpperCase()} group binding.`}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border cursor-help ${u.roleSource === 'ldap' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                        <Link2 size={9} /> {u.roleSource.toUpperCase()}
                      </span>
                    </div>
                  ) : editingRole === u.id ? (
                    <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setEditingRole(null); }}
                      className="px-2 py-1 text-theme-sm bg-theme-bg border border-theme-primary rounded text-theme-text focus:outline-none focus:ring-1 focus:ring-theme-primary">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <button onClick={() => setEditingRole(u.id)} className="text-theme-sm text-theme-text hover:text-theme-primary transition-colors flex items-center gap-1 group">
                      {u.role} <Edit2 size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">{statusBadge(u.status)}</td>
                <td className="px-4 py-3 font-mono text-theme-xs text-theme-text-subtle">{u.lastLogin}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {u.status === 'active'
                      ? <button onClick={() => deactivate(u.id)} className="px-2 py-1 text-theme-xs text-theme-text-subtle hover:text-theme-danger transition-colors">Deactivate</button>
                      : u.status === 'deactivated'
                      ? <button onClick={() => reactivate(u.id)} className="px-2 py-1 text-theme-xs text-theme-text-subtle hover:text-theme-primary transition-colors">Reactivate</button>
                      : <button className="px-2 py-1 text-theme-xs text-theme-text-subtle hover:text-theme-text transition-colors">Resend invite</button>
                    }
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-theme-sm text-theme-text-muted">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
