import React, { useState } from 'react';
import { ChevronRight, Box, ShieldAlert, Layers, Server, Smartphone, AlertTriangle, CheckCircle2, Search, X } from 'lucide-react';

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
export function StorageUnitDashboard({ data = null as any }: { data?: StorageUnitData } = {}) {
  if (!data) return null;

  const { storage_unit, children, assets, boxes, security_violations } = data;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            {storage_unit.name}
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
              storage_unit.security_level >= 4 ? 'bg-red-100 text-red-700' :
              storage_unit.security_level >= 2 ? 'bg-amber-100 text-amber-700' :
              'bg-emerald-100 text-emerald-700'
            }`}>
              Level {storage_unit.security_level}
            </span>
          </h1>
          <p className="text-slate-500 mt-1 capitalize flex items-center gap-2">
            {storage_unit.type} • {storage_unit.location.name}
            {storage_unit.is_lockable && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Lockable</span>}
          </p>
        </div>
      </div>

      {/* CRITICAL: Security Violations Alert */}
      {security_violations && security_violations.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
            <ShieldAlert size={18} />
            Security Violations Detected ({security_violations.length})
          </div>
          <div className="space-y-2">
            {security_violations.map(v => (
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
            <span className="bg-slate-200 text-slate-600 py-0.5 px-2 rounded-full text-xs">{children.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {children.length === 0 ? (
              <div className="p-4 text-sm text-slate-400 text-center">No sub-units</div>
            ) : (
              children.map(child => (
                <div key={child.id} className="p-3 hover:bg-slate-50 cursor-pointer transition-colors flex justify-between items-center">
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
              <span className="bg-slate-200 text-slate-600 py-0.5 px-2 rounded-full text-xs">{assets.length}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {assets.length === 0 ? (
                <div className="p-4 text-sm text-slate-400 text-center">No direct assets</div>
              ) : (
                assets.map(asset => (
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
              <span className="bg-slate-200 text-slate-600 py-0.5 px-2 rounded-full text-xs">{boxes.length}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {boxes.length === 0 ? (
                <div className="p-4 text-sm text-slate-400 text-center">No boxes stored</div>
              ) : (
                boxes.map(box => (
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
