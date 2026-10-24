import React, { useState, useEffect, useMemo } from 'react';
import { Server, Map as MapIcon, Maximize2, Settings2, Cpu, HardDrive, Activity, Lock, ShieldAlert, Plus, X } from 'lucide-react';
import { useApiQuery, useApiMutation } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import type {
  PagedResponse,
  StorageUnitResponse,
  StorageUnitCreatePayload,
  AssetResponse,
  LocationResponse,
} from '../types/api';

export function RacksDashboard() {
  const toast = useToast();
  const { data: suResp, refetch: refetchSu } = useApiQuery<PagedResponse<StorageUnitResponse>>('/storage-units/?limit=200');
  const { data: assetsResp } = useApiQuery<PagedResponse<AssetResponse>>('/assets/?limit=200');
  const { data: locResp } = useApiQuery<PagedResponse<LocationResponse>>('/locations/?limit=200');

  const allStorageUnits = suResp?.items ?? [];
  const allAssets = assetsResp?.items ?? [];
  const locations = locResp?.items ?? [];

  const racks = useMemo(
    () => allStorageUnits.filter(u => u.type === 'rack' || u.name.toLowerCase().includes('rack')),
    [allStorageUnits],
  );

  const [selectedRackId, setSelectedRackId] = useState<string | null>(null);
  const [viewSide, setViewSide] = useState<'front' | 'rear'>('front');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRackName, setNewRackName] = useState('');
  const [newRackLocId, setNewRackLocId] = useState('');
  const [newRackSecLevel, setNewRackSecLevel] = useState(3);

  const createRackMutation = useApiMutation<StorageUnitCreatePayload, StorageUnitResponse>('/storage-units/', 'POST');

  useEffect(() => {
    if (!selectedRackId && racks.length > 0) {
      setSelectedRackId(racks[0].id);
    }
  }, [racks, selectedRackId]);

  useEffect(() => {
    if (!newRackLocId && locations.length > 0) {
      setNewRackLocId(locations[0].id);
    }
  }, [locations, newRackLocId]);

  const selectedRack = racks.find(r => r.id === selectedRackId) ?? null;

  const rackSubUnits = useMemo(() => {
    if (!selectedRack) return [];
    return allStorageUnits.filter(u => u.parent_storage_unit_id === selectedRack.id);
  }, [allStorageUnits, selectedRack]);

  const directRackAssets = useMemo(() => {
    if (!selectedRack) return [];
    return allAssets.filter(a => a.storage_unit_id === selectedRack.id);
  }, [allAssets, selectedRack]);

  const locName = useMemo(() => {
    if (!selectedRack) return 'Server Room';
    return locations.find(l => l.id === selectedRack.location_id)?.name ?? 'Server Room';
  }, [locations, selectedRack]);

  const handleAddRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRackName.trim() || !newRackLocId) return;
    const res = await createRackMutation.mutate({
      name: newRackName.trim(),
      type: 'rack',
      location_id: newRackLocId,
      security_level: newRackSecLevel,
      is_lockable: newRackSecLevel >= 4,
      capacity: 42,
    });
    if (res) {
      toast.success(`Rack "${res.name}" kreiran`);
      setNewRackName('');
      setShowAddModal(false);
      refetchSu();
      setSelectedRackId(res.id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Server className="text-indigo-500" size={28} />
              Datacenter & Racks
            </h1>
            <p className="text-slate-500 mt-1">Manage floorplans, rack elevations, and power topology</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-sm flex items-center gap-2 text-sm"
            >
              <Plus size={18} />
              Add Rack
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Datacenter Floorplan */}
        <div className="w-1/2 border-r border-slate-200 bg-slate-100/50 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">{locName}</h2>
            <div className="flex gap-2">
              <button className="p-2 bg-white rounded shadow-sm text-slate-500 hover:text-slate-700"><Settings2 size={16} /></button>
              <button className="p-2 bg-white rounded shadow-sm text-slate-500 hover:text-slate-700"><Maximize2 size={16} /></button>
            </div>
          </div>

          <div className="flex-1 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center relative overflow-hidden shadow-inner p-6">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

            <div className="relative z-10 text-center w-full max-w-md">
              <MapIcon size={44} className="mx-auto mb-3 text-slate-300" />
              <p className="text-slate-600 font-semibold">Interactive Floorplan Canvas</p>
              <p className="text-xs text-slate-400 mt-1">Kliknite na rack za prikaz opreme i sigurnosnih kaveza</p>

              <div className="mt-8 grid grid-cols-3 gap-4 justify-items-center">
                {racks.map(rack => {
                  const isSel = rack.id === selectedRackId;
                  const assetCount = allAssets.filter(a => a.storage_unit_id === rack.id).length;
                  return (
                    <div
                      key={rack.id}
                      onClick={() => setSelectedRackId(rack.id)}
                      className={`w-28 h-24 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center p-2 text-center
                        ${isSel
                          ? 'bg-indigo-100 border-indigo-500 text-indigo-800 shadow-md scale-105'
                          : 'bg-slate-50 border-slate-300 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'}`}
                    >
                      <span className="font-mono text-xs font-bold truncate w-full">{rack.name}</span>
                      <span className="text-[10px] text-slate-400 mt-1">Lvl {rack.security_level} • {assetCount} srv</span>
                    </div>
                  );
                })}
                {racks.length === 0 && (
                  <div className="col-span-3 py-6 text-sm text-slate-400">
                    Nema kreiranih rackova. Kliknite "Add Rack" za dodavanje.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Rack Elevation */}
        <div className="w-1/2 bg-white p-6 flex flex-col">
          {selectedRack ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">{selectedRack.name}</h2>
                    {selectedRack.security_level >= 4 ? (
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                        <Lock size={12} /> Level {selectedRack.security_level} Secure Rack
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded">
                        Level {selectedRack.security_level} Standard
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {selectedRack.capacity ?? 42}U Cabinet • {locName} • {directRackAssets.length} direktno montiranih uređaja
                  </p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setViewSide('front')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${viewSide === 'front' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Front
                  </button>
                  <button
                    onClick={() => setViewSide('rear')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${viewSide === 'rear' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Rear
                  </button>
                </div>
              </div>

              <div className="flex-1 flex gap-8 justify-center overflow-y-auto pb-8">
                <div className={`w-72 bg-slate-800 rounded-t-lg border-x-4 border-t-4 flex flex-col relative shadow-2xl ${selectedRack.security_level >= 4 ? 'border-red-900' : 'border-slate-900'}`}>
                  <div className="absolute -left-6 top-0 bottom-0 flex flex-col justify-between py-2 text-[10px] font-mono text-slate-400">
                    <span>{selectedRack.capacity ?? 42}</span>
                    <span>...</span>
                    <span>1</span>
                  </div>

                  {/* Direct Rack Assets */}
                  {directRackAssets.length > 0 ? (
                    directRackAssets.map((asset, idx) => (
                      <div
                        key={asset.id}
                        className="h-12 bg-slate-700 border-b border-slate-900 mt-1.5 mx-1 rounded flex items-center justify-between px-3 gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {idx % 2 === 0 ? (
                            <Cpu size={14} className="text-emerald-400 shrink-0" />
                          ) : (
                            <Activity size={14} className="text-blue-400 shrink-0" />
                          )}
                          <span className="text-xs font-mono text-slate-200 truncate">{asset.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">Lvl {asset.security_level ?? 1}</span>
                      </div>
                    ))
                  ) : (
                    <div className="h-12 bg-slate-700/60 border-b border-slate-900 mt-2 mx-1 rounded flex items-center px-3 gap-2">
                      <Activity size={14} className="text-emerald-400" />
                      <span className="text-xs font-mono text-slate-300">Top-of-Rack Switch (1U)</span>
                    </div>
                  )}

                  {/* Sub-units (Cages / Shelves inside this rack) */}
                  {rackSubUnits.map(sub => {
                    const subAssets = allAssets.filter(a => a.storage_unit_id === sub.id);
                    return (
                      <div key={sub.id} className="mt-2 mx-1 border-2 border-red-900/80 rounded bg-slate-900 relative overflow-hidden flex flex-col shadow-inner">
                        <div className="bg-red-950/90 border-b border-red-900/50 px-2 py-1 flex items-center justify-between z-10">
                          <div className="flex items-center gap-1.5 text-red-400">
                            <Lock size={12} />
                            <span className="text-[10px] font-bold uppercase tracking-wider truncate">{sub.name}</span>
                          </div>
                          <span className="bg-red-500/20 text-red-300 text-[9px] px-1.5 py-0.5 rounded font-bold">
                            LVL {sub.security_level}
                          </span>
                        </div>
                        <div className="p-1 flex flex-col gap-1 z-10">
                          {subAssets.map(sa => (
                            <div key={sa.id} className="h-11 bg-slate-800 border border-slate-700 rounded flex items-center px-2 gap-2">
                              <ShieldAlert size={13} className="text-red-400 shrink-0" />
                              <span className="text-[10px] font-mono text-slate-300 truncate">{sa.name}</span>
                            </div>
                          ))}
                          {subAssets.length === 0 && (
                            <div className="h-10 flex items-center justify-center">
                              <span className="text-[10px] font-mono text-slate-500">Empty Sub-Unit</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex-1 flex items-center justify-center min-h-[4rem]">
                    <span className="text-slate-500 font-mono text-xs">
                      {viewSide === 'front' ? 'Available Front U-Space' : 'Rear PDU & Cable Management'}
                    </span>
                  </div>

                  <div className="h-20 bg-slate-900 border-t border-slate-950 mb-1 mx-1 rounded flex items-center justify-center gap-2">
                    <HardDrive size={14} className="text-slate-500" />
                    <span className="text-xs font-mono text-slate-500">Smart UPS 3000VA (2U)</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Server size={64} className="mb-4 opacity-20" />
              <h3 className="text-lg font-bold text-slate-600 mb-2">No Rack Selected</h3>
              <p className="text-sm text-center max-w-xs">Select a rack from the floorplan to view its front and rear elevations, equipment, and cabling.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Rack Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Novi Server Rack</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddRack} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Oznaka / Naziv Racka</label>
                <input
                  required
                  value={newRackName}
                  onChange={e => setNewRackName(e.target.value)}
                  placeholder="npr. RACK-02"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Lokacija (Server soba)</label>
                <select
                  value={newRackLocId}
                  onChange={e => setNewRackLocId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Security Level (1–5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={newRackSecLevel}
                  onChange={e => setNewRackSecLevel(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
                  Odustani
                </button>
                <button type="submit" disabled={createRackMutation.isLoading} className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  Kreiraj Rack
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RacksDashboard;
