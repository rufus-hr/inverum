import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, ChevronDown, AlertTriangle, MapPin, Trash2, Info, Calendar,
} from 'lucide-react';
import {
  MaintenanceSchedule, ScheduleInterval, SopTemplate,
  ALL_ASSET_TYPES, ASSET_TYPE_TREE, SCHEDULE_INTERVALS,
} from './ChecklistTypesAndHelpers';

// ── Schedules Tab ───────────────────────────────────────────────────────────

export function SchedulesTab({
  schedules,
  templates,
  onUpdate,
  onCreateSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
}: {
  schedules: MaintenanceSchedule[];
  templates: SopTemplate[];
  onUpdate: (schedules: MaintenanceSchedule[]) => void;
  onCreateSchedule?: (sched: MaintenanceSchedule) => void;
  onUpdateSchedule?: (id: string, patch: Partial<MaintenanceSchedule>) => void;
  onDeleteSchedule?: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showNewMenu) return;
    const handler = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setShowNewMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNewMenu]);

  const selected = selectedId ? schedules.find(s => s.id === selectedId) || null : null;
  const globals = schedules.filter(s => s.locationId === null);
  const overrides = schedules.filter(s => s.locationId !== null);

  function updateSchedule(id: string, patch: Partial<MaintenanceSchedule>) {
    onUpdate(schedules.map(s => s.id === id ? { ...s, ...patch } : s));
    onUpdateSchedule?.(id, patch);
  }

  function createSchedule(isGlobal: boolean) {
    const id = `ms-${Date.now()}`;
    const defaultTpl = templates.find(t => t.isActive) || templates[0];
    const newSched: MaintenanceSchedule = {
      id, name: isGlobal ? 'New Global Schedule' : 'New Location Override',
      templateId: defaultTpl?.id || '',
      templateName: defaultTpl?.name || '',
      assetTypeId: null,
      locationId: isGlobal ? null : '',
      locationName: isGlobal ? null : '',
      interval: 'quarterly',
      customDays: null,
      lastRun: null,
      nextRun: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      isActive: true,
      notes: '',
    };
    onUpdate([...schedules, newSched]);
    onCreateSchedule?.(newSched);
    setSelectedId(id);
    setShowNewMenu(false);
  }

  function deleteSchedule(id: string) {
    onUpdate(schedules.filter(s => s.id !== id));
    onDeleteSchedule?.(id);
    if (selectedId === id) setSelectedId(null);
  }

  function isOverdue(nextRun: string) {
    return new Date(nextRun) < new Date();
  }

  function getOverriddenGlobal(s: MaintenanceSchedule): MaintenanceSchedule | null {
    if (s.locationId === null) return null;
    return globals.find(g => g.assetTypeId === s.assetTypeId && g.isActive) || null;
  }

  const ScheduleRow = ({ s }: { s: MaintenanceSchedule }) => {
    const typeName = s.assetTypeId ? (ALL_ASSET_TYPES.find(t => t.id === s.assetTypeId)?.name ?? s.assetTypeId) : 'All types';
    return (
      <button
        onClick={() => setSelectedId(s.id)}
        className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors ${
          selectedId === s.id ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-sm font-medium text-slate-800 truncate">
            {s.locationName ? `${s.locationName} → ` : ''}{typeName}
          </span>
          <span className={`w-2 h-2 rounded-full shrink-0 ${s.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{SCHEDULE_INTERVALS[s.interval]}</span>
          {isOverdue(s.nextRun) && s.isActive && (
            <span className="text-[10px] text-red-600 font-medium flex items-center gap-0.5">
              <AlertTriangle size={10} /> Overdue
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="flex h-full">
      <div className="w-[340px] shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-700">Maintenance Schedules</h3>
            <div className="relative" ref={newMenuRef}>
              <button onClick={() => setShowNewMenu(!showNewMenu)} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                <Plus size={12} /> New <ChevronDown size={10} />
              </button>
              {showNewMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1">
                  <button onClick={() => createSchedule(true)} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    Global Schedule
                  </button>
                  <button onClick={() => createSchedule(false)} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    Location Override
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400">Global defaults + location-specific overrides</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="mb-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-1.5">Global Schedules</div>
            {globals.length > 0 ? globals.map(s => <ScheduleRow key={s.id} s={s} />) : (
              <p className="text-xs text-slate-300 px-3 py-2">No global schedules</p>
            )}
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-1.5">Location Overrides</div>
            {overrides.length > 0 ? overrides.map(s => <ScheduleRow key={s.id} s={s} />) : (
              <p className="text-xs text-slate-300 px-3 py-2">No location overrides</p>
            )}
          </div>
        </div>
      </div>

      <div className="w-[clamp(640px,50%,800px)] shrink-0 overflow-y-auto">
        {selected ? (() => {
          const isGlobal = selected.locationId === null;
          const overriddenGlobal = getOverriddenGlobal(selected);
          const typeName = selected.assetTypeId ? (ALL_ASSET_TYPES.find(t => t.id === selected.assetTypeId)?.name ?? '') : '';

          return (
            <div className="p-6">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium mb-4 ${
                isGlobal ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {isGlobal ? <><MapPin size={12} /> Global (all locations)</> : <><MapPin size={12} /> Location Override</>}
              </div>

              <div className="flex items-center justify-between mb-6">
                <input
                  value={selected.name}
                  onChange={e => updateSchedule(selected.id, { name: e.target.value })}
                  className="text-lg font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-full mr-4 py-1"
                />
                <div className="flex items-center gap-3 shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-slate-500">{selected.isActive ? 'Active' : 'Paused'}</span>
                    <button
                      onClick={() => updateSchedule(selected.id, { isActive: !selected.isActive })}
                      className={`w-9 h-5 rounded-full transition-colors relative ${selected.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${selected.isActive ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </label>
                  <button onClick={() => deleteSchedule(selected.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Delete schedule">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">SOP Template</label>
                <select
                  value={selected.templateId}
                  onChange={e => {
                    const tpl = templates.find(t => t.id === e.target.value);
                    updateSchedule(selected.id, { templateId: e.target.value, templateName: tpl?.name || '' });
                  }}
                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a template...</option>
                  {templates.filter(t => t.isActive).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {selected.templateId && (() => {
                  const tpl = templates.find(t => t.id === selected.templateId);
                  if (!tpl || tpl.items.length === 0) return null;
                  return (
                    <div className="mt-3 border border-slate-200 rounded-lg bg-slate-50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Checklist Steps ({tpl.items.length})</span>
                        <div className="flex gap-2">
                          {tpl.isRequired && <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-medium">Required</span>}
                          {tpl.requiresConfirmation && <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded font-medium">4-Eyes</span>}
                        </div>
                      </div>
                      <ol className="space-y-1">
                        {tpl.items.map((item, i) => (
                          <li key={item.id} className="flex items-start gap-2 text-sm text-slate-600">
                            <span className="text-xs text-slate-400 mt-0.5 w-4 shrink-0">{i + 1}.</span>
                            <span>{item.text}</span>
                            {item.isBlocking && <span className="text-[9px] text-red-500 shrink-0 mt-0.5">●</span>}
                            {item.requiresNote && <span className="text-[9px] text-blue-500 shrink-0 mt-0.5" title="Requires note">📝</span>}
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                })()}
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Asset Type</label>
                <select
                  value={selected.assetTypeId || ''}
                  onChange={e => updateSchedule(selected.id, { assetTypeId: e.target.value || null })}
                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">All asset types</option>
                  {ASSET_TYPE_TREE.map(cat => (
                    <optgroup key={cat.category} label={cat.category}>
                      {cat.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              {!isGlobal && (
                <div className="mb-5">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
                  <input
                    value={selected.locationName || ''}
                    onChange={e => updateSchedule(selected.id, { locationName: e.target.value })}
                    placeholder="e.g. Zagreb DC, Server Room B"
                    className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="mb-5">
                <label className="block text-sm font-medium text-slate-700 mb-2">Interval</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(SCHEDULE_INTERVALS) as [ScheduleInterval, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => updateSchedule(selected.id, { interval: val })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selected.interval === val
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {selected.interval === 'custom' && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-500">Every</span>
                    <input
                      type="number"
                      min={1}
                      value={selected.customDays ?? 30}
                      onChange={e => updateSchedule(selected.id, { customDays: parseInt(e.target.value) || 30 })}
                      className="w-20 text-sm border border-slate-200 rounded-md px-2.5 py-1.5 text-center"
                    />
                    <span className="text-xs text-slate-500">days</span>
                  </div>
                )}
              </div>

              {overriddenGlobal && (
                <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                  <Info size={14} className="shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    Overrides global schedule <strong>"{overriddenGlobal.name}"</strong> ({SCHEDULE_INTERVALS[overriddenGlobal.interval]}) for {typeName || 'this asset type'} at <strong>{selected.locationName || 'this location'}</strong>.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-5 p-4 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-xs text-slate-400">Last Run</span>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">{selected.lastRun || 'Never'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Next Run</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <input
                      type="date"
                      value={selected.nextRun}
                      onChange={e => updateSchedule(selected.id, { nextRun: e.target.value })}
                      className="text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded px-2 py-0.5"
                    />
                    {isOverdue(selected.nextRun) && selected.isActive && (
                      <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                        <AlertTriangle size={12} /> Overdue
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea
                  value={selected.notes}
                  onChange={e => updateSchedule(selected.id, { notes: e.target.value })}
                  rows={3}
                  placeholder="Schedule notes, special instructions..."
                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          );
        })() : (
          <div className="flex items-center justify-center h-full text-slate-400">
            <div className="text-center">
              <Calendar size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select a schedule or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
