import React, { useState, useMemo, useRef } from 'react';
import {
  Wrench, Plus, Search, Filter, CheckCircle2, AlertTriangle,
  Clock, ChevronRight, X, ArrowUpDown,
} from 'lucide-react';
import {
  WorkOrder, WOStatus, WOPriority, WOType, WOSource, SortField, SortDir,
  CURRENT_USER, ALL_TYPES, ALL_PRIORITIES, ALL_STATUSES, ALL_SOURCES,
  ALL_LOCATIONS, ALL_REPORTERS, STATUS_BADGE, STATUS_LABEL, STATUS_SHORT_LABEL,
  PRIORITY_BADGE, PRIORITY_ORDER, STATUS_ORDER, SOURCE_BADGE, TECHNICIAN_POOL,
  WOCard, NewWOForm, BulkActionsBar, formatDate, isOverdue, isToday,
  fuzzyMatch, buildSearchHaystack,
} from './WOTypesAndHelpers';
import { DetailPanel, InlineDetailPanel } from './WorkOrderDetail';

// ── Assignee Panel (Right sidebar in Management when no WO selected) ────────

export function AssigneePanel({
  workOrders, activeAssigneeFilter, onFilterAssignee,
}: {
  workOrders: WorkOrder[];
  activeAssigneeFilter: string | null;
  onFilterAssignee: (name: string | null) => void;
}) {
  const activeWOs = workOrders.filter(wo => wo.status !== 'completed' && wo.status !== 'cancelled');
  const unassignedWOs = activeWOs.filter(wo => !wo.assigneeName);

  const techCounts = useMemo(() => {
    const map: Record<string, { total: number; inProgress: number; open: number; onHold: number }> = {};
    for (const t of TECHNICIAN_POOL.filter(tp => tp.eligible)) {
      map[t.name] = { total: 0, inProgress: 0, open: 0, onHold: 0 };
    }
    for (const wo of activeWOs) {
      if (wo.assigneeName && map[wo.assigneeName]) {
        map[wo.assigneeName].total++;
        if (wo.status === 'in_progress') map[wo.assigneeName].inProgress++;
        else if (wo.status === 'open') map[wo.assigneeName].open++;
        else if (wo.status === 'on_hold') map[wo.assigneeName].onHold++;
      }
    }
    return map;
  }, [activeWOs]);

  const maxLoad = Math.max(1, ...(Object.values(techCounts) as { total: number }[]).map(c => c.total));

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Team Workload</span>
        {activeAssigneeFilter && (
          <button onClick={() => onFilterAssignee(null)} className="text-[11px] text-blue-600 hover:underline">
            Show all
          </button>
        )}
      </div>

      <button
        onClick={() => onFilterAssignee(activeAssigneeFilter === '__unassigned__' ? null : '__unassigned__')}
        className={`w-full text-left p-2.5 rounded-lg border mb-3 transition-colors ${
          activeAssigneeFilter === '__unassigned__'
            ? 'border-amber-300 bg-amber-50'
            : unassignedWOs.length > 0
              ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
              : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-amber-700">Unassigned</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
            unassignedWOs.length > 0 ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-500'
          }`}>
            {unassignedWOs.length}
          </span>
        </div>
        {unassignedWOs.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {unassignedWOs.slice(0, 3).map(wo => (
              <div key={wo.id} className="text-[11px] text-slate-600 truncate">
                <span className="font-mono text-slate-400">{wo.wo_number}</span> {wo.title}
              </div>
            ))}
          </div>
        )}
      </button>

      <div className="space-y-2">
        {TECHNICIAN_POOL.filter(t => t.eligible).map(tech => {
          const counts = techCounts[tech.name] || { total: 0, inProgress: 0, open: 0, onHold: 0 };
          const isActive = activeAssigneeFilter === tech.name;
          return (
            <button
              key={tech.name}
              onClick={() => onFilterAssignee(isActive ? null : tech.name)}
              className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                isActive ? 'border-blue-300 bg-blue-50/70' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-800">{tech.name}</span>
                <span className="text-xs font-semibold text-slate-600">{counts.total} active</span>
              </div>
              <div className="text-[10px] text-slate-400 mb-1.5">{tech.skills.join(' · ')}</div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                {counts.inProgress > 0 && (
                  <div className="bg-blue-500 h-full" style={{ width: `${(counts.inProgress / maxLoad) * 100}%` }} />
                )}
                {counts.open > 0 && (
                  <div className="bg-sky-400 h-full" style={{ width: `${(counts.open / maxLoad) * 100}%` }} />
                )}
                {counts.onHold > 0 && (
                  <div className="bg-amber-400 h-full" style={{ width: `${(counts.onHold / maxLoad) * 100}%` }} />
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                {counts.inProgress > 0 && <span className="text-blue-600">{counts.inProgress} in progress</span>}
                {counts.open > 0 && <span className="text-sky-600">{counts.open} open</span>}
                {counts.onHold > 0 && <span className="text-amber-600">{counts.onHold} on hold</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide block mb-2">Other Team Members</span>
        {TECHNICIAN_POOL.filter(t => !t.eligible).map(tech => {
          const count = activeWOs.filter(wo => wo.assigneeName === tech.name).length;
          return (
            <button
              key={tech.name}
              onClick={() => onFilterAssignee(activeAssigneeFilter === tech.name ? null : tech.name)}
              className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between mb-1 ${
                activeAssigneeFilter === tech.name ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span>{tech.name}</span>
              <span className="text-[10px] text-slate-400">{count} active</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── My Queue Tab ────────────────────────────────────────────────────────────

export function MyQueueTab({
  workOrders, selectedId, onSelect, onStatusChange, onToggleCheck, onTakeIt,
  onNotesChange, onAddComment,
}: {
  workOrders: WorkOrder[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onStatusChange: (woId: string, status: WOStatus) => void;
  onToggleCheck: (woId: string, itemId: string) => void;
  onTakeIt: (woId: string) => void;
  onNotesChange: (woId: string, notes: string) => void;
  onAddComment: (woId: string, text: string) => void;
}) {
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const myWOs = workOrders.filter(wo => wo.assigneeName === CURRENT_USER);
  const inProgress = myWOs.filter(wo => wo.status === 'in_progress')
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const openWOs = myWOs.filter(wo => wo.status === 'open')
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const onHold = myWOs.filter(wo => wo.status === 'on_hold')
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const draftWOs = myWOs.filter(wo => wo.status === 'draft')
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const completedToday = myWOs.filter(wo => wo.status === 'completed' && isToday(wo.completedAt));

  const unassignedOpen = workOrders.filter(wo =>
    !wo.assigneeName && (wo.status === 'open' || wo.status === 'pending_approval')
  );

  const renderCardWithDetail = (wo: WorkOrder) => (
    <div key={wo.id}>
      <WOCard
        wo={wo}
        selected={wo.id === selectedId}
        onSelect={() => onSelect(wo.id === selectedId ? null : wo.id)}
        onStatusChange={s => onStatusChange(wo.id, s)}
        onToggleCheck={itemId => onToggleCheck(wo.id, itemId)}
      />
      {wo.id === selectedId && (
        <InlineDetailPanel
          wo={wo}
          onClose={() => onSelect(null)}
          onStatusChange={s => onStatusChange(wo.id, s)}
          onNotesChange={n => onNotesChange(wo.id, n)}
          onToggleCheck={itemId => onToggleCheck(wo.id, itemId)}
          onAddComment={text => onAddComment(wo.id, text)}
        />
      )}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <Wrench size={14} className="text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">{inProgress.length} In Progress</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-sky-50 border border-sky-200 rounded-lg">
            <Clock size={14} className="text-sky-600" />
            <span className="text-xs font-semibold text-sky-700">{openWOs.length} Open</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle size={14} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">{onHold.length} On Hold</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">{completedToday.length} Completed Today</span>
          </div>
        </div>

        {inProgress.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              In Progress ({inProgress.length})
            </h4>
            <div className="space-y-2">
              {inProgress.map(wo => renderCardWithDetail(wo))}
            </div>
          </div>
        )}

        {openWOs.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Open — Ready to Start ({openWOs.length})
            </h4>
            <div className="space-y-2">
              {openWOs.map(wo => renderCardWithDetail(wo))}
            </div>
          </div>
        )}

        {onHold.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              On Hold ({onHold.length})
            </h4>
            <div className="space-y-2">
              {onHold.map(wo => renderCardWithDetail(wo))}
            </div>
          </div>
        )}

        {draftWOs.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Drafts ({draftWOs.length})
            </h4>
            <div className="space-y-2">
              {draftWOs.map(wo => renderCardWithDetail(wo))}
            </div>
          </div>
        )}

        {unassignedOpen.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
              Unassigned in Your Area ({unassignedOpen.length})
            </h4>
            <div className="space-y-2">
              {unassignedOpen.map(wo => (
                <div key={wo.id}>
                  <div
                    onClick={() => onSelect(wo.id === selectedId ? null : wo.id)}
                    className={`border border-dashed border-amber-300 rounded-lg p-3 cursor-pointer transition-all ${
                      wo.id === selectedId ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-amber-50/30 hover:bg-amber-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${PRIORITY_BADGE[wo.priority]}`}>
                          {wo.priority}
                        </span>
                        <span className="font-mono text-xs text-slate-400">{wo.wo_number}</span>
                        <span className="text-sm font-medium text-slate-800 truncate">{wo.title}</span>
                      </div>
                      {wo.status === 'open' && (
                        <button
                          onClick={e => { e.stopPropagation(); onTakeIt(wo.id); }}
                          className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-md border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          Take It
                        </button>
                      )}
                      {wo.status === 'pending_approval' && (
                        <span className="shrink-0 text-[10px] font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                          Pending Approval
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      {wo.assetName ? (
                        <span>{wo.assetName} ({wo.assetInv})</span>
                      ) : (
                        <span className="italic text-slate-400">No asset</span>
                      )}
                      <span className="text-slate-300">·</span>
                      <span>{wo.location}</span>
                      {wo.estimatedHours && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-400">Est. {wo.estimatedHours}h</span>
                        </>
                      )}
                    </div>
                  </div>
                  {wo.id === selectedId && (
                    <InlineDetailPanel
                      wo={wo}
                      onClose={() => onSelect(null)}
                      onStatusChange={s => onStatusChange(wo.id, s)}
                      onNotesChange={n => onNotesChange(wo.id, n)}
                      onToggleCheck={itemId => onToggleCheck(wo.id, itemId)}
                      onAddComment={text => onAddComment(wo.id, text)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <button
            onClick={() => setCompletedExpanded(!completedExpanded)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600"
          >
            <ChevronRight size={13} className={`transition-transform ${completedExpanded ? 'rotate-90' : ''}`} />
            Completed Today ({completedToday.length})
          </button>
          {completedExpanded && completedToday.length > 0 && (
            <div className="space-y-2 mt-2">
              {completedToday.map(wo => renderCardWithDetail(wo))}
            </div>
          )}
          {completedExpanded && completedToday.length === 0 && (
            <p className="text-xs text-slate-400 mt-2 pl-5">No work orders completed today yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Management Tab ──────────────────────────────────────────────────────────

export function ManagementTab({
  workOrders, selectedId, onSelect, showNewForm, onToggleNewForm,
  onCreateWO, onStatusChange, onPriorityChange, onTypeChange,
  onAssigneeChange, onDueDateChange, onDescriptionChange, onNotesChange,
  onToggleCheck, onAddCheckItem, onRemoveCheckItem, onAddComment,
  onTitleChange, onBulkAssign, onBulkPriority, onBulkStatus,
}: {
  workOrders: WorkOrder[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showNewForm: boolean;
  onToggleNewForm: () => void;
  onCreateWO: (data: {
    title: string; type: WOType; priority: WOPriority;
    asset_id: string | null; location: string; assigneeName: string | null;
    dueDate: string; description: string; requiresApproval: boolean;
  }) => void;
  onStatusChange: (woId: string, status: WOStatus) => void;
  onPriorityChange: (woId: string, priority: WOPriority) => void;
  onTypeChange: (woId: string, type: WOType) => void;
  onAssigneeChange: (woId: string, name: string | null) => void;
  onDueDateChange: (woId: string, d: string | null) => void;
  onDescriptionChange: (woId: string, d: string) => void;
  onNotesChange: (woId: string, n: string) => void;
  onToggleCheck: (woId: string, itemId: string) => void;
  onAddCheckItem: (woId: string, label: string) => void;
  onRemoveCheckItem: (woId: string, itemId: string) => void;
  onAddComment: (woId: string, text: string) => void;
  onTitleChange: (woId: string, t: string) => void;
  onBulkAssign: (ids: string[], name: string) => void;
  onBulkPriority: (ids: string[], p: WOPriority) => void;
  onBulkStatus: (ids: string[], s: WOStatus) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null);
  const [filterReporter, setFilterReporter] = useState<string>('');
  const [filterLocation, setFilterLocation] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedWO = workOrders.find(w => w.id === selectedId) || null;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: workOrders.length };
    for (const s of ALL_STATUSES) counts[s] = 0;
    for (const wo of workOrders) counts[wo.status] = (counts[wo.status] || 0) + 1;
    counts.pending_approval = (counts.pending_approval || 0) + (counts.submitted || 0);
    return counts;
  }, [workOrders]);

  const filtered = useMemo(() => {
    return workOrders.filter(wo => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending_approval') {
          if (wo.status !== 'pending_approval' && wo.status !== 'submitted') return false;
        } else if (wo.status !== statusFilter) return false;
      }
      if (searchQuery.trim()) {
        if (!fuzzyMatch(searchQuery, buildSearchHaystack(wo))) return false;
      }
      if (filterPriority && wo.priority !== filterPriority) return false;
      if (filterType && wo.type !== filterType) return false;
      if (filterAssignee) {
        if (filterAssignee === '__unassigned__') {
          if (wo.assigneeName !== null) return false;
        } else if (wo.assigneeName !== filterAssignee) return false;
      }
      if (filterReporter && wo.reporterName !== filterReporter) return false;
      if (filterLocation && wo.location !== filterLocation) return false;
      if (filterSource && wo.source !== filterSource) return false;
      if (filterOverdueOnly && !isOverdue(wo.dueDate, wo.status)) return false;
      return true;
    });
  }, [workOrders, statusFilter, searchQuery, filterPriority, filterType, filterAssignee, filterReporter, filterLocation, filterSource, filterOverdueOnly]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case 'priority':
          return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) * dir;
        case 'dueDate': {
          const da = a.dueDate || '9999-99-99';
          const db = b.dueDate || '9999-99-99';
          return da.localeCompare(db) * dir;
        }
        case 'status':
          return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * dir;
        case 'assignee': {
          const na = a.assigneeName || 'zzz';
          const nb = b.assigneeName || 'zzz';
          return na.localeCompare(nb) * dir;
        }
        case 'created': {
          const ca = a.activity[a.activity.length - 1]?.date || '';
          const cb = b.activity[b.activity.length - 1]?.date || '';
          return ca.localeCompare(cb) * dir;
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const activeWOs = workOrders.filter(w => w.status !== 'completed' && w.status !== 'cancelled');
  const unassignedCount = activeWOs.filter(w => !w.assigneeName).length;
  const overdueCount = workOrders.filter(w => isOverdue(w.dueDate, w.status)).length;
  const pendingApprovalCount = workOrders.filter(w => w.status === 'pending_approval' || w.status === 'submitted').length;
  const inProgressCount = workOrders.filter(w => w.status === 'in_progress').length;
  const completedCount = workOrders.filter(w => w.status === 'completed').length;

  const activeFilterCount = [filterPriority, filterType, filterAssignee, filterReporter, filterLocation, filterSource, filterOverdueOnly]
    .filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterPriority('');
    setFilterType('');
    setFilterAssignee(null);
    setFilterReporter('');
    setFilterLocation('');
    setFilterSource('');
    setFilterOverdueOnly(false);
    setStatusFilter('all');
    setSearchQuery('');
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleCheckRow = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllRows = () => {
    if (checkedIds.size === sorted.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(sorted.map(w => w.id)));
    }
  };

  const pillFilters: { key: string; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: statusCounts.all },
    { key: 'draft', label: 'Draft', count: statusCounts.draft },
    { key: 'pending_approval', label: 'Pending Approval', count: statusCounts.pending_approval },
    { key: 'open', label: 'Open', count: statusCounts.open },
    { key: 'in_progress', label: 'In Progress', count: statusCounts.in_progress },
    { key: 'on_hold', label: 'On Hold', count: statusCounts.on_hold },
    { key: 'completed', label: 'Completed', count: statusCounts.completed },
    { key: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-5 min-w-0">
        <div className="flex items-center gap-4 mb-4 text-xs flex-wrap">
          <span className="text-slate-600 font-medium">{activeWOs.length} Active</span>
          <span className="text-slate-300">·</span>
          <button
            onClick={() => setFilterAssignee(filterAssignee === '__unassigned__' ? null : '__unassigned__')}
            className={`font-medium ${unassignedCount > 0 ? 'text-amber-600 hover:underline' : 'text-slate-400'}`}
          >
            {unassignedCount} Unassigned
          </button>
          <span className="text-slate-300">·</span>
          <button
            onClick={() => setFilterOverdueOnly(!filterOverdueOnly)}
            className={`font-medium ${overdueCount > 0 ? 'text-red-600 hover:underline' : 'text-slate-400'}`}
          >
            {overdueCount} Overdue
          </button>
          <span className="text-slate-300">·</span>
          <button
            onClick={() => setStatusFilter(statusFilter === 'pending_approval' ? 'all' : 'pending_approval')}
            className={`font-medium ${pendingApprovalCount > 0 ? 'text-amber-600 hover:underline' : 'text-slate-400'}`}
          >
            {pendingApprovalCount} Pending Approval
          </button>
          <span className="text-slate-300">·</span>
          <span className="text-blue-600 font-medium">{inProgressCount} In Progress</span>
          <span className="text-slate-300">·</span>
          <span className="text-emerald-600 font-medium">{completedCount} Completed</span>
        </div>

        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          {pillFilters.map(p => (
            <button
              key={p.key}
              onClick={() => setStatusFilter(p.key)}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                statusFilter === p.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label} ({p.count})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search work orders... (fuzzy match)"
              className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter size={13} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] px-1.5 rounded-full">{activeFilterCount}</span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button onClick={clearAllFilters} className="text-xs text-slate-500 hover:text-slate-700">
              Clear all
            </button>
          )}
          <button
            onClick={onToggleNewForm}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} /> New Work Order
          </button>
        </div>

        {showFilters && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase mb-0.5">Priority</label>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded bg-white">
                <option value="">All</option>
                {ALL_PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase mb-0.5">Type</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded bg-white">
                <option value="">All</option>
                {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase mb-0.5">Assignee</label>
              <select value={filterAssignee || ''} onChange={e => setFilterAssignee(e.target.value || null)} className="w-full px-2 py-1 border border-slate-200 rounded bg-white">
                <option value="">All</option>
                <option value="__unassigned__">Unassigned</option>
                {TECHNICIAN_POOL.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase mb-0.5">Reporter</label>
              <select value={filterReporter} onChange={e => setFilterReporter(e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded bg-white">
                <option value="">All</option>
                {ALL_REPORTERS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase mb-0.5">Location</label>
              <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded bg-white">
                <option value="">All</option>
                {ALL_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase mb-0.5">Source</label>
              <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded bg-white">
                <option value="">All</option>
                {ALL_SOURCES.map(s => <option key={s} value={s}>{SOURCE_BADGE[s].label}</option>)}
              </select>
            </div>
          </div>
        )}

        {showNewForm && (
          <NewWOForm
            onSubmit={data => { onCreateWO(data); }}
            onCancel={onToggleNewForm}
          />
        )}

        {checkedIds.size > 0 && (
          <BulkActionsBar
            count={checkedIds.size}
            onAssign={name => { onBulkAssign(Array.from(checkedIds), name); setCheckedIds(new Set()); }}
            onPriority={p => { onBulkPriority(Array.from(checkedIds), p); setCheckedIds(new Set()); }}
            onStatus={s => { onBulkStatus(Array.from(checkedIds), s); setCheckedIds(new Set()); }}
            onClear={() => setCheckedIds(new Set())}
          />
        )}

        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                <th className="w-8 px-2 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={sorted.length > 0 && checkedIds.size === sorted.length}
                    onChange={toggleAllRows}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                </th>
                <th className="px-2 py-2.5 text-left">WO #</th>
                <th className="px-2 py-2.5 text-left">Title</th>
                <th className="px-2 py-2.5 text-left hidden lg:table-cell">Asset</th>
                <th className="px-2 py-2.5 text-left hidden xl:table-cell">Type</th>
                <th className="px-2 py-2.5 text-left cursor-pointer select-none" onClick={() => toggleSort('priority')}>
                  <span className="inline-flex items-center gap-1">
                    Priority
                    {sortField === 'priority' && <ArrowUpDown size={11} className="text-blue-600" />}
                  </span>
                </th>
                <th className="px-2 py-2.5 text-left cursor-pointer select-none" onClick={() => toggleSort('status')}>
                  <span className="inline-flex items-center gap-1">
                    Status
                    {sortField === 'status' && <ArrowUpDown size={11} className="text-blue-600" />}
                  </span>
                </th>
                <th className="px-2 py-2.5 text-left cursor-pointer select-none" onClick={() => toggleSort('assignee')}>
                  <span className="inline-flex items-center gap-1">
                    Assignee
                    {sortField === 'assignee' && <ArrowUpDown size={11} className="text-blue-600" />}
                  </span>
                </th>
                <th className="px-2 py-2.5 text-left hidden xl:table-cell">Source</th>
                <th className="px-2 py-2.5 text-left cursor-pointer select-none" onClick={() => toggleSort('dueDate')}>
                  <span className="inline-flex items-center gap-1">
                    Due
                    {sortField === 'dueDate' && <ArrowUpDown size={11} className="text-blue-600" />}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map(wo => {
                const overdue = isOverdue(wo.dueDate, wo.status);
                const isSelected = wo.id === selectedId;
                return (
                  <tr
                    key={wo.id}
                    onClick={() => onSelect(wo.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checkedIds.has(wo.id)}
                        onChange={() => toggleCheckRow(wo.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                    </td>
                    <td className="px-2 py-2.5 font-mono text-slate-400 whitespace-nowrap">{wo.wo_number}</td>
                    <td className="px-2 py-2.5 font-medium text-slate-800 max-w-[220px] truncate">{wo.title}</td>
                    <td className="px-2 py-2.5 text-slate-600 hidden lg:table-cell whitespace-nowrap">
                      {wo.assetName ? (
                        <span>{wo.assetName} <span className="text-slate-400">({wo.assetInv})</span></span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-slate-500 hidden xl:table-cell whitespace-nowrap">{wo.type}</td>
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${PRIORITY_BADGE[wo.priority]}`}>
                        {wo.priority}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE[wo.status]}`}>
                        {STATUS_LABEL[wo.status]}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      {wo.assigneeName ? (
                        <span className="text-slate-700">{wo.assigneeName}</span>
                      ) : (
                        <span className="text-amber-600 font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 hidden xl:table-cell whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${SOURCE_BADGE[wo.source].cls}`}>
                        {SOURCE_BADGE[wo.source].label}
                      </span>
                    </td>
                    <td className={`px-2 py-2.5 whitespace-nowrap ${overdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                      {formatDate(wo.dueDate)}
                      {overdue && <span className="ml-1 text-[10px]">!</span>}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    No work orders match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="w-[340px] xl:w-[380px] shrink-0 h-full overflow-hidden">
        {selectedWO ? (
          <DetailPanel
            wo={selectedWO}
            mode="management"
            onClose={() => onSelect(null)}
            onStatusChange={s => onStatusChange(selectedWO.id, s)}
            onPriorityChange={p => onPriorityChange(selectedWO.id, p)}
            onTypeChange={t => onTypeChange(selectedWO.id, t)}
            onAssigneeChange={name => onAssigneeChange(selectedWO.id, name)}
            onDueDateChange={d => onDueDateChange(selectedWO.id, d)}
            onDescriptionChange={d => onDescriptionChange(selectedWO.id, d)}
            onNotesChange={n => onNotesChange(selectedWO.id, n)}
            onToggleCheck={itemId => onToggleCheck(selectedWO.id, itemId)}
            onAddCheckItem={label => onAddCheckItem(selectedWO.id, label)}
            onRemoveCheckItem={itemId => onRemoveCheckItem(selectedWO.id, itemId)}
            onAddComment={text => onAddComment(selectedWO.id, text)}
            onTitleChange={t => onTitleChange(selectedWO.id, t)}
          />
        ) : (
          <AssigneePanel
            workOrders={workOrders}
            activeAssigneeFilter={filterAssignee}
            onFilterAssignee={setFilterAssignee}
          />
        )}
      </div>
    </div>
  );
}
