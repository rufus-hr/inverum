import React, { useState, useEffect, useRef } from 'react';
import { UserCheck, MapPin, Wrench, Archive } from 'lucide-react';
import type { Asset } from '../../types';
import type { EmployeeResponse, LocationResponse } from '../../types/api';

export type AssetDropAction = 'assign' | 'move' | 'service' | 'retire';

interface AssetDragOverlayProps {
  asset: Asset | null;
  activeAction: AssetDropAction | null;
  employees: EmployeeResponse[];
  locations: LocationResponse[];
  onTargetDrop: (action: AssetDropAction) => void;
  onAssignEmployee: (employee: EmployeeResponse) => void;
  onMoveLocation: (location: LocationResponse) => void;
  onClose: () => void;
}

export function AssetDragOverlay({
  asset,
  activeAction,
  employees,
  locations,
  onTargetDrop,
  onAssignEmployee,
  onMoveLocation,
  onClose,
}: AssetDragOverlayProps) {
  const [hover, setHover] = useState<AssetDropAction | null>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [locSearch, setLocSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeAction) return;
    const mouseHandler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', mouseHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', mouseHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [activeAction, onClose]);

  if (!asset) return null;

  const filteredEmployees = employees.filter(e =>
    `${e.first_name} ${e.last_name} ${e.email ?? ''}`.toLowerCase().includes(empSearch.toLowerCase())
  );

  const filteredLocations = locations.filter(l =>
    l.name.toLowerCase().includes(locSearch.toLowerCase())
  );

  const targets: { id: AssetDropAction; label: string; icon: React.ReactNode; activeBg: string; ring: string; iconColor: string }[] = [
    { id: 'assign',  label: 'Assign',  icon: <UserCheck size={34} strokeWidth={1.6} />, activeBg: 'bg-blue-600 shadow-blue-500/40',    ring: 'ring-blue-300',    iconColor: 'text-blue-500' },
    { id: 'move',    label: 'Location',icon: <MapPin size={34} strokeWidth={1.6} />,    activeBg: 'bg-emerald-600 shadow-emerald-500/40', ring: 'ring-emerald-300', iconColor: 'text-emerald-500' },
    { id: 'service', label: 'Service', icon: <Wrench size={34} strokeWidth={1.6} />,    activeBg: 'bg-amber-500 shadow-amber-500/40',   ring: 'ring-amber-300',   iconColor: 'text-amber-500' },
    { id: 'retire',  label: 'Retire',  icon: <Archive size={34} strokeWidth={1.6} />,   activeBg: 'bg-rose-600 shadow-rose-500/40',     ring: 'ring-rose-300',    iconColor: 'text-rose-500' },
  ];

  return (
    <div ref={containerRef} className="fixed right-8 top-1/2 -translate-y-1/2 flex flex-col gap-6 z-[70] select-none">
      {targets.map(t => {
        const isActive = hover === t.id || activeAction === t.id;
        return (
          <div key={t.id} className="relative flex flex-col items-center gap-1.5">
            <div
              className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-150 cursor-pointer
                ${isActive
                  ? `${t.activeBg} shadow-2xl ring-4 ${t.ring} scale-110 text-white`
                  : 'bg-white/95 backdrop-blur-sm shadow-xl ring-1 ring-slate-200/90 hover:scale-105'}`}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setHover(t.id); }}
              onDragLeave={() => setHover(null)}
              onDrop={e => { e.preventDefault(); setHover(null); onTargetDrop(t.id); }}
            >
              <span className={isActive ? 'text-white' : t.iconColor}>{t.icon}</span>
            </div>
            <span className={`text-[11px] font-bold tracking-wider uppercase transition-colors ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
              {t.label}
            </span>

            {activeAction === 'assign' && t.id === 'assign' && (
              <div className="absolute right-full top-0 mr-3 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 z-50">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Assign {asset.inventoryNumber} to:
                </p>
                <input
                  autoFocus
                  type="text"
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  placeholder="Filter employees..."
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 mb-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {filteredEmployees.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => onAssignEmployee(emp)}
                      className="w-full text-left px-2.5 py-2 hover:bg-blue-50 rounded-lg transition-colors flex flex-col"
                    >
                      <span className="text-xs font-semibold text-slate-800">{emp.first_name} {emp.last_name}</span>
                      {emp.email && <span className="text-[10px] text-slate-400 truncate">{emp.email}</span>}
                    </button>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <p className="text-xs text-slate-400 py-3 text-center">No employees found</p>
                  )}
                </div>
              </div>
            )}

            {activeAction === 'move' && t.id === 'move' && (
              <div className="absolute right-full top-0 mr-3 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 z-50">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Move {asset.inventoryNumber} to:
                </p>
                <input
                  autoFocus
                  type="text"
                  value={locSearch}
                  onChange={e => setLocSearch(e.target.value)}
                  placeholder="Filter locations..."
                  className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 mb-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {filteredLocations.map(loc => (
                    <button
                      key={loc.id}
                      onClick={() => onMoveLocation(loc)}
                      className="w-full text-left px-2.5 py-2 hover:bg-emerald-50 rounded-lg transition-colors text-xs font-medium text-slate-700"
                    >
                      {loc.name}
                    </button>
                  ))}
                  {filteredLocations.length === 0 && (
                    <p className="text-xs text-slate-400 py-3 text-center">No locations found</p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Export drag start handler creator
export function createDragGhost(e: React.DragEvent, asset: Asset) {
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', asset.id);

  const ghost = document.createElement('div');
  ghost.id = 'drag-ghost';
  ghost.style.position = 'absolute';
  ghost.style.top = '-1000px';
  ghost.style.left = '-1000px';
  ghost.className = 'flex items-center gap-2 bg-slate-900 border border-slate-700 shadow-2xl rounded-lg px-3 py-2 font-mono text-sm font-bold text-white z-[9999]';

  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></svg>`;
  ghost.innerHTML = `${svgIcon}<span>${asset.inventoryNumber}</span>`;
  document.body.appendChild(ghost);

  e.dataTransfer.setDragImage(ghost, -10, -10);

  setTimeout(() => {
    if (document.body.contains(ghost)) document.body.removeChild(ghost);
  }, 0);
}
