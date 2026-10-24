import React, { useState, useMemo, type ReactNode } from 'react';
import {
  Plus, Search, ChevronRight, Trash2, Pencil, X,
  Package, AlertTriangle, CheckCircle, XCircle,
  ArrowLeftRight, Filter, Minus,
} from 'lucide-react';
import { useApiQuery } from '../hooks/useApi';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';
import type {
  PagedResponse,
  SupplyResponse,
  SupplyCreatePayload,
  StockInstanceResponse,
  StockInstanceCreatePayload,
  StockMovementResponse,
  StockMovementCreatePayload,
  LocationResponse,
} from '../types/api';

// ── Types ────────────────────────────────────────────────────────────────────

type SupplyType = 'consumable' | 'stock_item' | 'accessory';
type StockStatus = 'ok' | 'low' | 'out';
type MainTab = 'supplies' | 'stock' | 'movements';

interface EnrichedStockInstance extends StockInstanceResponse {
  supply_name: string;
  location_path: string;
  linked_name: string | null;
}

interface EnrichedMovement extends StockMovementResponse {
  supply_name: string;
  location_path: string;
  actor_name: string | null;
}

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

function SupplyDetailPanel({
  supply,
  stockInstances,
  onClose,
  onEdit,
  onDelete,
  onUpdated,
}: {
  supply: SupplyResponse;
  stockInstances: EnrichedStockInstance[];
  onClose: () => void;
  onEdit: (s: SupplyResponse) => void;
  onDelete: (s: SupplyResponse) => void;
  onUpdated: () => void;
}) {
  const toast = useToast();
  const instances = stockInstances.filter(s => s.supply_id === supply.id);
  const totalQty = instances.reduce((sum, s) => sum + s.quantity, 0);

  const [models, setModels] = useState<string[]>(
    supply.compatible_with ? supply.compatible_with.split('\n').filter(Boolean) : []
  );
  const [newModel, setNewModel] = useState('');

  React.useEffect(() => {
    setModels(supply.compatible_with ? supply.compatible_with.split('\n').filter(Boolean) : []);
  }, [supply]);

  async function saveModels(updatedModels: string[]) {
    setModels(updatedModels);
    try {
      await apiFetch(`/supplies/${supply.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ compatible_with: updatedModels.join('\n') || null }),
      });
      onUpdated();
    } catch {
      toast.error('Greška pri spremanju kompatibilnih modela');
    }
  }

  function addModel() {
    const trimmed = newModel.trim();
    if (!trimmed || models.includes(trimmed)) return;
    setNewModel('');
    saveModels([...models, trimmed]);
  }

  function removeModel(model: string) {
    saveModels(models.filter(m => m !== model));
  }

  return (
    <div className="w-96 border-l border-slate-200 bg-white flex flex-col overflow-hidden shrink-0">
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
            {supply.unit_price != null && (
              <div className="flex justify-between">
                <dt className="text-slate-400">Cijena/kom</dt>
                <dd className="text-slate-700">{Number(supply.unit_price).toFixed(2)} {supply.currency ?? 'EUR'}</dd>
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
        <button
          onClick={() => onEdit(supply)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
        >
          <Pencil size={14} />
          Uredi
        </button>
        {instances.length === 0 && (
          <button
            onClick={() => onDelete(supply)}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 text-red-600 transition-colors"
          >
            <Trash2 size={14} />
            Obriši
          </button>
        )}
      </div>
    </div>
  );
}

// ── Tab: Supplies (catalog) ───────────────────────────────────────────────────

function SuppliesTab({
  supplies,
  stockInstances,
  supplyType,
  onRefresh,
}: {
  supplies: SupplyResponse[];
  stockInstances: EnrichedStockInstance[];
  supplyType: SupplyType | null;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<SupplyType | 'all'>(supplyType ?? 'all');
  const [selectedSupply, setSelectedSupply] = useState<SupplyResponse | null>(null);
  const [editingSupply, setEditingSupply] = useState<SupplyResponse | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Modal fields
  const [name, setName] = useState('');
  const [sType, setSType] = useState<SupplyType>('consumable');
  const [partNo, setPartNo] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('kom');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('EUR');

  const openCreateModal = () => {
    setEditingSupply(null);
    setName('');
    setSType(supplyType ?? 'consumable');
    setPartNo('');
    setCategory('');
    setUnit('kom');
    setPrice('');
    setCurrency('EUR');
    setShowModal(true);
  };

  const openEditModal = (s: SupplyResponse) => {
    setEditingSupply(s);
    setName(s.name);
    setSType(s.supply_type);
    setPartNo(s.part_number ?? '');
    setCategory(s.category ?? '');
    setUnit(s.unit ?? 'kom');
    setPrice(s.unit_price != null ? String(s.unit_price) : '');
    setCurrency(s.currency ?? 'EUR');
    setShowModal(true);
  };

  const handleSaveSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload: SupplyCreatePayload = {
      name: name.trim(),
      supply_type: sType,
      part_number: partNo.trim() || null,
      category: category.trim() || null,
      unit: unit.trim() || 'kom',
      unit_price: price ? Number(price) : null,
      currency: currency.trim() || 'EUR',
      is_active: true,
    };

    try {
      if (editingSupply) {
        const updated = await apiFetch<SupplyResponse>(`/supplies/${editingSupply.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success(`Supply "${updated.name}" ažuriran`);
        setSelectedSupply(updated);
      } else {
        const created = await apiFetch<SupplyResponse>('/supplies/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(`Supply "${created.name}" kreiran`);
      }
      setShowModal(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Greška pri spremanju supply stavke');
    }
  };

  const handleDeleteSupply = async (s: SupplyResponse) => {
    try {
      await apiFetch(`/supplies/${s.id}`, { method: 'DELETE' });
      toast.success(`Supply "${s.name}" obrisan`);
      setSelectedSupply(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Greška pri brisanju supply stavke');
    }
  };

  const filtered = supplies.filter(s =>
    (typeFilter === 'all' || s.supply_type === typeFilter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) ||
     (s.part_number ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 bg-white flex-wrap">
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

          {!supplyType && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              {(['all', 'consumable', 'stock_item', 'accessory'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    typeFilter === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t === 'all' ? 'Sve' : TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={openCreateModal}
            className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Kategorija</th>
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
                  <td className="px-4 py-3 text-slate-600">{supply.category ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums">
                    {supply.unit_price != null ? `${Number(supply.unit_price).toFixed(2)} ${supply.currency ?? 'EUR'}` : '—'}
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
        <SupplyDetailPanel
          supply={selectedSupply}
          stockInstances={stockInstances}
          onClose={() => setSelectedSupply(null)}
          onEdit={openEditModal}
          onDelete={handleDeleteSupply}
          onUpdated={onRefresh}
        />
      )}

      {/* Create/Edit Supply Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                {editingSupply ? 'Uredi Supply' : 'Novi Supply (SKU)'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveSupply} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Naziv</label>
                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="npr. HP 85A Toner ili SFP+ 10G Transceiver"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Tip</label>
                  <select
                    value={sType}
                    onChange={e => setSType(e.target.value as SupplyType)}
                    disabled={!!editingSupply}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white disabled:bg-slate-50"
                  >
                    <option value="consumable">Consumable</option>
                    <option value="stock_item">Spare part (Stock Item)</option>
                    <option value="accessory">Accessory</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Part Number</label>
                  <input
                    value={partNo}
                    onChange={e => setPartNo(e.target.value)}
                    placeholder="npr. CE285A"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Kategorija</label>
                  <input
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="npr. Toner"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Cijena</label>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Jedinica</label>
                  <input
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="kom"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                  Odustani
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Spremi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Stock (instances) ────────────────────────────────────────────────────

function StockTab({
  stockInstances,
  supplies,
  locations,
  supplyType,
  onRefresh,
}: {
  stockInstances: EnrichedStockInstance[];
  supplies: SupplyResponse[];
  locations: LocationResponse[];
  supplyType: SupplyType | null;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<SupplyType | 'all'>(supplyType ?? 'all');

  // Create Stock Instance modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSupplyId, setNewSupplyId] = useState('');
  const [newLocId, setNewLocId] = useState('');
  const [newQty, setNewQty] = useState(10);
  const [newMinQty, setNewMinQty] = useState(3);

  // Quick Movement modal (+ / -)
  const [movementTarget, setMovementTarget] = useState<{ inst: EnrichedStockInstance; mode: 'add' | 'take' } | null>(null);
  const [moveQty, setMoveQty] = useState(1);
  const [moveReason, setMoveReason] = useState<'purchase' | 'usage' | 'transfer' | 'adjustment' | 'wasted'>('purchase');
  const [moveNotes, setMoveNotes] = useState('');

  const instances = stockInstances.filter(s =>
    (typeFilter === 'all' || s.entity_type === typeFilter) &&
    ((s.supply_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
     (s.location_path ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  const openAddInstance = () => {
    setNewSupplyId(supplies[0]?.id ?? '');
    setNewLocId(locations[0]?.id ?? '');
    setNewQty(10);
    setNewMinQty(3);
    setShowAddModal(true);
  };

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    const sup = supplies.find(s => s.id === newSupplyId);
    if (!sup || !newLocId) return;
    const payload: StockInstanceCreatePayload = {
      supply_id: sup.id,
      entity_type: sup.supply_type,
      location_id: newLocId,
      quantity: newQty,
      minimum_quantity: newMinQty,
    };
    try {
      await apiFetch('/stock/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success(`Zaliha za "${sup.name}" dodana na lokaciju`);
      setShowAddModal(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Greška pri kreiranju zalihe');
    }
  };

  const openMovementModal = (inst: EnrichedStockInstance, mode: 'add' | 'take') => {
    setMovementTarget({ inst, mode });
    setMoveQty(1);
    setMoveReason(mode === 'add' ? 'purchase' : 'usage');
    setMoveNotes('');
  };

  const handleConfirmMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementTarget || moveQty <= 0) return;
    const { inst, mode } = movementTarget;
    const signedQty = mode === 'add' ? moveQty : -moveQty;
    const payload: StockMovementCreatePayload = {
      supply_id: inst.supply_id,
      entity_type: inst.entity_type,
      entity_id: inst.id,
      location_id: inst.location_id,
      storage_unit_id: inst.storage_unit_id,
      box_id: inst.box_id,
      quantity: signedQty,
      reason: moveReason,
      notes: moveNotes.trim() || null,
    };
    try {
      await apiFetch(`/supplies/${inst.supply_id}/move`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success(
        mode === 'add'
          ? `Dodano +${moveQty} na zalihu (${inst.supply_name})`
          : `Razduženo -${moveQty} sa zalihe (${inst.supply_name})`
      );
      setMovementTarget(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Greška pri knjiženju promjene zalihe');
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-100 bg-white flex-wrap">
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
            placeholder="Pretraži zalihe po nazivu ili lokaciji..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {!supplyType && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['all', 'consumable', 'stock_item', 'accessory'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  typeFilter === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'all' ? 'Sve' : TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={openAddInstance}
          className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tip</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Lokacija</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Min</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Kretanje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {instances.map(inst => {
              const status = stockStatus(inst.quantity, inst.minimum_quantity);
              return (
                <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 font-medium text-slate-800">{inst.supply_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[inst.entity_type]}`}>
                      {TYPE_LABEL[inst.entity_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{inst.location_path}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{inst.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">{inst.minimum_quantity}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <StatusIcon status={status} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => openMovementModal(inst, 'add')}
                        className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                        title="Dopuni zalihu (+)"
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        onClick={() => openMovementModal(inst, 'take')}
                        disabled={inst.quantity <= 0}
                        className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 disabled:opacity-40 transition-colors"
                        title="Potroši / razduži (-)"
                      >
                        <Minus size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {instances.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">
                  Nema pronađenih stavki na zalihama.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Stock Instance Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Dodaj zalihu na lokaciju</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateInstance} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Supply (SKU)</label>
                <select
                  required
                  value={newSupplyId}
                  onChange={e => setNewSupplyId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  {supplies.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({TYPE_LABEL[s.supply_type]})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Lokacija</label>
                <select
                  required
                  value={newLocId}
                  onChange={e => setNewLocId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Početna količina</label>
                  <input
                    type="number"
                    min={0}
                    value={newQty}
                    onChange={e => setNewQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Minimalna količina</label>
                  <input
                    type="number"
                    min={0}
                    value={newMinQty}
                    onChange={e => setNewMinQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                  Odustani
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Spremi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Movement Modal (+ / -) */}
      {movementTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                {movementTarget.mode === 'add' ? 'Dopuna zalihe (+)' : 'Potrošnja / Razduženje (-)'}
              </h3>
              <button onClick={() => setMovementTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmMovement} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800 text-sm">{movementTarget.inst.supply_name}</div>
                <div>Lokacija: {movementTarget.inst.location_path} • Trenutno: <b>{movementTarget.inst.quantity}</b></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Količina</label>
                  <input
                    type="number"
                    min={1}
                    max={movementTarget.mode === 'take' ? movementTarget.inst.quantity : 10000}
                    value={moveQty}
                    onChange={e => setMoveQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Razlog</label>
                  <select
                    value={moveReason}
                    onChange={e => setMoveReason(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    {movementTarget.mode === 'add' ? (
                      <>
                        <option value="purchase">Nabava (Purchase)</option>
                        <option value="adjustment">Korekcija (Adjustment)</option>
                        <option value="transfer">Transfer</option>
                      </>
                    ) : (
                      <>
                        <option value="usage">Upotreba (Usage)</option>
                        <option value="transfer">Transfer</option>
                        <option value="wasted">Otpad (Wasted)</option>
                        <option value="adjustment">Korekcija (Adjustment)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Napomena (opcionalno)</label>
                <input
                  value={moveNotes}
                  onChange={e => setMoveNotes(e.target.value)}
                  placeholder="npr. Zamjena tonera u sobi 204..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setMovementTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                  Odustani
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-sm font-semibold text-white rounded-lg ${
                    movementTarget.mode === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  Potvrdi knjiženje
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Movements (ledger) ───────────────────────────────────────────────────

function MovementsTab({
  movements,
  supplyType,
}: {
  movements: EnrichedMovement[];
  supplyType: SupplyType | null;
}) {
  const filtered = supplyType
    ? movements.filter(m => m.entity_type === supplyType)
    : movements;
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
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Napomena</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.map(m => (
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
              <td className="px-4 py-3 text-slate-500 text-xs">{m.notes ?? m.external_ref ?? '—'}</td>
              <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(m.created_at)}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">
                Nema zabilježenih kretanja na zalihama.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function SupplyDashboard({ supplyType = null }: { supplyType?: SupplyType | null } = {}) {
  const [activeTab, setActiveTab] = useState<MainTab>('supplies');

  const { data: supResp, refetch: refetchSupplies } = useApiQuery<PagedResponse<SupplyResponse>>('/supplies/?limit=200');
  const { data: stockResp, refetch: refetchStock } = useApiQuery<PagedResponse<StockInstanceResponse>>('/stock/?limit=200');
  const { data: movResp, refetch: refetchMovements } = useApiQuery<PagedResponse<StockMovementResponse>>('/movements/?limit=200');
  const { data: locResp } = useApiQuery<PagedResponse<LocationResponse>>('/locations/?limit=200');

  const supplies = supResp?.items ?? [];
  const locations = locResp?.items ?? [];

  const handleRefreshAll = () => {
    refetchSupplies();
    refetchStock();
    refetchMovements();
  };

  const { enrichedStock, enrichedMovements } = useMemo(() => {
    const supplyMap = new Map<string, string>();
    for (const s of supplies) supplyMap.set(s.id, s.name);

    const locMap = new Map<string, string>();
    for (const l of locations) locMap.set(l.id, l.name);

    const eStock: EnrichedStockInstance[] = (stockResp?.items ?? []).map(inst => ({
      ...inst,
      supply_name: supplyMap.get(inst.supply_id) ?? inst.supply_id.slice(0, 8),
      location_path: inst.location_id
        ? (locMap.get(inst.location_id) ?? 'Nepoznata lokacija')
        : inst.storage_unit_id
          ? 'Storage Unit'
          : inst.box_id
            ? 'Box'
            : '—',
      linked_name: null,
    }));

    const eMov: EnrichedMovement[] = (movResp?.items ?? []).map(m => ({
      ...m,
      supply_name: supplyMap.get(m.supply_id) ?? m.supply_id.slice(0, 8),
      location_path: m.location_id
        ? (locMap.get(m.location_id) ?? 'Nepoznata lokacija')
        : m.storage_unit_id
          ? 'Storage Unit'
          : m.box_id
            ? 'Box'
            : '—',
      actor_name: null,
    }));

    return { enrichedStock: eStock, enrichedMovements: eMov };
  }, [supplies, locations, stockResp, movResp]);

  const TABS: { id: MainTab; label: string; icon: ReactNode }[] = [
    { id: 'supplies', label: `Supplies (${supplies.length})`, icon: <Package size={15} /> },
    { id: 'stock', label: `Stock (${enrichedStock.length})`, icon: <Filter size={15} /> },
    { id: 'movements', label: `Movements (${enrichedMovements.length})`, icon: <ArrowLeftRight size={15} /> },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white h-full">
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
        {activeTab === 'supplies' && (
          <SuppliesTab
            supplies={supplies}
            stockInstances={enrichedStock}
            supplyType={supplyType}
            onRefresh={handleRefreshAll}
          />
        )}
        {activeTab === 'stock' && (
          <StockTab
            stockInstances={enrichedStock}
            supplies={supplies}
            locations={locations}
            supplyType={supplyType}
            onRefresh={handleRefreshAll}
          />
        )}
        {activeTab === 'movements' && (
          <MovementsTab
            movements={enrichedMovements}
            supplyType={supplyType}
          />
        )}
      </div>
    </div>
  );
}

export default SupplyDashboard;
