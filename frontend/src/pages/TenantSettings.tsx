import React, { useState, useMemo, useRef, useEffect, useContext, createContext, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import {
  Search, Building2, Scale, Shield, KeyRound, Puzzle, Zap,
  Layers, Tag, Database, Award, Users, Bot,
  Upload, RefreshCw, Plus, Trash2, Edit2, Check, X,
  ChevronRight, AlertTriangle, Clock, Globe, Server,
  FileText, ShieldCheck, CheckCircle2, Link2, RotateCcw,
  Lock, UserCheck, UserX, ArrowDownToLine, Shuffle,
  Activity, Webhook, Filter, ArrowRight, ToggleLeft, Info, BarChart2,
} from 'lucide-react';

// Shared asset-data types (used by both AssetTypesTab and NamingTab)
interface AssetField    { id: string; name: string; }
interface AssetType     { id: string; name: string; fields: AssetField[]; }
interface AssetCategory { id: string; name: string; types: AssetType[]; }
interface NamingSchema  { id: string; typeId: string; prefix: string; start: number; end: number | null; padding: number; used: number; capacity: number | null; org: string; }

const INITIAL_CATEGORIES: AssetCategory[] = [
  { id: 'c1', name: 'IT Infrastructure', types: [
    { id: 't1', name: 'Server',         fields: [{ id: 'f1', name: 'CPU' }, { id: 'f2', name: 'RAM (GB)' }, { id: 'f3', name: 'Storage (TB)' }, { id: 'f4', name: 'IP Address' }, { id: 'f5', name: 'OS' }, { id: 'f6', name: 'Rack Unit' }] },
    { id: 't2', name: 'Network Switch', fields: [{ id: 'f7', name: 'Ports' }, { id: 'f8', name: 'Speed' }, { id: 'f9', name: 'IP Address' }] },
    { id: 't3', name: 'Firewall',       fields: [{ id: 'f10', name: 'IP Address' }, { id: 'f11', name: 'Firmware' }] },
  ]},
  { id: 'c2', name: 'End-User Devices', types: [
    { id: 't4', name: 'Laptop',        fields: [{ id: 'f12', name: 'CPU' }, { id: 'f13', name: 'RAM (GB)' }, { id: 'f14', name: 'Storage (GB)' }, { id: 'f15', name: 'OS' }] },
    { id: 't5', name: 'Mobile Device', fields: [{ id: 'f16', name: 'OS' }, { id: 'f17', name: 'IMEI' }] },
  ]},
];

const INITIAL_SCHEMAS: NamingSchema[] = [
  { id: 's1', typeId: 't1', prefix: 'SRV-', start: 1, end: null, padding: 4, used: 23,  capacity: null, org: 'All' },
  { id: 's2', typeId: 't4', prefix: 'LPT-', start: 1, end: 9999, padding: 4, used: 412, capacity: 9999, org: 'All' },
  { id: 's3', typeId: 't5', prefix: 'MOB-', start: 1, end: 999,  padding: 3, used: 87,  capacity: 999,  org: 'All' },
];

interface TenantConfigData {
  tenant_id: string;
  name: string;
  slug: string;
  modules: Record<string, boolean>;
  settings: { currency?: string; timezone?: string; date_format?: string; language?: string };
}

interface SettingsContextValue {
  isOrg: boolean;
  tenantConfig: TenantConfigData | null;
  setTenantConfig: React.Dispatch<React.SetStateAction<TenantConfigData | null>>;
  assetCategories: AssetCategory[];
  setAssetCategories: React.Dispatch<React.SetStateAction<AssetCategory[]>>;
  namingSchemas: NamingSchema[];
  setNamingSchemas: React.Dispatch<React.SetStateAction<NamingSchema[]>>;
}

const SettingsContext = createContext<SettingsContextValue>({
  isOrg: false,
  tenantConfig: null,
  setTenantConfig: () => {},
  assetCategories: INITIAL_CATEGORIES,
  setAssetCategories: () => {},
  namingSchemas: INITIAL_SCHEMAS,
  setNamingSchemas: () => {},
});

type TabId =
  | 'general' | 'legal' | 'security' | 'sso' | 'modules'
  | 'integrations' | 'asset_types' | 'naming' | 'reference'
  | 'certificates' | 'permissions' | 'automation'
  | 'users' | 'audit' | 'printing' | 'reports';

interface Tab { id: TabId; label: string; icon: React.ReactNode; }
interface NavGroup { label: string; items: Tab[]; }

interface SearchResult { tab: TabId; tabLabel: string; label: string; description: string; }

const SEARCH_INDEX: SearchResult[] = [
  { tab: 'general',  tabLabel: 'General',        label: 'Tenant Name',       description: 'Display name of your organization' },
  { tab: 'general',  tabLabel: 'General',        label: 'Logo',              description: 'Rectangular and square logo upload' },
  { tab: 'general',  tabLabel: 'General',        label: 'Timezone',          description: 'Default timezone for all users' },
  { tab: 'general',  tabLabel: 'General',        label: 'Language',          description: 'Default UI language' },
  { tab: 'legal',    tabLabel: 'Legal',          label: 'Legal Name',        description: 'Full legal entity name' },
  { tab: 'legal',    tabLabel: 'Legal',          label: 'OIB',               description: 'Croatian personal/company ID number' },
  { tab: 'legal',    tabLabel: 'Legal',          label: 'IBAN',              description: 'Primary bank account number' },
  { tab: 'security', tabLabel: 'Security',       label: 'Enforce 2FA',       description: 'Require two-factor auth for all users' },
  { tab: 'security', tabLabel: 'Security',       label: 'Password Policy',   description: 'Minimum length, complexity, expiry' },
  { tab: 'sso',      tabLabel: 'SSO/Identity',   label: 'LDAP',              description: 'Active Directory / LDAP integration' },
  { tab: 'modules',  tabLabel: 'Modules',        label: 'Vendors Module',    description: 'Full vendor cards, contracts, reliability' },
  { tab: 'certificates', tabLabel: 'Certificates', label: 'Document Signing', description: 'Tenant-level signing cert' },
  { tab: 'permissions', tabLabel: 'Permissions', label: 'Roles',             description: 'Define and manage permission roles' },
  { tab: 'naming',   tabLabel: 'Naming Schemas', label: 'Asset Naming',      description: 'Prefix, padding, start/end number per asset type' },
  { tab: 'reference', tabLabel: 'Reference Data', label: 'Classification Levels', description: 'Security classification tiers' },
];

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

const SectionHeader = ({ title, description }: { title: string; description?: string }) => (
  <div className="mb-6">
    <h3 className="text-theme-base font-semibold text-theme-text">{title}</h3>
    {description && <p className="text-theme-sm text-theme-text-subtle mt-0.5">{description}</p>}
  </div>
);

const SettingRow = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-2 items-start py-4 border-b border-theme-border last:border-0">
    <div className="min-w-0">
      <p className="text-theme-sm font-medium text-theme-text">{label}</p>
      {description && <p className="text-theme-xs text-theme-text-subtle mt-0.5">{description}</p>}
    </div>
    <div className="flex flex-wrap justify-end gap-2">{children}</div>
  </div>
);

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    className={`relative inline-block h-5 w-9 rounded-full transition-colors flex-shrink-0 overflow-hidden ${value ? 'bg-theme-primary' : 'bg-slate-300'}`}
  >
    <span
      className="absolute left-0 top-[3px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform duration-200"
      style={{ transform: value ? 'translateX(19px)' : 'translateX(3px)' }}
    />
  </button>
);

const Input = ({ value, onChange, placeholder, className = '', onKeyDown }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) => (
  <input
    value={value}
    onChange={(e) => onChange?.(e.target.value)}
    placeholder={placeholder}
    onKeyDown={onKeyDown}
    className={`bg-theme-surface border border-theme-border rounded-md px-3 py-1.5 text-theme-sm text-theme-text placeholder-theme-text-subtle focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent shadow-sm ${className}`}
  />
);

const Select = ({ value, onChange, options, className = '' }: {
  value: string; onChange?: (v: string) => void; options: string[]; className?: string;
}) => (
  <select
    value={value}
    onChange={(e) => onChange?.(e.target.value)}
    className={`bg-theme-surface border border-theme-border rounded-md px-3 py-1.5 text-theme-sm text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent shadow-sm ${className}`}
  >
    {options.map((o) => <option key={o}>{o}</option>)}
  </select>
);

const Badge = ({ children, color = 'slate' }: { children: React.ReactNode; color?: 'green' | 'amber' | 'red' | 'blue' | 'slate' }) => {
  const colors = { green: 'bg-emerald-50 text-emerald-700 border-emerald-200', amber: 'bg-amber-50 text-amber-700 border-amber-200', red: 'bg-red-50 text-red-700 border-red-200', blue: 'bg-blue-50 text-blue-700 border-blue-200', slate: 'bg-theme-bg text-theme-text-subtle border-theme-border' };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[color]}`}>{children}</span>;
};

const OrgSettingRow = ({ label, description, tenantValue, children, defaultOverridden = false }: {
  label: string; description?: string; tenantValue: string; children: React.ReactNode; defaultOverridden?: boolean;
}) => {
  const [overridden, setOverridden] = useState(defaultOverridden);
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-8 items-start py-4 border-b border-theme-border last:border-0">
      <div className="min-w-0">
        <p className="text-theme-sm font-medium text-theme-text">{label}</p>
        {description && <p className="text-theme-xs text-theme-text-subtle mt-0.5">{description}</p>}
      </div>
      <div className="flex flex-col items-end gap-1.5">
        {overridden ? (
          <>
            {children}
            <button onClick={() => setOverridden(false)} className="flex items-center gap-1 text-theme-xs text-theme-text-subtle hover:text-amber-600 transition-colors">
              <RotateCcw size={11} /> Reset to tenant
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-theme-bg border border-theme-border rounded-md text-theme-xs text-theme-text-subtle">
              <Link2 size={11} className="shrink-0" />
              <span className="max-w-[180px] truncate">{tenantValue}</span>
            </div>
            <button onClick={() => setOverridden(true)} className="flex items-center gap-1 text-theme-xs text-theme-primary hover:text-theme-primary-hover transition-colors">
              Override <ChevronRight size={11} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const SaveBar = ({ onSave }: { onSave: () => void }) => {
  const [saved, setSaved] = useState(false);
  const handleSave = () => { onSave(); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return (
    <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-theme-border">
      <button className="px-4 py-2 text-theme-sm text-theme-text-subtle hover:text-theme-text transition-colors">Discard changes</button>
      <button onClick={handleSave} className={`px-4 py-2 text-theme-sm rounded-md transition-colors flex items-center gap-1.5 ${saved ? 'bg-emerald-500 text-white' : 'bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg'}`}>
        {saved ? <><Check size={14} /> Saved</> : 'Save changes'}
      </button>
    </div>
  );
};

// Logo upload with preview
const LogoUpload = ({ aspect }: { aspect: 'rect' | 'square' }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPreview(URL.createObjectURL(f));
  };
  const w = aspect === 'square' ? 'w-16 h-16' : 'h-12 w-44';
  return (
    <div className="flex items-center gap-2">
      <div
        className={`relative flex items-center justify-center border border-dashed border-theme-border rounded overflow-hidden cursor-pointer group ${w}`}
        style={!preview ? { backgroundImage: 'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)', backgroundSize: '10px 10px', backgroundPosition: '0 0,0 5px,5px -5px,-5px 0', backgroundColor: '#f8fafc' } : {}}
        onClick={() => inputRef.current?.click()}
      >
        {preview
          ? <img src={preview} alt="logo" className="w-full h-full object-contain" />
          : <span className="text-theme-xs text-theme-text-subtle">Logo</span>
        }
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Upload size={14} className="text-white" />
        </div>
      </div>
      {preview && (
        <button onClick={() => setPreview(null)} className="p-1.5 text-theme-text-subtle hover:text-theme-danger transition-colors" title="Remove">
          <X size={14} />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*,.svg" className="hidden" onChange={handleFile} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function GeneralOrgTab() {
  const [friendlyName, setFriendlyName] = useState('HP Logistika');
  const [orgType, setOrgType] = useState('Legal entity');
  const [parent, setParent] = useState('Hrvatska Pošta d.d.');
  const [contact, setContact] = useState('Marko Kovač');
  const [description, setDescription] = useState('Logistika i distribucija');
  return (
    <div className="max-w-2xl">
      <SectionHeader title="Organization Identity" description="Branding and display settings for this organization" />
      <SettingRow label="Friendly Name" description="Short display name used in the UI. Different from legal name.">
        <Input value={friendlyName} onChange={setFriendlyName} className="w-56" />
      </SettingRow>
      <SettingRow label="Logo (rectangular)" description="SVG or high-res PNG, min 600px wide for 300dpi print quality.">
        <LogoUpload aspect="rect" />
      </SettingRow>
      <SettingRow label="Logo (square)" description="Used as org icon in lists and selectors. 64×64px, SVG preferred.">
        <LogoUpload aspect="square" />
      </SettingRow>
      <div className="mt-8"><SectionHeader title="Organization Details" /></div>
      <SettingRow label="Organization Type">
        <Select value={orgType} onChange={setOrgType} options={['Legal entity', 'Division', 'Branch', 'Department', 'Subsidiary']} className="w-44" />
      </SettingRow>
      <SettingRow label="Parent Organization" description="Leave empty if top-level">
        <Select value={parent} onChange={setParent} options={['— none —', 'Hrvatska Pošta d.d.', 'HP d.d. (Holding)']} className="w-52" />
      </SettingRow>
      <SettingRow label="Primary Contact / Manager">
        <Input value={contact} onChange={setContact} className="w-44" />
      </SettingRow>
      <SettingRow label="Description" description="Internal note, not shown to end users">
        <Input value={description} onChange={setDescription} className="w-56" />
      </SettingRow>
      <SaveBar onSave={() => {}} />
    </div>
  );
}

function GeneralTab() {
  const { tenantConfig, setTenantConfig } = useContext(SettingsContext);
  const s = tenantConfig?.settings;
  const [tenantName, setTenantName] = useState('');
  const [country, setCountry] = useState('Croatia');
  const [currency, setCurrency] = useState('EUR — Euro');
  const [timezone, setTimezone] = useState('Europe/Zagreb');
  const [language, setLanguage] = useState('English');
  const [dateFormat, setDateFormat] = useState('DD.MM.YYYY');
  const [decimal, setDecimal] = useState(', (comma)');
  const [csvSeparator, setCsvSeparator] = useState('; (semicolon)');

  // Populate from tenant config when it loads
  useEffect(() => {
    if (!tenantConfig) return;
    setTenantName(tenantConfig.name);
    if (s?.currency) setCurrency(s.currency === 'EUR' ? 'EUR — Euro' : s.currency === 'USD' ? 'USD — Dollar' : s.currency === 'GBP' ? 'GBP — Pound' : s.currency);
    if (s?.timezone) setTimezone(s.timezone);
    if (s?.language) setLanguage(s.language === 'hr' ? 'Hrvatski' : s.language === 'de' ? 'Deutsch' : s.language === 'sl' ? 'Slovenščina' : 'English');
    if (s?.date_format) setDateFormat(s.date_format);
  }, [tenantConfig, s]);
  return (
    <div className="max-w-2xl">
      <SectionHeader title="Branding" description="How your organization appears in the system" />
      <SettingRow label="Tenant Name" description="Displayed in the top navigation bar">
        <Input value={tenantName} onChange={setTenantName} className="w-56" />
      </SettingRow>
      <SettingRow label="Logo (rectangular)" description="SVG or high-res PNG, min 600px wide for 300dpi print quality.">
        <LogoUpload aspect="rect" />
      </SettingRow>
      <SettingRow label="Logo (square)" description="Favicon, mobile icon, org selector. 64×64px, SVG preferred.">
        <LogoUpload aspect="square" />
      </SettingRow>
      <div className="mt-8 mb-6"><SectionHeader title="Regional" description="Affects all date, number and currency displays" /></div>
      <SettingRow label="Country"><Select value={country} onChange={setCountry} options={['Croatia', 'Germany', 'Austria', 'Slovenia', 'Serbia']} className="w-40" /></SettingRow>
      <SettingRow label="Currency"><Select value={currency} onChange={setCurrency} options={['EUR — Euro', 'USD — Dollar', 'HRK — Kuna (legacy)', 'GBP — Pound']} className="w-44" /></SettingRow>
      <SettingRow label="Timezone"><Select value={timezone} onChange={setTimezone} options={['Europe/Zagreb', 'Europe/Berlin', 'UTC', 'America/New_York']} className="w-44" /></SettingRow>
      <SettingRow label="Language" description="Default UI language for new users"><Select value={language} onChange={setLanguage} options={['English', 'Hrvatski', 'Deutsch', 'Slovenščina']} className="w-40" /></SettingRow>
      <SettingRow label="Date Format"><Select value={dateFormat} onChange={setDateFormat} options={['DD.MM.YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']} className="w-40" /></SettingRow>
      <SettingRow label="Decimal Separator"><Select value={decimal} onChange={setDecimal} options={[', (comma)', '. (dot)']} className="w-36" /></SettingRow>
      <SettingRow label="CSV Separator" description="Used in all CSV exports and expected on import"><Select value={csvSeparator} onChange={setCsvSeparator} options={['; (semicolon)', ', (comma)', '\t (tab)']} className="w-40" /></SettingRow>
      <SaveBar onSave={() => {
        const langMap: Record<string, string> = { 'English': 'en', 'Hrvatski': 'hr', 'Deutsch': 'de', 'Slovenščina': 'sl' };
        const curMap: Record<string, string> = { 'EUR — Euro': 'EUR', 'USD — Dollar': 'USD', 'HRK — Kuna (legacy)': 'HRK', 'GBP — Pound': 'GBP' };
        apiFetch<TenantConfigData>('/tenants/config/settings', {
          method: 'PATCH',
          body: JSON.stringify({
            currency: curMap[currency] ?? currency,
            timezone,
            date_format: dateFormat,
            language: langMap[language] ?? language,
          }),
        }).then(setTenantConfig).catch(() => {});
      }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legal Tab — identifiers fully editable
// ---------------------------------------------------------------------------

interface LegalId { id: string; label: string; value: string; }

function LegalTab() {
  const [legalName, setLegalName] = useState('Hrvatska Pošta d.d.');
  const [country, setCountry] = useState('Croatia (HR)');
  const [address, setAddress] = useState('Jurišićeva ulica 13, 10000 Zagreb');
  const [iban, setIban] = useState('HR1210010051863000160');
  const [responsible, setResponsible] = useState('Ivan Horvat');
  const [contactEmail, setContactEmail] = useState('poslovanje@posta.hr');

  const [identifiers, setIdentifiers] = useState<LegalId[]>([
    { id: '1', label: 'OIB', value: '12345678901' },
    { id: '2', label: 'MB', value: '1234567' },
    { id: '3', label: 'MBS', value: '080123456' },
    { id: '4', label: 'VAT Number', value: 'HR12345678901' },
  ]);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  const addId = () => {
    if (!newLabel.trim()) return;
    setIdentifiers(p => [...p, { id: Date.now().toString(), label: newLabel.trim(), value: newValue.trim() }]);
    setNewLabel(''); setNewValue(''); setAdding(false);
  };

  const updateId = (id: string, field: 'label' | 'value', val: string) =>
    setIdentifiers(p => p.map(i => i.id === id ? { ...i, [field]: val } : i));

  const removeId = (id: string) => setIdentifiers(p => p.filter(i => i.id !== id));

  return (
    <div className="max-w-2xl">
      <SectionHeader title="Legal Entity" description="Used on shipping labels, PDF exports, and official documents" />
      <SettingRow label="Legal Name"><Input value={legalName} onChange={setLegalName} className="w-64" /></SettingRow>
      <SettingRow label="Country of Incorporation">
        <Select value={country} onChange={setCountry} options={['Croatia (HR)', 'Germany (DE)', 'Austria (AT)']} className="w-44" />
      </SettingRow>

      <div className="mt-6 mb-2">
        <p className="text-theme-sm font-medium text-theme-text mb-1">Legal Identifiers</p>
        <p className="text-theme-xs text-theme-text-muted mb-4">Country-specific registration numbers and tax IDs</p>
        <div className="space-y-2">
          {identifiers.map((id) => (
            <div key={id.id} className="flex items-center gap-2">
              <Input value={id.label} onChange={(v) => updateId(id.id, 'label', v)} className="w-32" placeholder="Label" />
              <Input value={id.value} onChange={(v) => updateId(id.id, 'value', v)} className="w-44" placeholder="Value" />
              <button onClick={() => removeId(id.id)} className="p-1.5 text-theme-text-subtle hover:text-theme-danger transition-colors"><Trash2 size={13} /></button>
            </div>
          ))}
          {adding ? (
            <div className="flex items-center gap-2">
              <Input value={newLabel} onChange={setNewLabel} className="w-32" placeholder="Label" onKeyDown={(e) => { if (e.key === 'Enter') addId(); if (e.key === 'Escape') { setAdding(false); setNewLabel(''); setNewValue(''); } }} />
              <Input value={newValue} onChange={setNewValue} className="w-44" placeholder="Value" onKeyDown={(e) => { if (e.key === 'Enter') addId(); if (e.key === 'Escape') { setAdding(false); setNewLabel(''); setNewValue(''); } }} />
              <button onClick={addId} className="p-1.5 text-emerald-600 hover:text-emerald-700 transition-colors"><Check size={13} /></button>
              <button onClick={() => { setAdding(false); setNewLabel(''); setNewValue(''); }} className="p-1.5 text-theme-text-subtle hover:text-theme-text transition-colors"><X size={13} /></button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-theme-xs text-theme-primary hover:text-theme-primary-hover mt-1 transition-colors">
              <Plus size={12} /> Add identifier
            </button>
          )}
        </div>
      </div>

      <div className="mt-8"><SectionHeader title="Contact & Banking" /></div>
      <SettingRow label="Registered Address"><Input value={address} onChange={setAddress} className="w-64" /></SettingRow>
      <SettingRow label="Primary IBAN"><Input value={iban} onChange={setIban} className="w-56" /></SettingRow>
      <SettingRow label="Responsible Person" description="Printed on official documents"><Input value={responsible} onChange={setResponsible} className="w-44" /></SettingRow>
      <SettingRow label="Contact Email"><Input value={contactEmail} onChange={setContactEmail} className="w-52" /></SettingRow>
      <SaveBar onSave={() => {}} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Security Tab
// ---------------------------------------------------------------------------

function SecurityTab() {
  const { isOrg } = useContext(SettingsContext);
  const Row = isOrg ? OrgSettingRow : SettingRow;

  const [enforce2fa, setEnforce2fa] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('8 hours');
  const [localAuth, setLocalAuth] = useState(true);
  const [ldapAuth, setLdapAuth] = useState(true);
  const [m365Auth, setM365Auth] = useState(false);
  const [googleAuth, setGoogleAuth] = useState(false);
  const [samlAuth, setSamlAuth] = useState(false);
  const [minLength, setMinLength] = useState('12');
  const [pwUppercase, setPwUppercase] = useState(true);
  const [pwNumber, setPwNumber] = useState(true);
  const [pwSpecial, setPwSpecial] = useState(true);
  const [pwExpiry, setPwExpiry] = useState('90 days');
  const [mismatch, setMismatch] = useState<'allow' | 'warn' | 'block'>('warn');
  const [fourEyes, setFourEyes] = useState(false);
  const [requireReason, setRequireReason] = useState(true);

  return (
    <div className="max-w-2xl">
      {isOrg && (
        <div className="flex items-start gap-2 mb-6 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
          <Link2 size={14} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-theme-xs text-theme-text-muted">Settings inherited from tenant by default. Click <span className="text-theme-primary font-medium">Override</span> to configure per-organization.</p>
        </div>
      )}
      <SectionHeader title="Authentication" />
      <Row label="Enforce 2FA" description="All users must configure two-factor authentication" {...(isOrg ? { tenantValue: 'Enabled' } : {})}>
        <Toggle value={enforce2fa} onChange={setEnforce2fa} />
      </Row>
      <Row label="Session Timeout" description="Auto logout after inactivity" {...(isOrg ? { tenantValue: '8 hours' } : {})}>
        <Select value={sessionTimeout} onChange={setSessionTimeout} options={['30 minutes', '1 hour', '4 hours', '8 hours', '24 hours', 'Never']} className="w-36" />
      </Row>
      <Row label="Allowed Auth Methods" {...(isOrg ? { tenantValue: 'Local, LDAP' } : {})}>
        <div className="flex flex-col gap-2">
          {([['Local password', localAuth, setLocalAuth], ['LDAP / Active Directory', ldapAuth, setLdapAuth], ['Microsoft 365', m365Auth, setM365Auth], ['Google Workspace', googleAuth, setGoogleAuth], ['SAML 2.0', samlAuth, setSamlAuth]] as const).map(([label, val, setter]) => (
            <label key={label as string} className="flex items-center gap-2 cursor-pointer">
              <Toggle value={val as boolean} onChange={setter as (v: boolean) => void} />
              <span className="text-theme-sm text-theme-text">{label as string}</span>
            </label>
          ))}
        </div>
      </Row>
      <div className="mt-8 mb-2"><SectionHeader title="Password Policy" description="Applies to local password authentication only" /></div>
      <Row label="Minimum Length" {...(isOrg ? { tenantValue: '12 characters' } : {})}>
        <Input value={minLength} onChange={setMinLength} className="w-20" />
      </Row>
      <Row label="Require Uppercase" {...(isOrg ? { tenantValue: 'Enabled' } : {})}><Toggle value={pwUppercase} onChange={setPwUppercase} /></Row>
      <Row label="Require Number" {...(isOrg ? { tenantValue: 'Enabled' } : {})}><Toggle value={pwNumber} onChange={setPwNumber} /></Row>
      <Row label="Require Special Character" {...(isOrg ? { tenantValue: 'Enabled' } : {})}><Toggle value={pwSpecial} onChange={setPwSpecial} /></Row>
      <Row label="Password Expiry" {...(isOrg ? { tenantValue: '90 days' } : {})}>
        <Select value={pwExpiry} onChange={setPwExpiry} options={['Never', '30 days', '60 days', '90 days', '180 days', '1 year']} className="w-36" />
      </Row>
      <div className="mt-8"><SectionHeader title="Classification Security" description="Behaviour when a user accesses an asset above their clearance" /></div>
      <Row label="Clearance Mismatch Action" {...(isOrg ? { tenantValue: 'Warn' } : {})}>
        <div className="flex gap-2 flex-wrap">
          {(['allow', 'warn', 'block'] as const).map((v) => (
            <button key={v} onClick={() => setMismatch(v)} className={`px-3 py-1 rounded text-theme-xs font-medium capitalize transition-colors ${mismatch === v ? v === 'block' ? 'bg-red-50 text-red-600 border border-red-200' : v === 'warn' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-theme-bg text-theme-text-muted border border-theme-border hover:border-theme-border-strong'}`}>{v}</button>
          ))}
        </div>
      </Row>
      <Row label="4-Eyes Principle" description="Sensitive actions require approval from a second user" {...(isOrg ? { tenantValue: 'Disabled' } : {})}><Toggle value={fourEyes} onChange={setFourEyes} /></Row>
      <div className="mt-8"><SectionHeader title="Asset Security" /></div>
      <Row label="Require Reason on Decommission" description="User must enter a reason when decommissioning an asset" {...(isOrg ? { tenantValue: 'Enabled' } : {})}><Toggle value={requireReason} onChange={setRequireReason} /></Row>
      <SaveBar onSave={() => {}} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SSO Tab — master-detail layout
// ---------------------------------------------------------------------------

interface GroupMapping { id: string; adGroup: string; role: string; scope: 'direct' | 'nested'; }
interface AttrMapping { id: string; adAttr: string; field: string; }

function LdapBasicPanel({ getField, setField }: { getField: (l: string) => string; setField: (l: string, v: string) => void }) {
  return (
    <div className="space-y-3">
      {[
        { label: 'LDAP URL', placeholder: 'ldaps://ad.example.com:636' },
        { label: 'Bind DN', placeholder: 'CN=svc-inverum,OU=Service,DC=example,DC=com' },
        { label: 'Base DN', placeholder: 'DC=example,DC=com' },
        { label: 'User Filter', placeholder: '(sAMAccountName={username})' },
      ].map((f) => (
        <div key={f.label} className="flex items-center gap-3">
          <label className="text-theme-xs text-theme-text-muted w-28 shrink-0">{f.label}</label>
          <Input value={getField(f.label)} onChange={(v) => setField(f.label, v)} placeholder={f.placeholder} className="flex-1 font-mono text-theme-xs" />
        </div>
      ))}
      <div className="flex gap-2 pt-1">
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

function LdapAdvancedPanel({ isEnterprise }: { isEnterprise: boolean }) {
  const [groupMappings, setGroupMappings] = useState<GroupMapping[]>([
    { id: '1', adGroup: 'CN=IT Admins,OU=Groups,DC=posta,DC=hr', role: 'IT Technician', scope: 'direct' },
    { id: '2', adGroup: 'CN=All Users,OU=Groups,DC=posta,DC=hr', role: 'Viewer', scope: 'nested' },
  ]);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState('');
  const [newRole, setNewRole] = useState('Viewer');
  const [newScope, setNewScope] = useState<'direct' | 'nested'>('direct');

  const [syncEnabled, setSyncEnabled] = useState(true);
  const [syncSchedule, setSyncSchedule] = useState('daily');
  const [syncBaseDN, setSyncBaseDN] = useState('OU=Users,DC=posta,DC=hr');
  const [lastSync] = useState('2026-04-11 03:00 — 312 users synced');

  const [deactivateOnGroupRemoval, setDeactivateOnGroupRemoval] = useState(true);
  const [deactivateOnAdDisable, setDeactivateOnAdDisable]       = useState(true);

  const [attrMappings, setAttrMappings] = useState<AttrMapping[]>([
    { id: '1', adAttr: 'displayName', field: 'Full Name' },
    { id: '2', adAttr: 'mail', field: 'Email' },
    { id: '3', adAttr: 'department', field: 'Department' },
    { id: '4', adAttr: 'telephoneNumber', field: 'Phone' },
    { id: '5', adAttr: 'title', field: 'Job Title' },
  ]);
  const [addingAttr, setAddingAttr] = useState(false);
  const [newAdAttr, setNewAdAttr] = useState('');
  const [newField, setNewField] = useState('');

  const addGroupMapping = () => {
    if (!newGroup.trim()) return;
    setGroupMappings(m => [...m, { id: Date.now().toString(), adGroup: newGroup.trim(), role: newRole, scope: newScope }]);
    setNewGroup(''); setAddingGroup(false);
  };
  const removeGroupMapping = (id: string) => setGroupMappings(m => m.filter(x => x.id !== id));

  const addAttrMapping = () => {
    if (!newAdAttr.trim() || !newField.trim()) return;
    setAttrMappings(m => [...m, { id: Date.now().toString(), adAttr: newAdAttr.trim(), field: newField.trim() }]);
    setNewAdAttr(''); setNewField(''); setAddingAttr(false);
  };
  const removeAttrMapping = (id: string) => setAttrMappings(m => m.filter(x => x.id !== id));

  const content = (
    <div className="space-y-8">
      {/* Group Mappings */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <UserCheck size={14} className="text-theme-text-muted" />
          <p className="text-theme-sm font-semibold text-theme-text">Group Mappings</p>
          <span className="text-theme-xs text-theme-text-subtle">AD group → Inverum role</span>
        </div>
        <div className="border border-theme-border rounded-lg overflow-hidden">
          <table className="w-full text-theme-sm">
            <thead>
              <tr className="border-b border-theme-border bg-theme-bg">
                <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">AD Group DN</th>
                <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Role</th>
                <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Scope</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {groupMappings.map((m) => (
                <tr key={m.id} className="border-b border-theme-border last:border-0 hover:bg-theme-surface-hover">
                  <td className="px-4 py-2.5 font-mono text-theme-xs text-theme-text-muted max-w-[260px] truncate">{m.adGroup}</td>
                  <td className="px-4 py-2.5">
                    <Badge color="blue">{m.role}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-theme-xs text-theme-text-subtle">{m.scope}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => removeGroupMapping(m.id)} className="p-1 text-theme-text-subtle hover:text-theme-danger transition-colors"><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
              {addingGroup && (
                <tr className="border-b border-theme-border bg-theme-bg">
                  <td className="px-4 py-2">
                    <Input value={newGroup} onChange={setNewGroup} placeholder="CN=Group,OU=Groups,DC=..." className="w-full font-mono text-theme-xs"
                      onKeyDown={(e) => { if (e.key === 'Enter') addGroupMapping(); if (e.key === 'Escape') { setAddingGroup(false); setNewGroup(''); } }} />
                  </td>
                  <td className="px-4 py-2">
                    <Select value={newRole} onChange={setNewRole} options={['Super Admin', 'Asset Manager', 'IT Technician', 'Warehouse', 'Viewer']} className="w-36" />
                  </td>
                  <td className="px-4 py-2">
                    <Select value={newScope} onChange={(v) => setNewScope(v as 'direct' | 'nested')} options={['direct', 'nested']} className="w-28" />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button onClick={addGroupMapping} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                      <button onClick={() => { setAddingGroup(false); setNewGroup(''); }} className="p-1 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!addingGroup && (
          <button onClick={() => setAddingGroup(true)} className="flex items-center gap-1.5 text-theme-xs text-theme-primary hover:text-theme-primary-hover mt-2 transition-colors">
            <Plus size={12} /> Add mapping
          </button>
        )}
      </div>

      {/* Employee Sync */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <ArrowDownToLine size={14} className="text-theme-text-muted" />
          <p className="text-theme-sm font-semibold text-theme-text">Employee Sync</p>
          <span className="text-theme-xs text-theme-text-subtle">Import employees from AD</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-theme-border">
            <div>
              <p className="text-theme-sm text-theme-text">Auto-sync enabled</p>
              <p className="text-theme-xs text-theme-text-subtle mt-0.5">Automatically sync employees on schedule</p>
            </div>
            <Toggle value={syncEnabled} onChange={setSyncEnabled} />
          </div>
          {syncEnabled && (
            <>
              <div className="flex items-center gap-3">
                <label className="text-theme-xs text-theme-text-muted w-28 shrink-0">Schedule</label>
                <Select value={syncSchedule} onChange={setSyncSchedule} options={['manual', 'hourly', 'daily', 'weekly']} className="w-32" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-theme-xs text-theme-text-muted w-28 shrink-0">User Search Base</label>
                <Input value={syncBaseDN} onChange={setSyncBaseDN} placeholder="OU=Users,DC=example,DC=com" className="flex-1 font-mono text-theme-xs" />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <label className="text-theme-xs text-theme-text-muted w-28 shrink-0">Last sync</label>
                <span className="text-theme-xs text-theme-text-subtle flex items-center gap-1.5">
                  <CheckCircle2 size={11} className="text-emerald-500" /> {lastSync}
                </span>
              </div>
              <div className="pt-1">
                <button className="px-3 py-1.5 text-theme-xs bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded transition-colors flex items-center gap-1.5">
                  <RefreshCw size={11} /> Sync Now
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Attribute Mappings */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shuffle size={14} className="text-theme-text-muted" />
          <p className="text-theme-sm font-semibold text-theme-text">Attribute Mappings</p>
          <span className="text-theme-xs text-theme-text-subtle">AD attribute → Inverum field</span>
        </div>
        <div className="border border-theme-border rounded-lg overflow-hidden">
          <table className="w-full text-theme-sm">
            <thead>
              <tr className="border-b border-theme-border bg-theme-bg">
                <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">AD Attribute</th>
                <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Inverum Field</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {attrMappings.map((m) => (
                <tr key={m.id} className="border-b border-theme-border last:border-0 hover:bg-theme-surface-hover">
                  <td className="px-4 py-2.5 font-mono text-theme-xs text-theme-primary">{m.adAttr}</td>
                  <td className="px-4 py-2.5 text-theme-xs text-theme-text">{m.field}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => removeAttrMapping(m.id)} className="p-1 text-theme-text-subtle hover:text-theme-danger transition-colors"><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
              {addingAttr && (
                <tr className="border-b border-theme-border bg-theme-bg">
                  <td className="px-4 py-2">
                    <Input value={newAdAttr} onChange={setNewAdAttr} placeholder="adAttribute" className="w-36 font-mono text-theme-xs"
                      onKeyDown={(e) => { if (e.key === 'Enter') addAttrMapping(); if (e.key === 'Escape') { setAddingAttr(false); setNewAdAttr(''); setNewField(''); } }} />
                  </td>
                  <td className="px-4 py-2">
                    <Input value={newField} onChange={setNewField} placeholder="Inverum field" className="w-36"
                      onKeyDown={(e) => { if (e.key === 'Enter') addAttrMapping(); if (e.key === 'Escape') { setAddingAttr(false); setNewAdAttr(''); setNewField(''); } }} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button onClick={addAttrMapping} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                      <button onClick={() => { setAddingAttr(false); setNewAdAttr(''); setNewField(''); }} className="p-1 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!addingAttr && (
          <button onClick={() => setAddingAttr(true)} className="flex items-center gap-1.5 text-theme-xs text-theme-primary hover:text-theme-primary-hover mt-2 transition-colors">
            <Plus size={12} /> Add mapping
          </button>
        )}
      </div>

      {/* User Lifecycle */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <UserX size={14} className="text-theme-text-muted" />
          <p className="text-theme-sm font-semibold text-theme-text">User Lifecycle</p>
          <span className="text-theme-xs text-theme-text-subtle">Auto-deprovisioning rules</span>
        </div>
        <div className="space-y-0 border border-theme-border rounded-lg overflow-hidden">
          <div className="flex items-start justify-between gap-4 px-4 py-3 border-b border-theme-border">
            <div>
              <p className="text-theme-sm text-theme-text">Deactivate when removed from all mapped groups</p>
              <p className="text-theme-xs text-theme-text-subtle mt-0.5">
                If a user no longer belongs to any group mapped to an Inverum role, their account is automatically deactivated on the next sync.
              </p>
            </div>
            <Toggle value={deactivateOnGroupRemoval} onChange={setDeactivateOnGroupRemoval} />
          </div>
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <div>
              <p className="text-theme-sm text-theme-text">Deactivate when account is disabled in AD</p>
              <p className="text-theme-xs text-theme-text-subtle mt-0.5">
                Reads <span className="font-mono">userAccountControl</span> — if the <span className="font-mono">ACCOUNTDISABLE</span> flag is set, the Inverum account is deactivated on the next sync.
              </p>
            </div>
            <Toggle value={deactivateOnAdDisable} onChange={setDeactivateOnAdDisable} />
          </div>
        </div>
        <p className="text-theme-xs text-theme-text-subtle mt-2">
          Deactivated accounts lose access immediately but are not deleted — audit history and asset assignments are preserved.
        </p>
      </div>
    </div>
  );

  if (!isEnterprise) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-theme-surface/80 backdrop-blur-[1px] rounded-lg z-10 flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-2 px-4 py-3 bg-theme-surface border border-theme-border rounded-lg shadow-sm">
            <Lock size={15} className="text-theme-text-muted" />
            <div>
              <p className="text-theme-sm font-medium text-theme-text">Enterprise feature</p>
              <p className="text-theme-xs text-theme-text-subtle">Group mapping and employee sync require an Enterprise plan.</p>
            </div>
            <button className="ml-4 px-3 py-1.5 text-theme-xs bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded transition-colors whitespace-nowrap">
              Upgrade
            </button>
          </div>
        </div>
        <div className="opacity-30 pointer-events-none select-none">{content}</div>
      </div>
    );
  }

  return content;
}

function SSOTab() {
  const { isOrg } = useContext(SettingsContext);
  const [selected, setSelected] = useState<string>('ldap');
  const [orgOverrides, setOrgOverrides] = useState<Record<string, boolean>>({});
  const [isEnterprise] = useState(true); // toggle to false to see locked state
  const [ldapSection, setLdapSection] = useState<'basic' | 'advanced'>('basic');
  const [ldapFields, setLdapFields] = useState<Record<string, string>>({
    'LDAP URL': 'ldaps://ad.posta.hr:636',
    'Bind DN': 'CN=svc-inverum,OU=Service,DC=posta,DC=hr',
    'Base DN': 'DC=posta,DC=hr',
    'User Filter': '(sAMAccountName={username})',
  });
  const [oauthFields, setOauthFields] = useState<Record<string, string>>({});
  const getOAuth = (id: string, f: string) => oauthFields[`${id}-${f}`] ?? '';
  const setOAuth = (id: string, f: string, v: string) => setOauthFields(p => ({ ...p, [`${id}-${f}`]: v }));
  const [m365DeactivateOnDisable, setM365DeactivateOnDisable] = useState(true);

  type Provider = { id: string; name: string; icon: React.ReactNode; tier: 'opensource' | 'enterprise'; status: 'active' | 'connected' | 'disabled'; fields?: string[]; };
  const providers: Provider[] = [
    { id: 'local',  name: 'Local',                    icon: <KeyRound size={15} />, tier: 'opensource', status: 'active' },
    { id: 'ldap',   name: 'LDAP / Active Directory',  icon: <Server size={15} />,   tier: 'enterprise', status: 'connected' },
    { id: 'm365',   name: 'Microsoft 365 / Entra ID', icon: <Globe size={15} />,    tier: 'enterprise', status: 'disabled', fields: ['Tenant ID', 'Client ID', 'Client Secret'] },
    { id: 'google', name: 'Google Workspace',         icon: <Globe size={15} />,    tier: 'enterprise', status: 'disabled', fields: ['Client ID', 'Client Secret', 'Domain'] },
    { id: 'saml',   name: 'SAML 2.0',                 icon: <KeyRound size={15} />, tier: 'enterprise', status: 'disabled', fields: ['IdP Metadata URL', 'SP Entity ID', 'ACS URL'] },
  ];

  const cur = providers.find(p => p.id === selected)!;
  const isOverridden = !isOrg || !!orgOverrides[selected];

  const statusDot = (s: Provider['status']) => {
    if (s === 'active' || s === 'connected') return <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />;
    return <span className="w-1.5 h-1.5 rounded-full bg-theme-border-strong shrink-0" />;
  };

  const renderRight = () => {
    // org mode + not overridden → show inherit banner
    const inheritBanner = isOrg && !isOverridden && (
      <div className="flex items-center justify-between mb-4 px-3 py-2.5 bg-theme-bg border border-theme-border rounded-lg">
        <span className="flex items-center gap-2 text-theme-xs text-theme-text-muted">
          <Link2 size={13} className="text-theme-text-subtle" /> Inheriting from tenant settings
        </span>
        <button onClick={() => setOrgOverrides(s => ({ ...s, [selected]: true }))} className="flex items-center gap-1 text-theme-xs text-theme-primary hover:text-theme-primary-hover transition-colors">
          Override <ChevronRight size={11} />
        </button>
      </div>
    );

    const resetBtn = isOrg && isOverridden && (
      <button onClick={() => setOrgOverrides(s => ({ ...s, [selected]: false }))} className="flex items-center gap-1.5 text-theme-xs text-theme-text-subtle hover:text-amber-600 transition-colors">
        <RotateCcw size={11} /> Reset to tenant default
      </button>
    );

    if (cur.id === 'local') {
      return (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-theme-base font-semibold text-theme-text">Local Authentication</p>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Open Source</span>
            <Badge color="green"><CheckCircle2 size={10} /> Always active</Badge>
          </div>
          <p className="text-theme-xs text-theme-text-muted mb-6">Username and password authentication. Cannot be fully disabled — always available as fallback.</p>

          <div className="p-4 bg-theme-bg border border-theme-border rounded-lg text-theme-sm text-theme-text-muted space-y-1.5">
            <p>Allowed authentication methods (including enabling/disabling local login on the login page) → <strong className="text-theme-text">Security</strong> tab.</p>
            <p>Password complexity, lockout policy, and session settings → <strong className="text-theme-text">Security</strong> tab.</p>
          </div>
        </div>
      );
    }

    if (cur.id === 'ldap') {
      return (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <p className="text-theme-base font-semibold text-theme-text">LDAP / Active Directory</p>
              <Badge color="green"><CheckCircle2 size={10} /> Connected</Badge>
            </div>
            {resetBtn}
          </div>
          <p className="text-theme-xs text-theme-text-muted mb-4">Authenticate users against your directory. Enterprise plan required for group mappings and employee sync.</p>
          {inheritBanner}
          {(!isOrg || isOverridden) && (
            <>
              <div className="flex border-b border-theme-border mb-4">
                {(['basic', 'advanced'] as const).map((s) => (
                  <button key={s} onClick={() => setLdapSection(s)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-theme-sm font-medium border-b-2 -mb-px transition-colors ${ldapSection === s ? 'border-theme-primary text-theme-primary' : 'border-transparent text-theme-text-subtle hover:text-theme-text'}`}
                  >
                    {s === 'advanced' && !isEnterprise && <Lock size={10} />}
                    {s === 'basic' ? 'Connection' : 'Advanced'}
                    {s === 'advanced' && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${isEnterprise ? 'bg-amber-50 text-amber-700' : 'bg-theme-bg text-theme-text-subtle border border-theme-border'}`}>Enterprise</span>
                    )}
                  </button>
                ))}
              </div>
              {ldapSection === 'basic'
                ? <LdapBasicPanel getField={(l) => ldapFields[l] ?? ''} setField={(l, v) => setLdapFields(p => ({ ...p, [l]: v }))} />
                : <LdapAdvancedPanel isEnterprise={isEnterprise} />
              }
            </>
          )}
        </div>
      );
    }

    // M365, Google, SAML
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <p className="text-theme-base font-semibold text-theme-text">{cur.name}</p>
            <Badge color="slate">Disabled</Badge>
          </div>
          {resetBtn}
        </div>
        <p className="text-theme-xs text-theme-text-muted mb-4">OAuth 2.0 / OIDC single sign-on via {cur.name}.</p>
        {inheritBanner}
        {(!isOrg || isOverridden) && (
          <div className="space-y-3">
            {(cur.fields ?? []).map((f) => (
              <div key={f} className="flex items-center gap-3">
                <label className="text-theme-xs text-theme-text-muted w-32 shrink-0">{f}</label>
                <Input value={getOAuth(cur.id, f)} onChange={(v) => setOAuth(cur.id, f, v)} placeholder={`Enter ${f.toLowerCase()}`} className="flex-1" />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button className="px-3 py-1.5 text-theme-xs bg-theme-bg hover:bg-theme-surface-hover text-theme-text rounded border border-theme-border transition-colors">Test Connection</button>
              <button className="px-3 py-1.5 text-theme-xs bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded transition-colors">Save</button>
            </div>
            {cur.id === 'm365' && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <UserX size={14} className="text-theme-text-muted" />
                  <p className="text-theme-sm font-semibold text-theme-text">User Lifecycle</p>
                </div>
                <div className="border border-theme-border rounded-lg overflow-hidden">
                  <div className="flex items-start justify-between gap-4 px-4 py-3">
                    <div>
                      <p className="text-theme-sm text-theme-text">Deactivate when account is disabled in Entra ID</p>
                      <p className="text-theme-xs text-theme-text-subtle mt-0.5">
                        If <span className="font-mono">accountEnabled</span> is <span className="font-mono">false</span> in Microsoft Entra ID, the Inverum account is deactivated on next sign-in or sync.
                      </p>
                    </div>
                    <Toggle value={m365DeactivateOnDisable} onChange={setM365DeactivateOnDisable} />
                  </div>
                </div>
                <p className="text-theme-xs text-theme-text-subtle mt-2">
                  Deactivated accounts lose access immediately but are not deleted — audit history and asset assignments are preserved.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-full">
      {/* Left: provider list */}
      <div className="w-56 shrink-0 border-r border-theme-border pt-2 pb-4">
        <p className="px-4 py-2 text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider">Providers</p>
        {providers.map((p) => {
          const active = selected === p.id;
          const overridden = !isOrg || !!orgOverrides[p.id];
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${active ? 'bg-theme-surface-hover text-theme-text' : 'text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text'}`}
            >
              <span className={active ? 'text-theme-primary' : 'text-theme-text-subtle'}>{p.icon}</span>
              <span className="text-theme-sm flex-1 truncate">{p.name}</span>
              {isOrg && !overridden
                ? <span className="text-theme-text-subtle shrink-0"><Link2 size={10} /></span>
                : statusDot(p.status)
              }
            </button>
          );
        })}
      </div>

      {/* Right: settings panel */}
      <div className="flex-1 px-8 py-6 overflow-auto">
        {isOrg && (
          <div className="flex items-center gap-1.5 mb-5 text-theme-xs text-theme-text-subtle">
            <Link2 size={11} />
            <span>Organization-level overrides — changes here apply only to this org.</span>
          </div>
        )}
        {renderRight()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modules Tab
// ---------------------------------------------------------------------------

function ModulesTab() {
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

  // Sync from tenant config when it loads
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
// Integrations Tab — list + per-integration detail screen
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

// Returns the entity domain for a given event (determines which scope fields are shown)
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

// Scope filter fields per entity domain — filters narrow WHICH entities trigger the rule
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

// Trigger editor — WHEN / WHERE / MATCH / DO structure
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
  // custom field name inputs for MATCH section
  const [customInverumField,  setCustomInverumField]  = useState('');
  const [customExternalField, setCustomExternalField] = useState('');

  const domain = getEventDomain(event);
  const domainFields = SCOPE_FIELDS_BY_DOMAIN[domain] ?? [];

  const changeEvent = (newEvent: string) => {
    const newDomain = getEventDomain(newEvent);
    if (newDomain !== domain) setScopeFilters([]); // clear filters when domain changes
    setEvent(newEvent);
  };

  // scope filters
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

  // field mappings
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
      {/* Name + Event row */}
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

      {/* WHERE */}
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

      {/* MATCH */}
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

      {/* DO */}
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

// Triggers panel used inside integration detail
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

// Event log panel
function EventLogPanel({ integrationId }: { integrationId: string }) {
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

// Connection fields panel
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

// Integration detail screen
function IntegrationDetail({ integration, onBack }: { integration: Integration; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'connection' | 'triggers' | 'log'>('connection');
  const [enabled, setEnabled] = useState(integration.status === 'connected');

  return (
    <div>
      {/* Header */}
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

      {/* Sub-tabs */}
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

function IntegrationsTab() {
  const [selected, setSelected] = useState<Integration | null>(null);

  if (selected) {
    return <IntegrationDetail integration={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="max-w-3xl">
      <SectionHeader title="Integrations" description="Incoming data feeds and outgoing notifications/events" />
      <div className="space-y-2">
        {INTEGRATIONS.map((i) => (
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
// Asset Types Tab — full CRUD
// ---------------------------------------------------------------------------

function AssetTypesTab() {
  const { assetCategories: categories, setAssetCategories: setCategories, namingSchemas } = useContext(SettingsContext);
  const typesWithSchema = new Set(namingSchemas.map(s => s.typeId));
  const [expandedCat, setExpandedCat] = useState<string | null>('c1');
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [addingField, setAddingField] = useState<string | null>(null); // typeId
  const [newFieldName, setNewFieldName] = useState('');
  const [addingType, setAddingType] = useState<string | null>(null); // catId
  const [newTypeName, setNewTypeName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState('');

  const addField = (typeId: string) => {
    if (!newFieldName.trim()) return;
    setCategories(cats => cats.map(c => ({ ...c, types: c.types.map(t => t.id === typeId ? { ...t, fields: [...t.fields, { id: Date.now().toString(), name: newFieldName.trim() }] } : t) })));
    setNewFieldName(''); setAddingField(null);
  };
  const removeField = (typeId: string, fieldId: string) =>
    setCategories(cats => cats.map(c => ({ ...c, types: c.types.map(t => t.id === typeId ? { ...t, fields: t.fields.filter(f => f.id !== fieldId) } : t) })));
  const addType = (catId: string) => {
    if (!newTypeName.trim()) return;
    setCategories(cats => cats.map(c => c.id === catId ? { ...c, types: [...c.types, { id: Date.now().toString(), name: newTypeName.trim(), fields: [] }] } : c));
    setNewTypeName(''); setAddingType(null);
  };
  const removeType = (catId: string, typeId: string) =>
    setCategories(cats => cats.map(c => c.id === catId ? { ...c, types: c.types.filter(t => t.id !== typeId) } : c));
  const saveTypeName = (typeId: string) => {
    if (!editTypeName.trim()) return;
    setCategories(cats => cats.map(c => ({ ...c, types: c.types.map(t => t.id === typeId ? { ...t, name: editTypeName.trim() } : t) })));
    setEditingType(null);
  };
  const addCategory = () => {
    if (!newCatName.trim()) return;
    setCategories(cats => [...cats, { id: Date.now().toString(), name: newCatName.trim(), types: [] }]);
    setNewCatName(''); setAddingCat(false);
  };
  const removeCategory = (catId: string) => setCategories(cats => cats.filter(c => c.id !== catId));

  return (
    <div className="max-w-3xl">
      <SectionHeader title="Asset Categories & Types" description="Custom fields are added per asset type and shown in the asset detail panel" />
      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.id} className="border border-theme-border rounded-lg overflow-hidden">
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-theme-surface-hover transition-colors text-left" onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}>
              <div className="flex items-center gap-3">
                <span className="text-theme-sm font-semibold text-theme-text">{cat.name}</span>
                <span className="text-theme-xs text-theme-text-subtle">{cat.types.length} types</span>
              </div>
              <div className="flex items-center gap-1">
                <span onClick={(e) => { e.stopPropagation(); removeCategory(cat.id); }} className="p-1.5 text-theme-text-subtle hover:text-theme-danger transition-colors rounded cursor-pointer"><Trash2 size={13} /></span>
                <ChevronRight size={14} className={`text-theme-text-subtle transition-transform ${expandedCat === cat.id ? 'rotate-90' : ''}`} />
              </div>
            </button>
            {expandedCat === cat.id && (
              <div className="border-t border-theme-border">
                {cat.types.map((type) => (
                  <div key={type.id} className="px-4 py-3 border-b border-theme-border last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {editingType === type.id ? (
                          <div className="flex items-center gap-2 mb-2">
                            <Input value={editTypeName} onChange={setEditTypeName} className="w-48" onKeyDown={(e) => { if (e.key === 'Enter') saveTypeName(type.id); if (e.key === 'Escape') setEditingType(null); }} />
                            <button onClick={() => saveTypeName(type.id)} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                            <button onClick={() => setEditingType(null)} className="p-1 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-theme-sm font-medium text-theme-text">{type.name}</p>
                            <button onClick={() => { setEditingType(type.id); setEditTypeName(type.name); }} className="p-0.5 text-theme-text-subtle hover:text-theme-text transition-colors"><Edit2 size={11} /></button>
                            {!typesWithSchema.has(type.id) && (
                              <span title="No naming schema defined" className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                <AlertTriangle size={10} /> no schema
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {type.fields.map((f) => (
                            <span key={f.id} className="group/field inline-flex items-center gap-1 px-1.5 py-0.5 bg-theme-bg border border-theme-border rounded text-theme-xs text-theme-text-muted">
                              {f.name}
                              <button onClick={() => removeField(type.id, f.id)} className="opacity-0 group-hover/field:opacity-100 transition-opacity text-theme-text-subtle hover:text-theme-danger"><X size={9} /></button>
                            </span>
                          ))}
                          {addingField === type.id ? (
                            <span className="inline-flex items-center gap-1">
                              <Input value={newFieldName} onChange={setNewFieldName} placeholder="Field name" className="w-28 py-0.5 px-1.5 text-theme-xs h-auto" onKeyDown={(e) => { if (e.key === 'Enter') addField(type.id); if (e.key === 'Escape') { setAddingField(null); setNewFieldName(''); } }} />
                              <button onClick={() => addField(type.id)} className="p-0.5 text-emerald-600 hover:text-emerald-700"><Check size={11} /></button>
                              <button onClick={() => { setAddingField(null); setNewFieldName(''); }} className="p-0.5 text-theme-text-subtle hover:text-theme-text"><X size={11} /></button>
                            </span>
                          ) : (
                            <button onClick={() => { setAddingField(type.id); setNewFieldName(''); }} className="px-1.5 py-0.5 border border-dashed border-theme-border rounded text-theme-xs text-theme-text-subtle hover:text-theme-primary hover:border-theme-primary transition-colors">+ field</button>
                          )}
                        </div>
                      </div>
                      <button onClick={() => removeType(cat.id, type.id)} className="p-1.5 text-theme-text-subtle hover:text-theme-danger transition-colors ml-2 shrink-0"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2.5">
                  {addingType === cat.id ? (
                    <div className="flex items-center gap-2">
                      <Input value={newTypeName} onChange={setNewTypeName} placeholder="Type name" className="w-44" onKeyDown={(e) => { if (e.key === 'Enter') addType(cat.id); if (e.key === 'Escape') { setAddingType(null); setNewTypeName(''); } }} />
                      <button onClick={() => addType(cat.id)} className="p-1.5 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                      <button onClick={() => { setAddingType(null); setNewTypeName(''); }} className="p-1.5 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingType(cat.id); setNewTypeName(''); }} className="text-theme-xs text-theme-primary hover:text-theme-primary-hover flex items-center gap-1 transition-colors"><Plus size={12} /> Add type</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {addingCat ? (
          <div className="flex items-center gap-2 mt-2">
            <Input value={newCatName} onChange={setNewCatName} placeholder="Category name" className="w-52" onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') { setAddingCat(false); setNewCatName(''); } }} />
            <button onClick={addCategory} className="p-1.5 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
            <button onClick={() => { setAddingCat(false); setNewCatName(''); }} className="p-1.5 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
          </div>
        ) : (
          <button onClick={() => setAddingCat(true)} className="flex items-center gap-2 text-theme-sm text-theme-primary hover:text-theme-primary-hover mt-2 transition-colors"><Plus size={14} /> Add category</button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Naming Schemas Tab
// ---------------------------------------------------------------------------

function NamingTab() {
  const { assetCategories, namingSchemas: schemas, setNamingSchemas: setSchemas } = useContext(SettingsContext);

  // Flat list of all asset types from the Asset Types tab
  const allTypes = assetCategories.flatMap(c => c.types);
  const typesWithSchema = new Set(schemas.map(s => s.typeId));
  const missingCount = allTypes.filter(t => !typesWithSchema.has(t.id)).length;

  const [addingForType, setAddingForType] = useState<string | null>(null); // typeId
  const emptyNew = (typeId: string) => ({ typeId, prefix: '', start: 1, end: null as number | null, padding: 4, org: 'All' });
  const [newSchema, setNewSchema] = useState(emptyNew(''));

  const addSchema = () => {
    if (!newSchema.typeId || !newSchema.prefix.trim()) return;
    setSchemas(s => [...s, { ...newSchema, id: Date.now().toString(), used: 0, capacity: newSchema.end }]);
    setAddingForType(null);
  };
  const removeSchema = (id: string) => setSchemas(s => s.filter(x => x.id !== id));

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-theme-lg font-semibold text-theme-text">Naming Schemas</h2>
          <p className="text-theme-xs text-theme-text-muted mt-0.5">Auto-generated inventory numbers per asset type. Once assigned, numbers are never reused.</p>
        </div>
        {missingCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-theme-xs shrink-0">
            <AlertTriangle size={13} />
            {missingCount} asset type{missingCount > 1 ? 's' : ''} without a schema
          </div>
        )}
      </div>

      <div className="space-y-2">
        {assetCategories.map(cat => (
          <div key={cat.id}>
            <p className="text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider mb-1.5 px-1">{cat.name}</p>
            <div className="border border-theme-border rounded-lg overflow-hidden mb-3">
              <table className="w-full text-theme-sm">
                <thead>
                  <tr className="border-b border-theme-border bg-theme-bg">
                    {['Asset Type', 'Prefix', 'Range', 'Capacity', 'Org', ''].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cat.types.map(type => {
                    const schema = schemas.find(s => s.typeId === type.id);
                    const pct = schema?.capacity ? Math.round((schema.used / schema.capacity) * 100) : null;
                    return (
                      <React.Fragment key={type.id}>
                        {schema ? (
                          <tr className="border-b border-theme-border last:border-0 hover:bg-theme-surface-hover">
                            <td className="px-4 py-3 font-medium text-theme-text">{type.name}</td>
                            <td className="px-4 py-3"><code className="text-theme-xs bg-theme-bg px-1.5 py-0.5 rounded text-theme-primary border border-theme-border">{schema.prefix}</code></td>
                            <td className="px-4 py-3 text-theme-xs text-theme-text-muted">
                              {String(schema.start).padStart(schema.padding, '0')} → {schema.end ? String(schema.end).padStart(schema.padding, '0') : '∞'}
                            </td>
                            <td className="px-4 py-3">
                              {schema.capacity ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-1.5 bg-theme-bg rounded-full overflow-hidden border border-theme-border">
                                    <div className={`h-full rounded-full ${pct! > 80 ? 'bg-amber-400' : 'bg-theme-primary'}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-theme-xs text-theme-text-muted">{schema.used}/{schema.capacity}</span>
                                </div>
                              ) : <span className="text-theme-xs text-theme-text-subtle">Unlimited</span>}
                            </td>
                            <td className="px-4 py-3 text-theme-xs text-theme-text-muted">{schema.org}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => removeSchema(schema.id)} className="p-1 text-theme-text-subtle hover:text-theme-danger transition-colors"><Trash2 size={13} /></button>
                            </td>
                          </tr>
                        ) : addingForType === type.id ? (
                          <tr className="border-b border-theme-border bg-theme-bg">
                            <td className="px-4 py-2 text-theme-sm font-medium text-theme-text">{type.name}</td>
                            <td className="px-4 py-2"><Input value={newSchema.prefix} onChange={(v) => setNewSchema(s => ({ ...s, prefix: v }))} placeholder="PREFIX-" className="w-24" /></td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1">
                                <Input value={String(newSchema.start)} onChange={(v) => setNewSchema(s => ({ ...s, start: parseInt(v) || 1 }))} className="w-14" placeholder="1" />
                                <span className="text-theme-text-subtle text-theme-xs">→</span>
                                <Input value={newSchema.end !== null ? String(newSchema.end) : ''} onChange={(v) => setNewSchema(s => ({ ...s, end: v ? parseInt(v) || null : null }))} placeholder="∞" className="w-14" />
                              </div>
                            </td>
                            <td className="px-4 py-2"><span className="text-theme-xs text-theme-text-subtle">—</span></td>
                            <td className="px-4 py-2"><Input value={newSchema.org} onChange={(v) => setNewSchema(s => ({ ...s, org: v }))} placeholder="All" className="w-20" /></td>
                            <td className="px-4 py-2">
                              <div className="flex gap-1">
                                <button onClick={addSchema} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                                <button onClick={() => setAddingForType(null)} className="p-1 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr className="border-b border-theme-border last:border-0 bg-amber-50/50 hover:bg-amber-50">
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-2 text-theme-sm text-amber-700">
                                <AlertTriangle size={12} className="shrink-0" /> {type.name}
                              </span>
                            </td>
                            <td colSpan={4} className="px-4 py-2.5 text-theme-xs text-amber-600 italic">No naming schema defined</td>
                            <td className="px-4 py-2.5">
                              <button onClick={() => { setAddingForType(type.id); setNewSchema(emptyNew(type.id)); }}
                                className="flex items-center gap-1 text-theme-xs text-theme-primary hover:text-theme-primary-hover transition-colors">
                                <Plus size={11} /> Add
                              </button>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reference Data Tab — full CRUD with inline edit
// ---------------------------------------------------------------------------

interface RefItem { id: string; value: string; color: string; description: string; }
interface RefGroup { key: string; label: string; items: RefItem[]; }

function ReferenceDataTab() {
  const [groups, setGroups] = useState<RefGroup[]>([
    { key: 'classification', label: 'Classification Levels', items: [{ id: '1', value: 'PUBLIC', color: '#22c55e', description: 'Visible to all' }, { id: '2', value: 'INTERNAL', color: '#3b82f6', description: 'Internal use only' }, { id: '3', value: 'CONFIDENTIAL', color: '#f59e0b', description: 'Restricted access' }, { id: '4', value: 'SECRET', color: '#ef4444', description: 'Need-to-know basis' }] },
    { key: 'employee_tags', label: 'Employee Tags', items: [{ id: '5', value: 'VIP', color: '#a855f7', description: 'Priority service' }, { id: '6', value: 'ADMIN', color: '#3b82f6', description: 'System administrator' }, { id: '7', value: 'CONTRACTOR', color: '#f59e0b', description: 'External contractor' }] },
    { key: 'asset_conditions', label: 'Asset Conditions', items: [{ id: '8', value: 'New', color: '#22c55e', description: 'Unused, in original packaging' }, { id: '9', value: 'Good', color: '#3b82f6', description: 'Fully functional, minor wear' }, { id: '10', value: 'Fair', color: '#f59e0b', description: 'Functional, visible wear' }, { id: '11', value: 'Damaged', color: '#ef4444', description: 'Needs repair' }] },
    { key: 'wo_types', label: 'Work Order Types', items: [{ id: '12', value: 'Repair', color: '#ef4444', description: 'Fix broken or malfunctioning assets' }, { id: '13', value: 'Installation', color: '#3b82f6', description: 'Set up new hardware or software' }, { id: '14', value: 'Decommission', color: '#64748b', description: 'Retire and dispose of assets' }, { id: '15', value: 'Transfer', color: '#a855f7', description: 'Move asset between locations or users' }, { id: '16', value: 'Inspection', color: '#f59e0b', description: 'Routine check or compliance audit' }, { id: '17', value: 'Software Update', color: '#06b6d4', description: 'OS, firmware, or application update' }, { id: '18', value: 'Preventive Maintenance', color: '#22c55e', description: 'Scheduled maintenance to prevent failure' }] },
  ]);
  const [expanded, setExpanded] = useState<string | null>('classification');
  const [editingItem, setEditingItem] = useState<string | null>(null); // item id
  const [editVal, setEditVal] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('');
  const [addingInGroup, setAddingInGroup] = useState<string | null>(null); // group key
  const [newVal, setNewVal] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState('');

  const startEdit = (item: RefItem) => { setEditingItem(item.id); setEditVal(item.value); setEditDesc(item.description); setEditColor(item.color); };
  const saveEdit = (groupKey: string) => {
    setGroups(gs => gs.map(g => g.key === groupKey ? { ...g, items: g.items.map(i => i.id === editingItem ? { ...i, value: editVal, description: editDesc, color: editColor } : i) } : g));
    setEditingItem(null);
  };
  const removeItem = (groupKey: string, itemId: string) =>
    setGroups(gs => gs.map(g => g.key === groupKey ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g));
  const addItem = (groupKey: string) => {
    if (!newVal.trim()) return;
    setGroups(gs => gs.map(g => g.key === groupKey ? { ...g, items: [...g.items, { id: Date.now().toString(), value: newVal.trim(), description: newDesc.trim(), color: newColor }] } : g));
    setNewVal(''); setNewDesc(''); setNewColor('#6b7280'); setAddingInGroup(null);
  };
  const removeGroup = (groupKey: string) => setGroups(gs => gs.filter(g => g.key !== groupKey));
  const addGroup = () => {
    if (!newGroupLabel.trim()) return;
    setGroups(gs => [...gs, { key: Date.now().toString(), label: newGroupLabel.trim(), items: [] }]);
    setNewGroupLabel(''); setAddingGroup(false);
  };

  return (
    <div className="max-w-2xl">
      <SectionHeader title="Reference Data" description="Tenant-managed lookup lists used across the application" />
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.key} className="border border-theme-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 hover:bg-theme-surface-hover transition-colors">
              <button className="flex items-center gap-2 flex-1 text-left" onClick={() => setExpanded(expanded === g.key ? null : g.key)}>
                <span className="text-theme-sm font-medium text-theme-text">{g.label}</span>
                <span className="text-theme-xs text-theme-text-subtle">{g.items.length} items</span>
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => removeGroup(g.key)} className="p-1.5 text-theme-text-subtle hover:text-theme-danger transition-colors"><Trash2 size={12} /></button>
                <ChevronRight size={14} className={`text-theme-text-subtle transition-transform ${expanded === g.key ? 'rotate-90' : ''}`} />
              </div>
            </div>
            {expanded === g.key && (
              <div className="border-t border-theme-border px-4 py-3 space-y-2">
                {g.items.map((item) => (
                  <div key={item.id}>
                    {editingItem === item.id ? (
                      <div className="flex items-center gap-2">
                        <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 shrink-0" />
                        <Input value={editVal} onChange={setEditVal} className="w-28" onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(g.key); if (e.key === 'Escape') setEditingItem(null); }} />
                        <Input value={editDesc} onChange={setEditDesc} className="flex-1" placeholder="Description" onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(g.key); if (e.key === 'Escape') setEditingItem(null); }} />
                        <button onClick={() => saveEdit(g.key)} className="p-1 text-emerald-600 hover:text-emerald-700 shrink-0"><Check size={13} /></button>
                        <button onClick={() => setEditingItem(null)} className="p-1 text-theme-text-subtle hover:text-theme-text shrink-0"><X size={13} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 group/item">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-theme-sm font-medium text-theme-text w-28">{item.value}</span>
                        <span className="text-theme-xs text-theme-text-muted flex-1">{item.description}</span>
                        <button onClick={() => startEdit(item)} className="p-1 text-theme-text-subtle hover:text-theme-text transition-colors opacity-0 group-hover/item:opacity-100"><Edit2 size={12} /></button>
                        <button onClick={() => removeItem(g.key, item.id)} className="p-1 text-theme-text-subtle hover:text-theme-danger transition-colors opacity-0 group-hover/item:opacity-100"><Trash2 size={12} /></button>
                      </div>
                    )}
                  </div>
                ))}
                {addingInGroup === g.key ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 shrink-0" />
                    <Input value={newVal} onChange={setNewVal} placeholder="Value" className="w-28" onKeyDown={(e) => { if (e.key === 'Enter') addItem(g.key); if (e.key === 'Escape') { setAddingInGroup(null); setNewVal(''); setNewDesc(''); } }} />
                    <Input value={newDesc} onChange={setNewDesc} placeholder="Description" className="flex-1" onKeyDown={(e) => { if (e.key === 'Enter') addItem(g.key); if (e.key === 'Escape') { setAddingInGroup(null); setNewVal(''); setNewDesc(''); } }} />
                    <button onClick={() => addItem(g.key)} className="p-1 text-emerald-600 hover:text-emerald-700 shrink-0"><Check size={13} /></button>
                    <button onClick={() => { setAddingInGroup(null); setNewVal(''); setNewDesc(''); }} className="p-1 text-theme-text-subtle hover:text-theme-text shrink-0"><X size={13} /></button>
                  </div>
                ) : (
                  <button onClick={() => { setAddingInGroup(g.key); setNewVal(''); setNewDesc(''); setNewColor('#6b7280'); }} className="flex items-center gap-1.5 text-theme-xs text-theme-primary hover:text-theme-primary-hover mt-1 transition-colors"><Plus size={12} /> Add item</button>
                )}
              </div>
            )}
          </div>
        ))}
        {addingGroup ? (
          <div className="flex items-center gap-2 mt-2">
            <Input value={newGroupLabel} onChange={setNewGroupLabel} placeholder="Group name" className="w-52" onKeyDown={(e) => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') { setAddingGroup(false); setNewGroupLabel(''); } }} />
            <button onClick={addGroup} className="p-1.5 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
            <button onClick={() => { setAddingGroup(false); setNewGroupLabel(''); }} className="p-1.5 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
          </div>
        ) : (
          <button onClick={() => setAddingGroup(true)} className="flex items-center gap-2 text-theme-sm text-theme-primary hover:text-theme-primary-hover mt-2 transition-colors"><Plus size={14} /> Add group</button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Certificates Tab
// ---------------------------------------------------------------------------

function CertificatesTab() {
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
// Permissions Tab
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
  '1': new Set(ALL_PERMS), // Super Admin — everything
  '2': new Set([ // Asset Manager
    'asset:read','asset:write','asset:delete','asset:decommission','asset:costs:read','asset:import',
    'location:read','location:write','employee:read','employee:write',
    'supply:read','supply:write','supply:movements',
    'wo:read','wo:write','wo:close',
    'storage:read','storage:write','certificate:read','certificate:write',
    'report:read','report:run','user:read','settings:read','audit:read',
  ]),
  '3': new Set([ // Viewer
    'asset:read','location:read','employee:read','supply:read','wo:read',
    'storage:read','certificate:read','report:read',
  ]),
  '4': new Set([ // IT Technician
    'asset:read','asset:write','asset:decommission',
    'location:read','employee:read',
    'wo:read','wo:write','wo:close',
    'supply:read','supply:movements',
    'storage:read','certificate:read','report:read',
  ]),
  '5': new Set([ // Warehouse
    'asset:read','location:read',
    'supply:read','supply:write','supply:movements',
    'storage:read','storage:write',
    'wo:read',
  ]),
};

function PermissionsTab() {
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
      {/* Left: role list */}
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

      {/* Right: permission matrix */}
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

function AutomationTab() {
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

// ---------------------------------------------------------------------------
// Users Tab
// ---------------------------------------------------------------------------

interface OrgUser { id: string; name: string; email: string; role: string; roleSource: 'manual' | 'ldap' | 'saml'; status: 'active' | 'invited' | 'deactivated'; lastLogin: string; }

function UsersTab() {
  const { isOrg } = useContext(SettingsContext);
  const [users, setUsers] = useState<OrgUser[]>([
    { id: '1', name: 'Ivan Horvat',        email: 'ivan.horvat@posta.hr',        role: 'Super Admin',   roleSource: 'manual', status: 'active',      lastLogin: '2026-04-12 09:14' },
    { id: '2', name: 'Maja Kovač',         email: 'maja.kovac@posta.hr',         role: 'Asset Manager', roleSource: 'ldap',   status: 'active',      lastLogin: '2026-04-11 14:22' },
    { id: '3', name: 'Tomislav Blažević',  email: 'tomislav.blazevic@posta.hr',  role: 'IT Technician', roleSource: 'ldap',   status: 'active',      lastLogin: '2026-04-10 08:55' },
    { id: '4', name: 'Ana Marić',          email: 'ana.maric@posta.hr',          role: 'Viewer',        roleSource: 'saml',   status: 'active',      lastLogin: '2026-04-09 16:40' },
    { id: '5', name: 'Nikola Šimić',       email: 'nikola.simic@posta.hr',       role: 'Warehouse',     roleSource: 'manual', status: 'invited',     lastLogin: '—' },
    { id: '6', name: 'Petra Babić',        email: 'petra.babic@posta.hr',        role: 'Viewer',        roleSource: 'manual', status: 'deactivated', lastLogin: '2026-02-15 11:30' },
  ]);
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
      const hayWords = hay.split(/[\s.,@_\-]+/).filter(Boolean);
      const matches = search.trim().toLowerCase().split(/\s+/).every(qw =>
        hayWords.some(hw => hw.startsWith(qw))
      );
      if (!matches) return false;
    }
    return true;
  });

  const setRole = (id: string, role: string) => { setUsers(us => us.map(u => u.id === id ? { ...u, role } : u)); setEditingRole(null); };
  const deactivate = (id: string) => setUsers(us => us.map(u => u.id === id ? { ...u, status: 'deactivated' } : u));
  const reactivate = (id: string) => setUsers(us => us.map(u => u.id === id ? { ...u, status: 'active' } : u));
  const sendInvite = () => {
    if (!inviteEmail.trim()) return;
    setUsers(us => [...us, { id: Date.now().toString(), name: inviteEmail.split('@')[0], email: inviteEmail.trim(), role: inviteRole, orgs: [], status: 'invited', lastLogin: '—' }]);
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
                      <span title={`Role is managed by ${u.roleSource.toUpperCase()} group binding. Change mappings in SSO → ${u.roleSource === 'ldap' ? 'LDAP → Advanced' : 'SAML'}.`}
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

function AuditTab() {
  return (
    <div className="max-w-lg flex flex-col items-center justify-center py-20 mx-auto text-center">
      <div className="w-12 h-12 bg-theme-bg border border-theme-border rounded-full flex items-center justify-center mb-4">
        <FileText size={20} className="text-theme-text-muted" />
      </div>
      <p className="text-theme-text font-medium mb-1">Audit Log</p>
      <p className="text-theme-sm text-theme-text-muted">Full audit trail of all settings changes, user actions, and system events. Coming in Phase 3.</p>
    </div>
  );
}

function PrintingTab() {
  return (
    <div className="max-w-lg flex flex-col items-center justify-center py-20 mx-auto text-center">
      <div className="w-12 h-12 bg-theme-bg border border-theme-border rounded-full flex items-center justify-center mb-4">
        <Tag size={20} className="text-theme-text-muted" />
      </div>
      <p className="text-theme-text font-medium mb-1">Barcode & Printing</p>
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

function ReportsTab() {
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
      {/* Left list */}
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

      {/* Right panel */}
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
          {/* General */}
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

          {/* Schedule */}
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
                    placeholder="email@company.com, email2@company.com"
                    className="flex-1 text-theme-sm bg-theme-bg border border-theme-border rounded px-3 py-1.5 focus:outline-none focus:border-theme-primary text-theme-text" />
                </div>
              )}
            </div>
          </div>

          {/* Templates */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider">Templates</p>
              <button onClick={() => setAddingTemplate(true)} className="flex items-center gap-1 text-theme-xs text-theme-primary hover:text-theme-primary-hover transition-colors">
                <Plus size={11} /> Add template
              </button>
            </div>
            <div className="border border-theme-border rounded-lg overflow-hidden">
              {cur.templates.map((t, i) => (
                <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${i < cur.templates.length - 1 ? 'border-b border-theme-border' : ''}`}>
                  <input type="radio" name={`tmpl-${cur.id}`} checked={cur.activeTemplateId === t.id}
                    onChange={() => update(cur.id, { activeTemplateId: t.id })}
                    className="accent-[var(--t-primary)] shrink-0" />
                  <span className="text-theme-sm text-theme-text flex-1">{t.name}</span>
                  {t.isDefault
                    ? <span className="text-theme-xs text-theme-text-subtle">built-in</span>
                    : (
                      <div className="flex items-center gap-1">
                        <button className="px-2 py-0.5 text-theme-xs border border-theme-border rounded text-theme-text-muted hover:text-theme-text hover:border-theme-border-strong transition-colors">Edit</button>
                        <button onClick={() => removeTemplate(t.id)} className="p-1 text-theme-text-subtle hover:text-theme-danger transition-colors"><Trash2 size={12} /></button>
                      </div>
                    )
                  }
                </div>
              ))}
              {addingTemplate && (
                <div className="flex items-center gap-2 px-4 py-2.5 border-t border-theme-border bg-theme-bg">
                  <input autoFocus value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTemplate(); if (e.key === 'Escape') { setAddingTemplate(false); setNewTemplateName(''); } }}
                    placeholder="Template name" className="flex-1 text-theme-xs bg-theme-surface border border-theme-border rounded px-2 py-1 focus:outline-none focus:border-theme-primary" />
                  <button onClick={addTemplate} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                  <button onClick={() => { setAddingTemplate(false); setNewTemplateName(''); }} className="p-1 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
                </div>
              )}
            </div>
            <p className="text-theme-xs text-theme-text-subtle mt-2">Selected template controls the layout, branding, and column order of generated reports.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const NAV_GROUPS_TENANT: NavGroup[] = [
  { label: 'Account', items: [
    { id: 'general',      label: 'General',        icon: <Building2 size={14} /> },
    { id: 'legal',        label: 'Legal',          icon: <Scale size={14} /> },
  ]},
  { label: 'Security & Access', items: [
    { id: 'security',     label: 'Security',       icon: <Shield size={14} /> },
    { id: 'sso',          label: 'SSO / Identity', icon: <KeyRound size={14} /> },
    { id: 'permissions',  label: 'Permissions',    icon: <Users size={14} /> },
  ]},
  { label: 'Organization', items: [
    { id: 'modules',      label: 'Modules',        icon: <Puzzle size={14} /> },
    { id: 'users',        label: 'Users',          icon: <Users size={14} /> },
  ]},
  { label: 'Asset Data', items: [
    { id: 'asset_types',  label: 'Asset Types',    icon: <Layers size={14} /> },
    { id: 'naming',       label: 'Naming Schemas', icon: <Tag size={14} /> },
    { id: 'reference',    label: 'Reference Data', icon: <Database size={14} /> },
  ]},
  { label: 'Operations', items: [
    { id: 'certificates', label: 'Certificates',   icon: <Award size={14} /> },
    { id: 'integrations', label: 'Integrations',   icon: <Zap size={14} /> },
    { id: 'automation',   label: 'Automation',     icon: <Bot size={14} /> },
    { id: 'reports',      label: 'Reports',        icon: <BarChart2 size={14} /> },
    { id: 'audit',        label: 'Audit Log',      icon: <FileText size={14} /> },
  ]},
  { label: 'Hardware', items: [
    { id: 'printing',     label: 'Barcode & Print',icon: <Tag size={14} /> },
  ]},
];

const NAV_GROUPS_ORG: NavGroup[] = [
  { label: 'Account', items: [
    { id: 'general',      label: 'General',        icon: <Building2 size={14} /> },
    { id: 'legal',        label: 'Legal',          icon: <Scale size={14} /> },
  ]},
  { label: 'Security & Access', items: [
    { id: 'security',     label: 'Security',       icon: <Shield size={14} /> },
    { id: 'sso',          label: 'SSO / Identity', icon: <KeyRound size={14} /> },
  ]},
  { label: 'Organization', items: [
    { id: 'users',        label: 'Users',          icon: <Users size={14} /> },
  ]},
  { label: 'Asset Data', items: [
    { id: 'asset_types',  label: 'Asset Types',    icon: <Layers size={14} /> },
    { id: 'naming',       label: 'Naming Schemas', icon: <Tag size={14} /> },
    { id: 'reference',    label: 'Reference Data', icon: <Database size={14} /> },
  ]},
  { label: 'Operations', items: [
    { id: 'certificates', label: 'Certificates',   icon: <Award size={14} /> },
    { id: 'integrations', label: 'Integrations',   icon: <Zap size={14} /> },
    { id: 'reports',      label: 'Reports',        icon: <BarChart2 size={14} /> },
    { id: 'audit',        label: 'Audit Log',      icon: <FileText size={14} /> },
  ]},
];

interface TenantSettingsProps {
  type?: 'tenant' | 'org';
  entityName?: string;
  onBack?: () => void;
}

export default function TenantSettings({ type = 'tenant', entityName = 'Hrvatska Pošta d.d.', onBack: _onBack }: TenantSettingsProps = {}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onBack = _onBack;
  const NAV_GROUPS = type === 'org' ? NAV_GROUPS_ORG : NAV_GROUPS_TENANT;
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [assetCategories, setAssetCategories] = useState<AssetCategory[]>(INITIAL_CATEGORIES);
  const [namingSchemas, setNamingSchemas] = useState<NamingSchema[]>(INITIAL_SCHEMAS);
  const [tenantConfig, setTenantConfig] = useState<TenantConfigData | null>(null);
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch tenant config on mount
  useEffect(() => {
    apiFetch<TenantConfigData>('/tenants/config').then(setTenantConfig).catch(() => {});
  }, []);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return SEARCH_INDEX.filter(r => r.label.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.tabLabel.toLowerCase().includes(q)).slice(0, 8);
  }, [search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const goToSetting = (r: SearchResult) => { setActiveTab(r.tab); setSearch(''); setShowResults(false); };

  const TAB_CONTENT_MAP: Partial<Record<TabId, React.ComponentType>> = {
    general: type === 'org' ? GeneralOrgTab : GeneralTab,
    legal: LegalTab, security: SecurityTab, sso: SSOTab,
    modules: ModulesTab, users: UsersTab,
    integrations: IntegrationsTab, asset_types: AssetTypesTab,
    naming: NamingTab, reference: ReferenceDataTab,
    certificates: CertificatesTab, permissions: PermissionsTab,
    automation: AutomationTab, audit: AuditTab, printing: PrintingTab,
    reports: ReportsTab,
  };
  const TabContent = TAB_CONTENT_MAP[activeTab];

  // These tabs have their own internal master-detail layout and handle padding themselves
  const fullBleedTabs: TabId[] = ['sso', 'permissions', 'integrations', 'reports'];
  const isFullBleed = fullBleedTabs.includes(activeTab);

  return (
    <SettingsContext.Provider value={{ isOrg: type === 'org', tenantConfig, setTenantConfig, assetCategories, setAssetCategories, namingSchemas, setNamingSchemas }}>
      <div className="flex flex-col bg-theme-bg h-full min-h-full">

        {/* Top header — compact, no tab bar */}
        <div className="px-6 py-4 border-b border-theme-border bg-theme-surface flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button onClick={onBack} className="flex items-center gap-1 text-theme-xs text-theme-text-subtle hover:text-theme-text transition-colors shrink-0">
                <ChevronRight size={12} className="rotate-180" /> Back
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-theme-base font-semibold text-theme-text leading-tight">{type === 'org' ? 'Organization Settings' : 'Tenant Settings'}</h1>
              <p className="text-theme-xs text-theme-text-muted leading-tight">{tenantConfig?.name ?? entityName}</p>
            </div>
          </div>

          <div ref={searchRef} className="relative w-64 shrink-0">
            <div className="flex items-center gap-2 bg-theme-bg border border-theme-border rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-theme-primary transition-all">
              <Search size={13} className="text-theme-text-subtle shrink-0" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setSearch(''); setShowResults(false); } }}
                placeholder="Search settings…"
                className="flex-1 bg-transparent text-theme-sm text-theme-text placeholder-theme-text-subtle focus:outline-none"
              />
              {search && <button onClick={() => { setSearch(''); setShowResults(false); }} className="text-theme-text-subtle hover:text-theme-text transition-colors"><X size={12} /></button>}
            </div>
            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full right-0 w-80 mt-1 bg-theme-surface border border-theme-border rounded-lg shadow-lg z-50 overflow-hidden">
                {searchResults.map((r, i) => (
                  <button key={i} onClick={() => goToSetting(r)} className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-theme-surface-hover transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-theme-sm text-theme-text">{r.label}</span>
                        <span className="text-theme-xs text-theme-text-muted">{r.tabLabel}</span>
                      </div>
                      <p className="text-theme-xs text-theme-text-subtle truncate">{r.description}</p>
                    </div>
                    <ChevronRight size={12} className="text-theme-text-subtle mt-0.5 shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {showResults && search && searchResults.length === 0 && (
              <div className="absolute top-full right-0 w-80 mt-1 bg-theme-surface border border-theme-border rounded-lg shadow-lg z-50 px-3 py-4 text-center">
                <p className="text-theme-sm text-theme-text-subtle">No settings found for "{search}"</p>
              </div>
            )}
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 min-h-0">

          {/* Left sidebar nav */}
          <nav className="w-48 shrink-0 border-r border-theme-border bg-theme-surface overflow-y-auto py-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-4">
                <p className="px-4 mb-1 text-[10px] font-semibold text-theme-text-subtle uppercase tracking-widest">{group.label}</p>
                {group.items.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-theme-sm transition-colors ${
                      activeTab === tab.id
                        ? 'bg-theme-primary/8 text-theme-primary font-medium'
                        : 'text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text'
                    }`}
                  >
                    <span className={activeTab === tab.id ? 'text-theme-primary' : 'text-theme-text-subtle'}>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* Content area */}
          <main className={`flex-1 min-w-0 overflow-auto ${isFullBleed ? '' : 'px-8 py-8'}`}>
            {TabContent ? <TabContent /> : (
              <div className="flex items-center justify-center h-40 text-theme-text-subtle text-theme-sm">Not found</div>
            )}
          </main>

        </div>
      </div>
    </SettingsContext.Provider>
  );
}
