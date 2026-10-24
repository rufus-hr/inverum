import React, { useState, useRef, createContext } from 'react';
import {
  RotateCcw, Link2, ChevronRight, Check, Upload, X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Shared Context & Types
// ---------------------------------------------------------------------------

export interface AssetField    { id: string; name: string; }
export interface AssetType     { id: string; name: string; fields: AssetField[]; }
export interface AssetCategory { id: string; name: string; types: AssetType[]; }
export interface NamingSchema  {
  id: string;
  typeId: string;
  prefix: string;
  start: number;
  end: number | null;
  padding: number;
  used: number;
  capacity: number | null;
  org: string;
}

export interface TenantConfigData {
  tenant_id: string;
  name: string;
  code: string;
  settings: {
    currency?: string;
    timezone?: string;
    date_format?: string;
    language?: string;
    fiscal_year_start?: string;
  };
  modules: Record<string, boolean>;
}

export const INITIAL_CATEGORIES: AssetCategory[] = [
  { id: 'c1', name: 'IT Equipment', types: [
    { id: 't1', name: 'Laptop',  fields: [{ id: 'f1', name: 'Serial Number' }, { id: 'f2', name: 'MAC Address' }, { id: 'f3', name: 'RAM' }, { id: 'f4', name: 'CPU' }, { id: 'f5', name: 'Storage' }, { id: 'f6', name: 'OS' }] },
    { id: 't2', name: 'Desktop', fields: [{ id: 'f7', name: 'Serial Number' }, { id: 'f8', name: 'MAC Address' }, { id: 'f9', name: 'RAM' }, { id: 'f10', name: 'CPU' }] },
    { id: 't3', name: 'Monitor', fields: [{ id: 'f11', name: 'Serial Number' }, { id: 'f12', name: 'Screen Size' }, { id: 'f13', name: 'Resolution' }] },
    { id: 't4', name: 'Server',  fields: [{ id: 'f14', name: 'Serial Number' }, { id: 'f15', name: 'Hostname' }, { id: 'f16', name: 'IP Address' }, { id: 'f17', name: 'Rack Unit' }, { id: 'f18', name: 'BMC IP' }] },
    { id: 't5', name: 'Phone',   fields: [{ id: 'f19', name: 'IMEI' }, { id: 'f20', name: 'Phone Number' }, { id: 'f21', name: 'Carrier' }] },
    { id: 't6', name: 'Printer', fields: [{ id: 'f22', name: 'Serial Number' }, { id: 'f23', name: 'IP Address' }, { id: 'f24', name: 'Model' }] },
  ]},
  { id: 'c2', name: 'Vehicles', types: [
    { id: 't7', name: 'Car', fields: [{ id: 'f25', name: 'License Plate' }, { id: 'f26', name: 'VIN' }, { id: 'f27', name: 'Fuel Type' }, { id: 'f28', name: 'Registration Expiry' }] },
    { id: 't8', name: 'Van', fields: [{ id: 'f29', name: 'License Plate' }, { id: 'f30', name: 'VIN' }, { id: 'f31', name: 'Max Payload (kg)' }] },
  ]},
  { id: 'c3', name: 'Tools & Measuring', types: [
    { id: 't9',  name: 'Power Tool',       fields: [{ id: 'f32', name: 'Serial Number' }, { id: 'f33', name: 'Voltage' }, { id: 'f34', name: 'Safety Cert Date' }] },
    { id: 't10', name: 'Measuring Device', fields: [{ id: 'f35', name: 'Serial Number' }, { id: 'f36', name: 'Calibration Date' }, { id: 'f37', name: 'CalibrationDue' }] },
  ]},
  { id: 'c4', name: 'Safety Equipment', types: [
    { id: 't11', name: 'Fire Extinguisher', fields: [{ id: 'f38', name: 'Serial Number' }, { id: 'f39', name: 'Type (CO2/Foam/Powder)' }, { id: 'f40', name: 'Inspection Due' }] },
  ]},
  { id: 'c5', name: 'Network Equipment', types: [
    { id: 't12', name: 'Network Switch', fields: [{ id: 'f41', name: 'Serial Number' }, { id: 'f42', name: 'Hostname' }, { id: 'f43', name: 'IP Address' }, { id: 'f44', name: 'Port Count' }, { id: 'f45', name: 'Rack Unit' }] },
    { id: 't13', name: 'Firewall',       fields: [{ id: 'f46', name: 'Serial Number' }, { id: 'f47', name: 'Hostname' }, { id: 'f48', name: 'IP Address' }, { id: 'f49', name: 'Firmware Version' }] },
    { id: 't14', name: 'Access Point',   fields: [{ id: 'f50', name: 'Serial Number' }, { id: 'f51', name: 'MAC Address' }, { id: 'f52', name: 'IP Address' }, { id: 'f53', name: 'SSID' }] },
    { id: 't15', name: 'Router',         fields: [{ id: 'f54', name: 'Serial Number' }, { id: 'f55', name: 'Hostname' }, { id: 'f56', name: 'IP Address' }, { id: 'f57', name: 'WAN Interface' }] },
  ]},
];

export const INITIAL_NAMING_SCHEMAS: NamingSchema[] = [
  { id: '1', typeId: 't1', prefix: 'IT-LAP-', start: 1,    end: 9999, padding: 4, used: 142, capacity: 9999, org: 'All' },
  { id: '2', typeId: 't4', prefix: 'IT-SRV-', start: 1,    end: 500,  padding: 4, used: 38,  capacity: 500,  org: 'All' },
  { id: '3', typeId: 't7', prefix: 'VEH-',    start: 1000, end: 1999, padding: 4, used: 23,  capacity: 1000, org: 'HP Logistika' },
  { id: '4', typeId: 't9', prefix: 'TLS-',    start: 1,    end: null, padding: 5, used: 310, capacity: null, org: 'All' },
];

export const SettingsContext = createContext<{
  isOrg: boolean;
  assetCategories: AssetCategory[];
  setAssetCategories: React.Dispatch<React.SetStateAction<AssetCategory[]>>;
  namingSchemas: NamingSchema[];
  setNamingSchemas: React.Dispatch<React.SetStateAction<NamingSchema[]>>;
  tenantConfig: TenantConfigData | null;
  setTenantConfig: React.Dispatch<React.SetStateAction<TenantConfigData | null>>;
}>({
  isOrg: false,
  assetCategories: INITIAL_CATEGORIES,
  setAssetCategories: () => {},
  namingSchemas: INITIAL_NAMING_SCHEMAS,
  setNamingSchemas: () => {},
  tenantConfig: null,
  setTenantConfig: () => {},
});

// ---------------------------------------------------------------------------
// API Helper
// ---------------------------------------------------------------------------

export { apiFetch } from '../../lib/api';

// ---------------------------------------------------------------------------
// Shared Primitives
// ---------------------------------------------------------------------------

export const SectionHeader = ({ title, description }: { title: string; description?: string }) => (
  <div className="mb-6">
    <h2 className="text-theme-lg font-semibold text-theme-text">{title}</h2>
    {description && <p className="text-theme-xs text-theme-text-muted mt-0.5">{description}</p>}
  </div>
);

export const SettingRow = ({ label, description, children }: { label: string; description?: string; tenantValue?: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[1fr_auto] gap-x-8 items-start py-4 border-b border-theme-border last:border-0">
    <div className="min-w-0">
      <p className="text-theme-sm font-medium text-theme-text">{label}</p>
      {description && <p className="text-theme-xs text-theme-text-subtle mt-0.5">{description}</p>}
    </div>
    <div>{children}</div>
  </div>
);

export const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button onClick={() => onChange(!value)} className={`relative w-9 h-5 rounded-full transition-colors ${value ? 'bg-theme-primary' : 'bg-theme-border-strong'}`}>
    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
  </button>
);

export const Input = ({ value, onChange, placeholder, className = '', onKeyDown }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) => (
  <input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={onKeyDown}
    placeholder={placeholder}
    className={`bg-theme-bg border border-theme-border rounded-md px-3 py-1.5 text-theme-sm text-theme-text placeholder-theme-text-subtle focus:outline-none focus:border-theme-primary ${className}`}
  />
);

export const Select = ({ value, onChange, options, className = '' }: {
  value: string; onChange: (v: string) => void; options: string[]; className?: string;
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`bg-theme-bg border border-theme-border rounded-md px-3 py-1.5 text-theme-sm text-theme-text focus:outline-none focus:border-theme-primary ${className}`}
  >
    {options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
);

export const Badge = ({ children, color = 'slate' }: { children: React.ReactNode; color?: 'green' | 'amber' | 'red' | 'blue' | 'slate' }) => {
  const colors = { green: 'bg-emerald-50 text-emerald-700 border-emerald-200', amber: 'bg-amber-50 text-amber-700 border-amber-200', red: 'bg-red-50 text-red-700 border-red-200', blue: 'bg-blue-50 text-blue-700 border-blue-200', slate: 'bg-theme-bg text-theme-text-subtle border-theme-border' };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors[color]}`}>{children}</span>;
};

export const OrgSettingRow = ({ label, description, tenantValue, children, defaultOverridden = false }: {
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

export const SaveBar = ({ onSave }: { onSave: () => void }) => {
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

export const LogoUpload = ({ aspect }: { aspect: 'rect' | 'square' }) => {
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
