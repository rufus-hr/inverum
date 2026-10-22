import { useState, useEffect, type ReactNode } from 'react';
import { apiFetch } from '../lib/api';
import {
  Plus, Search, ChevronRight, Trash2, Pencil, X,
  Package, AlertTriangle, CheckCircle, XCircle,
  ArrowLeftRight, Filter,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type SupplyType = 'consumable' | 'stock_item' | 'accessory';
type StockStatus = 'ok' | 'low' | 'out';
type MainTab = 'supplies' | 'stock' | 'movements';

interface Supply {
  id: string;
  name: string;
  supply_type: SupplyType;
  part_number: string | null;
  category: string | null;
  unit: string;
  unit_price: number | null;
  currency: string | null;
  vendor_name: string | null;
  manufacturer_name: string | null;
  compatible_with: string | null; // newline-separated lista modela
  is_active: boolean;
}

interface StockInstance {
  id: string;
  entity_type: SupplyType;
  supply_id: string;
  supply_name: string;
  location_path: string; // e.g. "2. kat / IT skladište"
  quantity: number;
  minimum_quantity: number;
  linked_name: string | null; // linked asset or user name
}

interface Movement {
  id: string;
  supply_name: string;
  entity_type: SupplyType;
  location_path: string;
  quantity: number; // positive = add, negative = take
  reason: string;
  actor_name: string | null;
  created_at: string;
}

// ── Mock data ────────────────────────────────────────────────────────────────

let MOCK_SUPPLIES: Supply[] = [];

let MOCK_STOCK: StockInstance[] = [];

let MOCK_MOVEMENTS: Movement[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function stockStatus(qty: number, min: number): StockStatus {
  if (qty === 0) return 'out';
  if (qty < min) return 'low';
  return 'ok';
}

const TYPE_LABEL: Record<SupplyType, string> = {
  consumable: 'Consumable',
  stock_item: 'Spare part',
  accessory: 'Accessory',
};

const TYPE_COLOR: Record<SupplyType, string> = {
  consumable: 'bg-orange-50 text-orange-700',
  stock_item: 'bg-blue-50 text-blue-700',
  accessory: 'bg-violet-50 text-violet-700',
};

function StatusIcon({ status }: { status: StockStatus }) {
  if (status === 'ok') return <CheckCircle size={15} className="text-emerald-500" />;
  if (status === 'low') return <AlertTriangle size={15} className="text-amber-500" />;
  return <XCircle size={15} className="text-red-500" />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('hr-HR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatQty(qty: number) {
  return qty > 0 ? `+${qty}` : `${qty}`;
}

const REASON_LABEL: Record<string, string> = {
  purchase: 'Nabava',
  usage: 'Upotreba',
  transfer: 'Transfer',
  adjustment: 'Korekcija',
  wasted: 'Otpad',
};

// ── Supply detail panel ───────────────────────────────────────────────────────

function SupplyDetailPanel({ supply, onClose }: { supply: Supply; onClose: () => void }) {
  const instances = MOCK_STOCK.filter(s => s.supply_id === supply.id);
  const totalQty = instances.reduce((sum, s) => sum + s.quantity, 0);

  const [models, setModels] = useState<string[]>(
    supply.compatible_with ? supply.compatible_with.split('\n').filter(Boolean) : []
  );
  const [newModel, setNewModel] = useState('');

  function addModel() {
    const trimmed = newModel.trim();
    if (!trimmed || models.includes(trimmed)) return;
    setModels([...models, trimmed]);
    setNewModel('');
  }

  function removeModel(model: string) {
    setModels(models.filter(m => m !== model));
  }

  return (
    <div className="w-96 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Supply</p>
          <h3 className="text-sm font-semibold text-slate-800 mt-0.5">{supply.name}</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Metadata */}
        <div className="space-y-2">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Tip</dt>
              <dd><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[supply.supply_type]}`}>{TYPE_LABEL[supply.supply_type]}</span></dd>
            </div>
            {supply.part_number && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Part no.</dt>
                <dd className="font-mono text-xs text-slate-700">{supply.part_number}</dd>
              </div>
            )}
            {supply.category && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Kategorija</dt>
                <dd className="text-slate-700">{supply.category}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-400">Jedinica</dt>
              <dd className="text-slate-700">{supply.unit}</dd>
            </div>
            {supply.unit_price && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Cijena/kom</dt>
                <dd className="text-slate-700">{Number(supply.unit_price).toFixed(2)} {supply.currency}</dd>
              </div>
            )}
            {supply.vendor_name && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Vendor</dt>
                <dd className="text-slate-700">{supply.vendor_name}</dd>
              </div>
            )}
            {supply.manufacturer_name && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Proizvođač</dt>
                <dd className="text-slate-700">{supply.manufacturer_name}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Kompatibilni modeli */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Kompatibilni modeli</p>
          <div className="space-y-1 mb-2">
            {models.length === 0 && (
              <p className="text-sm text-slate-400 italic">Nema unesenih modela.</p>
            )}
            {models.map(model => (
              <div key={model} className="flex items-center gap-2 group px-2.5 py-1.5 rounded-lg bg-slate-50 text-sm">
                <span className="flex-1 text-slate-700">{model}</span>
                <button
                  onClick={() => removeModel(model)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-red-500 transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              value={newModel}
              onChange={e => setNewModel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') addModel();
                if (e.key === 'Escape') setNewModel('');
              }}
              placeholder="Dodaj model..."
              className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addModel}
              disabled={!newModel.trim()}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Stock breakdown */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Zalihe</p>
            <span className="text-xs text-slate-400">Ukupno: <span className="font-semibold text-slate-700">{totalQty} {supply.unit}</span></span>
          </div>
          {instances.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Nema instanci na zalihama.</p>
          ) : (
            <div className="space-y-1.5">
              {instances.map(inst => {
                const status = stockStatus(inst.quantity, inst.minimum_quantity);
                return (
                  <div key={inst.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 text-sm">
                    <StatusIcon status={status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 truncate">{inst.location_path}</p>
                      {inst.linked_name && <p className="text-xs text-slate-400 truncate">{inst.linked_name}</p>}
                    </div>
                    <span className="font-semibold text-slate-800 tabular-nums">{inst.quantity}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 p-4 flex gap-2">
        <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors">
          <Pencil size={14} />
          Uredi
        </button>
        {totalQty === 0 && (
          <button className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 text-red-600 transition-colors">
            <Trash2 size={14} />
            Obriši
          </button>
        )}
      </div>
    </div>
  );
}

// ── Tab: Supplies (catalog) ───────────────────────────────────────────────────

function SuppliesTab({ supplyType }: { supplyType: SupplyType | null }) {
  const [search, setSearch] = useState('');
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null);

  const filtered = MOCK_SUPPLIES.filter(s =>
    (!supplyType || s.supply_type === supplyType) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) ||
     (s.part_number ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 bg-white">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape' && search) {
                  e.stopPropagation();
                  setSearch('');
                }
              }}
              placeholder="Pretraži supply..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={15} />
            Dodaj supply
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Naziv</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tip</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Part no.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Cijena</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(supply => (
                <tr
                  key={supply.id}
                  onClick={() => setSelectedSupply(supply.id === selectedSupply?.id ? null : supply)}
                  className={`cursor-pointer hover:bg-slate-50 transition-colors ${selectedSupply?.id === supply.id ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <Package size={15} className="text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-800">{supply.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[supply.supply_type]}`}>
                      {TYPE_LABEL[supply.supply_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{supply.part_number ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{supply.vendor_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums">
                    {supply.unit_price ? `${Number(supply.unit_price).toFixed(2)} ${supply.currency}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${supply.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {supply.is_active ? 'Aktivan' : 'Neaktivan'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight size={15} className="text-slate-300" />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">Nema rezultata.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedSupply && (
        <SupplyDetailPanel supply={selectedSupply} onClose={() => setSelectedSupply(null)} />
      )}
    </div>
  );
}

// ── Tab: Stock (instances) ────────────────────────────────────────────────────

function StockTab({ supplyType }: { supplyType: SupplyType | null }) {
  const [search, setSearch] = useState('');

  const effectiveType = supplyType ?? 'consumable';

  const instances = MOCK_STOCK.filter(s =>
    s.entity_type === effectiveType &&
    ((s.supply_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
     (s.location_path ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  const colLabel = effectiveType === 'accessory' ? 'Linked na' : effectiveType === 'consumable' ? 'Asset' : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-100 bg-white">
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape' && search) {
                e.stopPropagation();
                setSearch('');
              }
            }}
            placeholder="Pretraži..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={15} />
          Dodaj na lokaciju
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Supply</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Lokacija</th>
              {colLabel && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{colLabel}</th>
              )}
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Min</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {instances.map(inst => {
              const status = stockStatus(inst.quantity, inst.minimum_quantity);
              return (
                <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-slate-800">{inst.supply_name}</td>
                  <td className="px-4 py-3 text-slate-600">{inst.location_path}</td>
                  {colLabel && (
                    <td className="px-4 py-3 text-slate-500 text-xs">{inst.linked_name ?? '—'}</td>
                  )}
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{inst.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">{inst.minimum_quantity}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <StatusIcon status={status} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {instances.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">Nema {TYPE_LABEL[effectiveType].toLowerCase()}a na zalihama.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: Movements (ledger) ───────────────────────────────────────────────────

function MovementsTab({ supplyType }: { supplyType: SupplyType | null }) {
  const movements = supplyType
    ? MOCK_MOVEMENTS.filter(m => m.entity_type === supplyType)
    : MOCK_MOVEMENTS;
  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Supply</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tip</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Lokacija</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Razlog</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Korisnik</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {movements.map(m => (
            <tr key={m.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-3 font-medium text-slate-800">{m.supply_name}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[m.entity_type]}`}>
                  {TYPE_LABEL[m.entity_type]}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">{m.location_path}</td>
              <td className="px-4 py-3 text-slate-600">{REASON_LABEL[m.reason] ?? m.reason}</td>
              <td className={`px-4 py-3 text-right font-semibold tabular-nums ${m.quantity > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatQty(m.quantity)}
              </td>
              <td className="px-4 py-3 text-slate-500">{m.actor_name ?? '—'}</td>
              <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(m.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function SupplyDashboard({ supplyType = null }: { supplyType?: SupplyType | null } = {}) {
  const [activeTab, setActiveTab] = useState<MainTab>('supplies');
  const [, setDataVersion] = useState(0);

  useEffect(() => {
    let loaded = 0;
    const bump = () => { loaded++; if (loaded > 0) setDataVersion(v => v + 1); };
    Promise.all([
      apiFetch<{ items: any[] }>('/supplies/?limit=200').catch(() => ({ items: [] })),
      apiFetch<{ items: any[] }>('/stock/?limit=200').catch(() => ({ items: [] })),
      apiFetch<{ items: any[] }>('/movements/?limit=200').catch(() => ({ items: [] })),
      apiFetch<{ items: any[] }>('/locations/?limit=200').catch(() => ({ items: [] })),
    ]).then(([supResp, stockResp, movResp, locResp]) => {
      const supplyMap = new Map<string, string>();
      if (supResp.items?.length > 0) {
        MOCK_SUPPLIES = supResp.items as Supply[];
        for (const s of supResp.items) supplyMap.set(s.id, s.name);
        bump();
      }
      const locMap = new Map<string, string>();
      for (const l of locResp.items ?? []) locMap.set(l.id, l.name);

      if (stockResp.items?.length > 0) {
        MOCK_STOCK = stockResp.items.map((inst: any) => ({
          ...inst,
          supply_name: inst.supply_name ?? supplyMap.get(inst.supply_id) ?? inst.supply_id?.slice(0, 8) ?? 'Unknown',
          location_path: inst.location_path ?? locMap.get(inst.location_id) ?? (inst.storage_unit_id ? 'Storage Unit' : inst.box_id ? 'Box' : '—'),
          minimum_quantity: inst.minimum_quantity ?? 0,
        }));
        bump();
      }
      if (movResp.items?.length > 0) {
        MOCK_MOVEMENTS = movResp.items.map((m: any) => ({
          ...m,
          supply_name: m.supply_name ?? supplyMap.get(m.supply_id) ?? m.supply_id?.slice(0, 8) ?? 'Unknown',
          location_path: m.location_path ?? locMap.get(m.location_id) ?? '—',
          entity_type: m.entity_type ?? 'stock_item',
        }));
        bump();
      }
    });
  }, []);

  const TABS: { id: MainTab; label: string; icon: ReactNode }[] = [
    { id: 'supplies', label: 'Supplies', icon: <Package size={15} /> },
    { id: 'stock', label: 'Stock', icon: <Filter size={15} /> },
    { id: 'movements', label: 'Movements', icon: <ArrowLeftRight size={15} /> },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white">
      {/* Tab bar */}
      <div className="border-b border-slate-200 px-6">
        <div className="flex items-center gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'supplies' && <SuppliesTab supplyType={supplyType} />}
        {activeTab === 'stock' && <StockTab supplyType={supplyType} />}
        {activeTab === 'movements' && <MovementsTab supplyType={supplyType} />}
      </div>
    </div>
  );
}

export default SupplyDashboard;
