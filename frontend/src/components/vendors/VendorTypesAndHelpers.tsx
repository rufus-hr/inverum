import { useState, useRef, useEffect } from 'react';
import { X, Check, ChevronDown } from 'lucide-react';

// ── Types & Constants ───────────────────────────────────────────────────────

export type VendorType = 'reseller' | 'service' | 'distributor' | 'manufacturer' | 'carrier';
export type ListMode = 'list' | 'matrix';
export type ViewMode = 'list' | 'detail';
export type DetailTab = 'overview' | 'contacts' | 'contracts' | 'assets' | 'reliability' | 'financials';
export type ContractType = 'support' | 'warranty_ext' | 'maintenance' | 'framework' | 'purchase';
export type ContractStatus = 'active' | 'expiring' | 'expired' | 'draft';

export interface VendorContact {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  phone: string | null;
  notes: string | null;
  isPrimary: boolean;
}

export interface VendorContract {
  id: string;
  name: string;
  type: ContractType;
  validFrom: string;
  validTo: string;
  value: number;
  currency: string;
  autoRenew: boolean;
  status: ContractStatus;
  notes: string | null;
  linkedAssets: number;
}

export interface VendorAsset {
  id: string;
  tag: string;
  model: string;
  status: string;
  assignedTo: string | null;
  purchasedAt: string;
}

export interface ServiceRecord {
  id: string;
  date: string;
  woNumber: string;
  assetTag: string;
  issue: string;
  durationDays: number;
}

export interface ActivityEntry {
  id: string;
  date: string;
  description: string;
}

export interface Vendor {
  id: string;
  name: string;
  types: VendorType[];
  oib: string;
  phone: string;
  website: string;
  address: string;
  assetCount: number;
  spend: number;
  openWO: number;
  reliability: number | null;
  failureRate: number | null;
  mttr: number | null;
  repeatFailure: number | null;
  warrantyHonored: number | null;
  isArchived: boolean;
  contacts: VendorContact[];
  contracts: VendorContract[];
  assets: VendorAsset[];
  serviceRecords: ServiceRecord[];
  activity: ActivityEntry[];
}

export const VENDOR_TYPE_COLORS: Record<VendorType, string> = {
  reseller: 'bg-blue-100 text-blue-700',
  service: 'bg-emerald-100 text-emerald-700',
  distributor: 'bg-purple-100 text-purple-700',
  manufacturer: 'bg-slate-100 text-slate-700',
  carrier: 'bg-amber-100 text-amber-700',
};

export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  reseller: 'Reseller',
  service: 'Service',
  distributor: 'Distributor',
  manufacturer: 'Manufacturer',
  carrier: 'Carrier',
};

export const ALL_VENDOR_TYPES: VendorType[] = ['reseller', 'service', 'distributor', 'manufacturer', 'carrier'];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  support: 'Support',
  warranty_ext: 'Warranty Ext',
  maintenance: 'Maintenance',
  framework: 'Framework',
  purchase: 'Purchase',
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  active: 'bg-emerald-500',
  expiring: 'bg-amber-500',
  expired: 'bg-red-500',
  draft: 'bg-slate-400',
};

export const INDUSTRY_AVG = {
  failureRate: 4.5,
  mttr: 5.1,
  repeatFailure: 8,
  warrantyHonored: 92,
};

// ── Helper Components ───────────────────────────────────────────────────────

export function ReliabilityBar({ score, size = 'md' }: { score: number | null; size?: 'sm' | 'md' | 'lg' }) {
  if (score === null) return <span className="text-slate-400 text-sm">—</span>;

  const color = score >= 90 ? 'bg-emerald-500' : score >= 80 ? 'bg-blue-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = score >= 90 ? 'text-emerald-700' : score >= 80 ? 'text-blue-700' : score >= 60 ? 'text-amber-700' : 'text-red-700';
  const h = size === 'lg' ? 'h-4' : size === 'md' ? 'h-2.5' : 'h-2';
  const w = size === 'lg' ? 'w-32' : size === 'md' ? 'w-24' : 'w-16';

  return (
    <div className="flex items-center gap-2">
      <div className={`${w} ${h} bg-slate-200 rounded-full overflow-hidden`}>
        <div className={`${h} ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-sm font-medium ${textColor}`}>{score}</span>
    </div>
  );
}

export function TypeChip({ type }: { type: VendorType }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${VENDOR_TYPE_COLORS[type] ?? 'bg-slate-100 text-slate-700'}`}>
      {VENDOR_TYPE_LABELS[type] ?? type}
    </span>
  );
}

export function TypeChips({ types, max = 2 }: { types: VendorType[]; max?: number }) {
  const shown = types.slice(0, max);
  const remaining = types.length - max;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {shown.map(t => <TypeChip key={t} type={t} />)}
      {remaining > 0 && (
        <span className="text-xs text-slate-500">+{remaining}</span>
      )}
    </div>
  );
}

export function StatusDot({ status }: { status: ContractStatus }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${CONTRACT_STATUS_COLORS[status] ?? 'bg-slate-400'}`} />;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function ComparisonIndicator({ value, avg, lowerIsBetter = false }: { value: number; avg: number; lowerIsBetter?: boolean }) {
  const isBetter = lowerIsBetter ? value < avg : value > avg;
  return (
    <span className={`text-xs font-medium ${isBetter ? 'text-emerald-600' : 'text-red-600'}`}>
      {isBetter ? '+ better' : '- worse'}
    </span>
  );
}

// ── New / Edit Vendor Modal ─────────────────────────────────────────────────

export function NewVendorModal({
  initialVendor,
  onClose,
  onSave,
}: {
  initialVendor?: Vendor | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    types: VendorType[];
    oib: string;
    phone: string;
    website: string;
    address: string;
  }) => void;
}) {
  const [name, setName] = useState(initialVendor?.name ?? '');
  const [types, setTypes] = useState<VendorType[]>(initialVendor?.types ?? ['reseller']);
  const [oib, setOib] = useState(initialVendor?.oib ?? '');
  const [phone, setPhone] = useState(initialVendor?.phone ?? '');
  const [website, setWebsite] = useState(initialVendor?.website ?? '');
  const [address, setAddress] = useState(initialVendor?.address ?? '');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const toggleType = (t: VendorType) => {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleSubmit = () => {
    if (!name.trim() || types.length === 0) return;
    onSave({
      name: name.trim(),
      types,
      oib: oib.trim(),
      phone: phone.trim(),
      website: website.trim(),
      address: address.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={modalRef} className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {initialVendor ? 'Edit Vendor' : 'New Vendor'}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Company name"
              autoFocus
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Types *</label>
            <button
              onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {types.length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {types.map(t => <TypeChip key={t} type={t} />)}
                </div>
              ) : (
                <span className="text-slate-400">Select types...</span>
              )}
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            {typeDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg py-1">
                {ALL_VENDOR_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>{VENDOR_TYPE_LABELS[t]}</span>
                    {types.includes(t) && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">OIB / VAT ID</label>
            <input
              type="text"
              value={oib}
              onChange={e => setOib(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="12345678901"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+385 1 234 5678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
              <input
                type="text"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="www.example.hr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Street, City, Country"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || types.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initialVendor ? 'Save Changes' : 'Create Vendor'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Contract Detail Modal ───────────────────────────────────────────────────

export function ContractDetailModal({ contract, onClose }: { contract: VendorContract; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const remaining = daysUntil(contract.validTo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">{contract.name}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase">Type</span>
              <p className="text-sm text-slate-900 mt-0.5">{CONTRACT_TYPE_LABELS[contract.type] ?? contract.type}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase">Status</span>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusDot status={contract.status} />
                <span className="text-sm text-slate-900 capitalize">{contract.status}</span>
                {contract.status === 'expiring' && remaining > 0 && (
                  <span className="text-xs text-amber-600 font-medium">{remaining}d left</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase">Valid From</span>
              <p className="text-sm text-slate-900 mt-0.5">{formatDate(contract.validFrom)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase">Valid To</span>
              <p className="text-sm text-slate-900 mt-0.5">{formatDate(contract.validTo)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase">Value</span>
              <p className="text-sm text-slate-900 mt-0.5">{formatCurrency(contract.value)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase">Currency</span>
              <p className="text-sm text-slate-900 mt-0.5">{contract.currency}</p>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-500 uppercase">Auto-Renew</span>
            <p className="text-sm text-slate-900 mt-0.5">{contract.autoRenew ? 'Yes' : 'No'}</p>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-500 uppercase">Linked Assets</span>
            <p className="text-sm text-slate-900 mt-0.5">{contract.linkedAssets} assets</p>
          </div>

          {contract.notes && (
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase">Notes</span>
              <p className="text-sm text-slate-700 mt-0.5">{contract.notes}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
