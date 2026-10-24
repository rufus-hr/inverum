import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Wrench } from 'lucide-react';
import { useApiQuery, useApiMutation } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { apiFetch } from '../lib/api';
import type { PagedResponse, AssetResponse } from '../types/api';
import {
  WorkOrder, WOStatus, WOPriority, WOType, WOSource, UndoItem,
  CURRENT_USER, MOCK_ASSETS, initialWorkOrders, STATUS_SHORT_LABEL,
  UndoToast, nextUndoId,
} from '../components/work-orders/WOTypesAndHelpers';
import { MyQueueTab, ManagementTab } from '../components/work-orders/WorkOrderBoard';

interface ApiWorkOrder {
  id: string;
  wo_number?: string;
  number?: string;
  title: string;
  description?: string | null;
  type?: string;
  priority?: string;
  status: string;
  asset_id?: string | null;
  asset_name?: string | null;
  asset_inv?: string | null;
  asset_type?: string | null;
  location_name?: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  reporter_id?: string | null;
  reporter_name?: string | null;
  source?: string;
  source_ref?: string | null;
  external_ticket_ref?: string | null;
  requires_approval?: boolean;
  approver_name?: string | null;
  due_date?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  notes?: string | null;
  findings?: string | null;
  created_at?: string;
}

export default function WorkOrdersView() {
  const toast = useToast();
  const { data: apiData, refetch: refetchWOs } = useApiQuery<PagedResponse<ApiWorkOrder>>('/work-orders/?limit=100');
  const { data: assetsData } = useApiQuery<PagedResponse<AssetResponse>>('/assets/?limit=200');
  const createWOMutation = useApiMutation<unknown, Record<string, unknown>>('/work-orders/', 'POST');

  const assetMap = useMemo(() => {
    const map = new Map<string, AssetResponse>();
    for (const a of assetsData?.items ?? []) {
      map.set(a.id, a);
    }
    return map;
  }, [assetsData]);

  const mappedWorkOrders: WorkOrder[] | null = useMemo(() => {
    if (!apiData?.items) return null;
    return apiData.items.map(wo => {
      const linkedAsset = wo.asset_id ? assetMap.get(wo.asset_id) : undefined;
      return {
        id: wo.id,
        wo_number: wo.wo_number ?? wo.number ?? '',
        title: wo.title,
        description: wo.description ?? '',
        type: (wo.type ?? 'Repair') as WOType,
        priority: (wo.priority ?? 'medium') as WOPriority,
        status: wo.status as WOStatus,
        asset_id: wo.asset_id ?? null,
        assetName: wo.asset_name ?? linkedAsset?.name ?? null,
        assetInv: wo.asset_inv ?? linkedAsset?.inventory_number ?? null,
        assetType: wo.asset_type ?? linkedAsset?.category_name ?? null,
        location: wo.location_name ?? linkedAsset?.location_path ?? 'Zagreb HQ',
        assignee_id: wo.assignee_id ?? null,
        assigneeName: wo.assignee_name ?? CURRENT_USER,
        reporter_id: wo.reporter_id ?? '',
        reporterName: wo.reporter_name ?? CURRENT_USER,
        source: (wo.source ?? 'manual') as WOSource,
        sourceRef: wo.source_ref ?? null,
        externalTicketRef: wo.external_ticket_ref ?? null,
        requiresApproval: wo.requires_approval ?? false,
        approverName: wo.approver_name ?? null,
        dueDate: wo.due_date ?? (wo.scheduled_at ? wo.scheduled_at.slice(0, 10) : null),
        startedAt: wo.started_at ?? null,
        completedAt: wo.completed_at ?? null,
        estimatedHours: wo.estimated_hours ?? null,
        actualHours: wo.actual_hours ?? null,
        checklist: [],
        activity: wo.created_at ? [{ id: 'a1', action: 'Created', date: wo.created_at, actor: wo.reporter_name ?? 'System' }] : [],
        notes: wo.notes ?? wo.findings ?? '',
        comments: [],
      };
    });
  }, [apiData, assetMap]);

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders);
  useEffect(() => {
    if (mappedWorkOrders && mappedWorkOrders.length > 0) setWorkOrders(mappedWorkOrders);
  }, [mappedWorkOrders]);

  const [activeTab, setActiveTab] = useState<'queue' | 'management'>('queue');
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [selectedMgmtId, setSelectedMgmtId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [undoItem, setUndoItem] = useState<UndoItem | null>(null);

  const pushUndo = useCallback((label: string, snapshot: WorkOrder[]) => {
    const id = nextUndoId();
    setUndoItem({
      id,
      label,
      undo: () => setWorkOrders(snapshot),
    });
  }, []);

  const persistWOUpdate = useCallback(async (woId: string, payload: Record<string, unknown>) => {
    if (woId.startsWith('wo-')) return;
    try {
      await apiFetch(`/work-orders/${woId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      refetchWOs();
    } catch {
      // Keep optimistic state if offline/mock
    }
  }, [refetchWOs]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Escape') {
        if (showNewForm) {
          setShowNewForm(false);
        } else if (activeTab === 'queue' && selectedQueueId) {
          setSelectedQueueId(null);
        } else if (activeTab === 'management' && selectedMgmtId) {
          setSelectedMgmtId(null);
        }
        return;
      }

      if (isInput) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (activeTab !== 'management') setActiveTab('management');
        setShowNewForm(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, selectedQueueId, selectedMgmtId, showNewForm]);

  const updateWO = useCallback((woId: string, updater: (wo: WorkOrder) => WorkOrder) => {
    setWorkOrders(prev => prev.map(w => w.id === woId ? updater(w) : w));
  }, []);

  const handleStatusChange = useCallback((woId: string, newStatus: WOStatus) => {
    const snapshot = [...workOrders];
    const target = workOrders.find(w => w.id === woId);
    if (!target) return;

    const now = new Date().toISOString();
    const statusLabel = STATUS_SHORT_LABEL[newStatus];

    updateWO(woId, wo => ({
      ...wo,
      status: newStatus,
      startedAt: newStatus === 'in_progress' && !wo.startedAt ? now : wo.startedAt,
      completedAt: newStatus === 'completed' ? now : wo.completedAt,
      activity: [
        { id: `act-${Date.now()}`, action: statusLabel, date: now, actor: CURRENT_USER },
        ...wo.activity,
      ],
    }));

    pushUndo(`${target.wo_number} → ${statusLabel}`, snapshot);
    void persistWOUpdate(woId, {
      status: newStatus,
      completed_at: newStatus === 'completed' ? now : undefined,
    });
  }, [workOrders, updateWO, pushUndo, persistWOUpdate]);

  const handlePriorityChange = useCallback((woId: string, p: WOPriority) => {
    const snapshot = [...workOrders];
    const target = workOrders.find(w => w.id === woId);
    updateWO(woId, wo => ({ ...wo, priority: p }));
    if (target) pushUndo(`${target.wo_number} priority → ${p}`, snapshot);
  }, [workOrders, updateWO, pushUndo]);

  const handleTypeChange = useCallback((woId: string, t: WOType) => {
    updateWO(woId, wo => ({ ...wo, type: t }));
    void persistWOUpdate(woId, { type: t });
  }, [updateWO, persistWOUpdate]);

  const handleAssigneeChange = useCallback((woId: string, name: string | null) => {
    const snapshot = [...workOrders];
    const target = workOrders.find(w => w.id === woId);
    const now = new Date().toISOString();
    updateWO(woId, wo => ({
      ...wo,
      assignee_id: name ? `u-${name}` : null,
      assigneeName: name,
      activity: [
        { id: `act-${Date.now()}`, action: name ? `Assigned to ${name}` : 'Unassigned', date: now, actor: CURRENT_USER },
        ...wo.activity,
      ],
    }));
    if (target) pushUndo(`${target.wo_number} → ${name || 'Unassigned'}`, snapshot);
  }, [workOrders, updateWO, pushUndo]);

  const handleTakeIt = useCallback((woId: string) => {
    handleAssigneeChange(woId, CURRENT_USER);
  }, [handleAssigneeChange]);

  const handleDueDateChange = useCallback((woId: string, d: string | null) => {
    updateWO(woId, wo => ({ ...wo, dueDate: d }));
    void persistWOUpdate(woId, { scheduled_at: d ? new Date(d).toISOString() : null });
  }, [updateWO, persistWOUpdate]);

  const handleDescriptionChange = useCallback((woId: string, d: string) => {
    updateWO(woId, wo => ({ ...wo, description: d }));
    void persistWOUpdate(woId, { description: d });
  }, [updateWO, persistWOUpdate]);

  const handleNotesChange = useCallback((woId: string, n: string) => {
    updateWO(woId, wo => ({ ...wo, notes: n }));
    void persistWOUpdate(woId, { findings: n });
  }, [updateWO, persistWOUpdate]);

  const handleTitleChange = useCallback((woId: string, t: string) => {
    updateWO(woId, wo => ({ ...wo, title: t }));
    void persistWOUpdate(woId, { title: t });
  }, [updateWO, persistWOUpdate]);

  const handleToggleCheck = useCallback((woId: string, itemId: string) => {
    updateWO(woId, wo => ({
      ...wo,
      checklist: wo.checklist.map(c => c.id === itemId ? { ...c, done: !c.done } : c),
    }));
  }, [updateWO]);

  const handleAddCheckItem = useCallback((woId: string, label: string) => {
    updateWO(woId, wo => ({
      ...wo,
      checklist: [...wo.checklist, { id: `chk-${Date.now()}`, label, done: false }],
    }));
  }, [updateWO]);

  const handleRemoveCheckItem = useCallback((woId: string, itemId: string) => {
    updateWO(woId, wo => ({
      ...wo,
      checklist: wo.checklist.filter(c => c.id !== itemId),
    }));
  }, [updateWO]);

  const handleAddComment = useCallback((woId: string, text: string) => {
    const now = new Date().toISOString();
    updateWO(woId, wo => ({
      ...wo,
      comments: [...wo.comments, { id: `cmt-${Date.now()}`, author: CURRENT_USER, text, date: now }],
    }));
  }, [updateWO]);

  const handleCreateWO = useCallback(async (data: {
    title: string; type: WOType; priority: WOPriority;
    asset_id: string | null; location: string; assigneeName: string | null;
    dueDate: string; description: string; requiresApproval: boolean;
  }) => {
    const nextNum = workOrders.length + 1;
    const woNumber = `WO-2026-${String(nextNum).padStart(3, '0')}`;
    const asset = data.asset_id ? MOCK_ASSETS.find(a => a.id === data.asset_id) : null;
    const now = new Date().toISOString();

    try {
      await createWOMutation.mutate({
        number: woNumber,
        title: data.title,
        type: data.type,
        status: data.requiresApproval ? 'draft' : 'open',
        description: data.description || null,
        scheduled_at: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        asset_id: data.asset_id && !data.asset_id.startsWith('a') ? data.asset_id : null,
      });
      toast.success(`Radni nalog ${woNumber} kreiran`);
      refetchWOs();
    } catch {
      const newWO: WorkOrder = {
        id: `wo-${Date.now()}`,
        wo_number: woNumber,
        title: data.title,
        description: data.description,
        type: data.type,
        priority: data.priority,
        status: data.requiresApproval ? 'draft' : 'open',
        asset_id: data.asset_id,
        assetName: asset?.name || null,
        assetInv: asset?.inv || null,
        assetType: asset?.type || null,
        location: data.location,
        assignee_id: data.assigneeName ? `u-${data.assigneeName}` : null,
        assigneeName: data.assigneeName,
        reporter_id: 'u1',
        reporterName: CURRENT_USER,
        source: 'manual',
        sourceRef: null,
        externalTicketRef: null,
        requiresApproval: data.requiresApproval,
        approverName: data.requiresApproval ? 'Nikola Šimić' : null,
        dueDate: data.dueDate || null,
        startedAt: null,
        completedAt: null,
        estimatedHours: null,
        actualHours: null,
        checklist: [],
        activity: [{ id: `act-${Date.now()}`, action: 'Created', date: now, actor: CURRENT_USER }],
        notes: '',
        comments: [],
      };
      setWorkOrders(prev => [newWO, ...prev]);
      setSelectedMgmtId(newWO.id);
    }
    setShowNewForm(false);
  }, [workOrders.length, createWOMutation, refetchWOs, toast]);

  const handleBulkAssign = useCallback((ids: string[], name: string) => {
    const snapshot = [...workOrders];
    const now = new Date().toISOString();
    setWorkOrders(prev => prev.map(w =>
      ids.includes(w.id)
        ? {
            ...w,
            assignee_id: `u-${name}`,
            assigneeName: name,
            activity: [{ id: `act-${Date.now()}-${w.id}`, action: `Assigned to ${name}`, date: now, actor: CURRENT_USER }, ...w.activity],
          }
        : w
    ));
    pushUndo(`${ids.length} WOs assigned to ${name}`, snapshot);
  }, [workOrders, pushUndo]);

  const handleBulkPriority = useCallback((ids: string[], p: WOPriority) => {
    const snapshot = [...workOrders];
    setWorkOrders(prev => prev.map(w => ids.includes(w.id) ? { ...w, priority: p } : w));
    pushUndo(`${ids.length} WOs priority → ${p}`, snapshot);
  }, [workOrders, pushUndo]);

  const handleBulkStatus = useCallback((ids: string[], s: WOStatus) => {
    const snapshot = [...workOrders];
    const now = new Date().toISOString();
    const label = STATUS_SHORT_LABEL[s];
    setWorkOrders(prev => prev.map(w =>
      ids.includes(w.id)
        ? {
            ...w,
            status: s,
            startedAt: s === 'in_progress' && !w.startedAt ? now : w.startedAt,
            completedAt: s === 'completed' ? now : w.completedAt,
            activity: [{ id: `act-${Date.now()}-${w.id}`, action: label, date: now, actor: CURRENT_USER }, ...w.activity],
          }
        : w
    ));
    pushUndo(`${ids.length} WOs → ${label}`, snapshot);
    ids.forEach(id => {
      void persistWOUpdate(id, { status: s, completed_at: s === 'completed' ? now : undefined });
    });
  }, [workOrders, pushUndo, persistWOUpdate]);

  const myQueueCount = workOrders.filter(wo =>
    wo.assigneeName === CURRENT_USER && wo.status !== 'completed' && wo.status !== 'cancelled'
  ).length;

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-5 pt-4 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Wrench size={20} className="text-blue-600" />
            <h1 className="text-lg font-bold text-slate-800">Work Orders</h1>
          </div>
          <span className="text-[11px] text-slate-400">
            Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">N</kbd> for new WO · <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">Esc</kbd> to close panel
          </span>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('queue')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'queue'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            My Queue
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
              activeTab === 'queue' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {myQueueCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('management')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'management'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Management
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
              activeTab === 'management' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {workOrders.length}
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'queue' ? (
          <MyQueueTab
            workOrders={workOrders}
            selectedId={selectedQueueId}
            onSelect={setSelectedQueueId}
            onStatusChange={handleStatusChange}
            onToggleCheck={handleToggleCheck}
            onTakeIt={handleTakeIt}
            onNotesChange={handleNotesChange}
            onAddComment={handleAddComment}
          />
        ) : (
          <ManagementTab
            workOrders={workOrders}
            selectedId={selectedMgmtId}
            onSelect={setSelectedMgmtId}
            showNewForm={showNewForm}
            onToggleNewForm={() => setShowNewForm(f => !f)}
            onCreateWO={handleCreateWO}
            onStatusChange={handleStatusChange}
            onPriorityChange={handlePriorityChange}
            onTypeChange={handleTypeChange}
            onAssigneeChange={handleAssigneeChange}
            onDueDateChange={handleDueDateChange}
            onDescriptionChange={handleDescriptionChange}
            onNotesChange={handleNotesChange}
            onToggleCheck={handleToggleCheck}
            onAddCheckItem={handleAddCheckItem}
            onRemoveCheckItem={handleRemoveCheckItem}
            onAddComment={handleAddComment}
            onTitleChange={handleTitleChange}
            onBulkAssign={handleBulkAssign}
            onBulkPriority={handleBulkPriority}
            onBulkStatus={handleBulkStatus}
          />
        )}
      </div>

      {undoItem && (
        <UndoToast item={undoItem} onDismiss={() => setUndoItem(null)} />
      )}
    </div>
  );
}
