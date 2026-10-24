import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronRight, Box, ShieldAlert, Layers, Server, AlertTriangle,
  CheckCircle2, Search, X, Plus, Lock,
} from 'lucide-react';
import { useApiQuery, useApiMutation } from '../hooks/useApi';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';
import type {
  PagedResponse,
  StorageUnitResponse,
  StorageUnitCreatePayload,
  AssetResponse,
  BoxResponse,
  LocationResponse,
} from '../types/api';

// --- Types based on Claude's API Contract ---
export interface BreadcrumbItem {
  type: 'location' | 'storage_unit' | 'box' | 'asset';
  id: string;
  name: string;
}

export interface SecurityViolation {
  asset_id: string;
  inventory_number: string;
  asset_security_level: number;
  storage_unit_security_level: number;
  message: string;
}

export interface StorageUnitData {
  storage_unit: {
    id: string;
    name: string;
    type: string;
    security_level: number;
    is_lockable: boolean;
    location: { id: string; name: string };
  };
  children: Array<{ type: string; id: string; name: string; item_count: number }>;
  assets: Array<{ id: string; inventory_number: string; name: string; status: string; security_level: number }>;
  boxes: Array<{ id: string; inventory_number: string; status: string; item_count: number }>;
  security_violations: SecurityViolation[];
}

// --- 1. LocationBreadcrumb Component ---
export function LocationBreadcrumb({ path }: { path: BreadcrumbItem[] }) {
  if (!path || path.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-1 text-sm text-slate-500 font-medium">
      {path.map((item, index) => {
        const isLast = index === path.length - 1;
        return (
          <React.Fragment key={item.id}>
            <span className={`flex items-center gap-1.5 ${isLast ? 'text-slate-900 font-bold' : 'hover:text-slate-700 cursor-pointer transition-colors'}`}>
              {item.type === 'location' && <Box size={14} className="text-slate-400" />}
              {item.type === 'storage_unit' && <Layers size={14} className="text-blue-400" />}
              {item.type === 'box' && <Box size={14} className="text-amber-500" />}
              {item.type === 'asset' && <Server size={14} className="text-emerald-500" />}
              {item.name}
            </span>
            {!isLast && <ChevronRight size={14} className="text-slate-300 mx-0.5" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// --- 2. StorageUnitDashboard Component ---
export function StorageUnitDashboard({ data: propData }: { data?: StorageUnitData } = {}) {
  const toast = useToast();
  const { data: suResp, refetch: refetchSu } = useApiQuery<PagedResponse<StorageUnitResponse>>('/storage-units/?limit=200');
  const { data: locResp } = useApiQuery<PagedResponse<LocationResponse>>('/locations/?limit=200');
  const { data: assetsResp, refetch: refetchAssets } = useApiQuery<PagedResponse<AssetResponse>>('/assets/?limit=200');
  const { data: boxesResp } = useApiQuery<PagedResponse<BoxResponse>>('/boxes/?limit=200');

  const storageUnits = suResp?.items ?? [];
  const locations = locResp?.items ?? [];
  const allAssets = assetsResp?.items ?? [];
  const allBoxes = boxesResp?.items ?? [];

  const [selectedSuId, setSelectedSuId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPlaceAssetModal, setShowPlaceAssetModal] = useState(false);
  const [selectedAssetToPlace, setSelectedAssetToPlace] = useState('');

  // Form state for new Storage Unit
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('cabinet');
  const [newLocId, setNewLocId] = useState('');
  const [newSecLevel, setNewSecLevel] = useState(2);
  const [newLockable, setNewLockable] = useState(false);

  const createSuMutation = useApiMutation<StorageUnitCreatePayload, StorageUnitResponse>('/storage-units/', 'POST');

  useEffect(() => {
    if (!selectedSuId && storageUnits.length > 0) {
      setSelectedSuId(storageUnits[0].id);
    }
  }, [storageUnits, selectedSuId]);

  useEffect(() => {
    if (!newLocId && locations.length > 0) {
      setNewLocId(locations[0].id);
    }
  }, [locations, newLocId]);

  const locMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of locations) m.set(l.id, l.name);
    return m;
  }, [locations]);

  const activeData: StorageUnitData | null = useMemo(() => {
    if (propData) return propData;
    const su = storageUnits.find(u => u.id === selectedSuId);
    if (!su) return null;

    const children = storageUnits
      .filter(u => u.parent_storage_unit_id === su.id)
      .map(c => {
        const childAssetCount = allAssets.filter(a => a.storage_unit_id === c.id).length;
        const childBoxCount = allBoxes.filter(b => b.storage_unit_id === c.id).length;
        return {
          type: c.type,
          id: c.id,
          name: c.name,
          item_count: childAssetCount + childBoxCount,
        };
      });

    const unitAssets = allAssets
      .filter(a => a.storage_unit_id === su.id)
      .map(a => ({
        id: a.id,
        inventory_number: a.inventory_number ?? a.serial_number ?? a.id.slice(0, 8).toUpperCase(),
        name: a.name ?? 'Asset',
        status: a.status ?? 'Active',
        security_level: a.security_level ?? 1,
      }));

    const unitBoxes = allBoxes
      .filter(b => b.storage_unit_id === su.id)
      .map(b => {
        const boxAssetCount = allAssets.filter(a => a.box_id === b.id).length;
        return {
          id: b.id,
          inventory_number: b.inventory_number,
          status: b.status,
          item_count: boxAssetCount,
        };
      });

    const violations: SecurityViolation[] = unitAssets
      .filter(a => a.security_level > su.security_level)
      .map(a => ({
        asset_id: a.id,
        inventory_number: a.inventory_number,
        asset_security_level: a.security_level,
        storage_unit_security_level: su.security_level,
        message: 'Visokovrijedna oprema u storage unitu s nižom sigurnosnom razinom',
      }));

    return {
      storage_unit: {
        id: su.id,
        name: su.name,
        type: su.type,
        security_level: su.security_level,
        is_lockable: su.is_lockable,
        location: {
          id: su.location_id,
          name: locMap.get(su.location_id) ?? 'Nepoznata lokacija',
        },
      },
      children,
      assets: unitAssets,
      boxes: unitBoxes,
      security_violations: violations,
    };
  }, [propData, storageUnits, selectedSuId, allAssets, allBoxes, locMap]);

  const filteredUnits = storageUnits.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.type.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateSu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newLocId) return;
    const res = await createSuMutation.mutate({
      name: newName.trim(),
      type: newType,
      location_id: newLocId,
      security_level: newSecLevel,
      is_lockable: newLockable,
    });
    if (res) {
      toast.success(`Storage Unit "${res.name}" kreiran`);
      setNewName('');
      setShowCreateModal(false);
      refetchSu();
      setSelectedSuId(res.id);
    }
  };

  const handlePlaceAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetToPlace || !activeData) return;
    try {
      const resp = await apiFetch<{ status: string; warning?: { message: string } }>(
        `/assets/${selectedAssetToPlace}/place`,
        {
          method: 'POST',
          body: JSON.stringify({ storage_unit_id: activeData.storage_unit.id }),
        }
      );
      if (resp.warning) {
        toast.error(resp.warning.message);
      } else {
        toast.success('Oprema smještena u Storage Unit');
      }
      setShowPlaceAssetModal(false);
      setSelectedAssetToPlace('');
      refetchAssets();
    } catch (err: any) {
      toast.error(err?.message || 'Greška pri smještanju opreme');
    }
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* Left sidebar list of Storage Units (hidden if propData is explicitly passed) */}
      {!propData && (
        <div className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers size={18} className="text-blue-600" />
                Storage Units
              </h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                title="Novi Storage Unit"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Pretraži ormare, sefove, police..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredUnits.map(u => {
              const isSelected = u.id === selectedSuId;
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedSuId(u.id)}
                  className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between ${
                    isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm text-slate-900 truncate">{u.name}</span>
                      {u.is_lockable && <Lock size={12} className="text-slate-400 shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 capitalize truncate">
                      {u.type} • {locMap.get(u.location_id) ?? '—'}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    u.security_level >= 4 ? 'bg-red-100 text-red-700' :
                    u.security_level >= 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    Lvl {u.security_level}
                  </span>
                </button>
              );
            })}
            {filteredUnits.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">
                Nema pronađenih Storage Unita.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right detail pane */}
      <div className="flex-1 overflow-y-auto">
        {!activeData ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
            <Layers size={48} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">Odaberite Storage Unit s lijeve strane.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 max-w-5xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                  {activeData.storage_unit.name}
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                    activeData.storage_unit.security_level >= 4 ? 'bg-red-100 text-red-700' :
                    activeData.storage_unit.security_level >= 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    Level {activeData.storage_unit.security_level}
                  </span>
                </h1>
                <p className="text-slate-500 mt-1 capitalize flex items-center gap-2">
                  {activeData.storage_unit.type} • {activeData.storage_unit.location.name}
                  {activeData.storage_unit.is_lockable && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Lockable</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowPlaceAssetModal(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors"
              >
                <Plus size={15} />
                Smjesti opremu
              </button>
            </div>

            {/* CRITICAL: Security Violations Alert */}
            {activeData.security_violations && activeData.security_violations.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
                  <ShieldAlert size={18} />
                  Security Violations Detected ({activeData.security_violations.length})
                </div>
                <div className="space-y-2">
                  {activeData.security_violations.map(v => (
                    <div key={v.asset_id} className="flex items-center justify-between bg-white/60 rounded-lg p-3 text-sm border border-red-100">
                      <div className="flex items-center gap-3">
                        <AlertTriangle size={16} className="text-red-500" />
                        <span className="font-medium text-slate-900">{v.inventory_number}</span>
                        <span className="text-slate-600">{v.message}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded">Asset Lvl {v.asset_security_level}</span>
                        <span className="text-slate-400">&gt;</span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">Unit Lvl {v.storage_unit_security_level}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Children (Shelves/Drawers) */}
              <div className="col-span-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 font-bold text-slate-700 text-sm uppercase tracking-wider flex justify-between items-center">
                  Sub-Units
                  <span className="bg-slate-200 text-slate-600 py-0.5 px-2 rounded-full text-xs">{activeData.children.length}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {activeData.children.length === 0 ? (
                    <div className="p-4 text-sm text-slate-400 text-center">No sub-units</div>
                  ) : (
                    activeData.children.map(child => (
                      <div
                        key={child.id}
                        onClick={() => setSelectedSuId(child.id)}
                        className="p-3 hover:bg-slate-50 cursor-pointer transition-colors flex justify-between items-center"
                      >
                        <div className="flex items-center gap-2">
                          <Layers size={16} className="text-blue-400" />
                          <span className="text-sm font-medium text-slate-700">{child.name}</span>
                        </div>
                        <span className="text-xs text-slate-400">{child.item_count} items</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Assets & Boxes */}
              <div className="col-span-1 md:col-span-2 space-y-6">
                {/* Direct Assets */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 font-bold text-slate-700 text-sm uppercase tracking-wider flex justify-between items-center">
                    Direct Assets
                    <span className="bg-slate-200 text-slate-600 py-0.5 px-2 rounded-full text-xs">{activeData.assets.length}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {activeData.assets.length === 0 ? (
                      <div className="p-4 text-sm text-slate-400 text-center">No direct assets</div>
                    ) : (
                      activeData.assets.map(asset => (
                        <div key={asset.id} className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Server size={16} className="text-emerald-500" />
                            <div>
                              <div className="text-sm font-bold text-slate-900">{asset.inventory_number}</div>
                              <div className="text-xs text-slate-500">{asset.name}</div>
                            </div>
                          </div>
                          <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded">Lvl {asset.security_level}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Boxes */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 font-bold text-slate-700 text-sm uppercase tracking-wider flex justify-between items-center">
                    Stored Boxes
                    <span className="bg-slate-200 text-slate-600 py-0.5 px-2 rounded-full text-xs">{activeData.boxes.length}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {activeData.boxes.length === 0 ? (
                      <div className="p-4 text-sm text-slate-400 text-center">No boxes stored</div>
                    ) : (
                      activeData.boxes.map(box => (
                        <div key={box.id} className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Box size={16} className="text-amber-500" />
                            <span className="text-sm font-bold text-slate-900">{box.inventory_number}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500">{box.item_count} items</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${box.status === 'sealed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                              {box.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Storage Unit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Novi Storage Unit</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateSu} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Naziv</label>
                <input
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="npr. Sef Kat 2 ili Ormar B"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Tip</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="cabinet">Cabinet</option>
                    <option value="safe">Safe</option>
                    <option value="rack">Rack</option>
                    <option value="shelf">Shelf</option>
                    <option value="cage">Cage</option>
                    <option value="drawer">Drawer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Security Level (1–5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={newSecLevel}
                    onChange={e => setNewSecLevel(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Lokacija</label>
                <select
                  value={newLocId}
                  onChange={e => setNewLocId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newLockable}
                  onChange={e => setNewLockable(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Mogućnost zaključavanja (Lockable)
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                  Odustani
                </button>
                <button type="submit" disabled={createSuMutation.isLoading} className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Spremi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Place Asset Modal */}
      {showPlaceAssetModal && activeData && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Smjesti opremu u {activeData.storage_unit.name}</h3>
              <button onClick={() => setShowPlaceAssetModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePlaceAsset} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Odaberi opremu (Asset)</label>
                <select
                  required
                  value={selectedAssetToPlace}
                  onChange={e => setSelectedAssetToPlace(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="">— Odaberi asset —</option>
                  {allAssets
                    .filter(a => a.storage_unit_id !== activeData.storage_unit.id)
                    .map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.serial_number ?? a.id.slice(0, 8)}) — Lvl {a.security_level ?? 1}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPlaceAssetModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                  Odustani
                </button>
                <button type="submit" disabled={!selectedAssetToPlace} className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  Potvrdi smještaj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 3. ScannerPlacementModal Component ---
export function ScannerPlacementModal({ isOpen, onClose, onPlace }: { isOpen: boolean, onClose: () => void, onPlace: (unitId: string) => void }) {
  const [scanInput, setScanInput] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scanInput.trim()) {
      onPlace(scanInput.trim());
      setScanInput('');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Search size={20} className="text-blue-500" />
            Scan Storage Unit
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          <div className="text-center">
            <p className="text-sm text-slate-500 mb-4">
              Scan the barcode or QR code of the destination Storage Unit (Rack, Shelf, Safe) to place the selected items.
            </p>
            <input
              type="text"
              autoFocus
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Waiting for scanner..."
              className="w-full text-center text-2xl font-mono tracking-widest p-4 border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all bg-blue-50/50"
            />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!scanInput.trim()} className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <CheckCircle2 size={18} />
              Confirm Placement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default StorageUnitDashboard;
