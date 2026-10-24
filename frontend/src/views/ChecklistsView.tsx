import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ClipboardCheck, Calendar } from 'lucide-react';
import { useApiQuery } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { apiFetch } from '../lib/api';
import type { PagedResponse, AssetResponse, LocationResponse } from '../types/api';
import {
  TabKey, Frequency, CompletionStatus, SopTemplate, ChecklistCompletion,
  MaintenanceSchedule, INITIAL_TEMPLATES, INITIAL_COMPLETIONS, INITIAL_SCHEDULES,
  INTERVAL_DAYS_MAP, daysToScheduleInterval, genId,
} from '../components/checklists/ChecklistTypesAndHelpers';
import { TemplateListPanel, TemplateEditor } from '../components/checklists/TemplatesTab';
import { ActiveChecklistsTab } from '../components/checklists/ActiveChecklistsTab';
import { SchedulesTab } from '../components/checklists/SchedulesTab';

// ── API Response Shapes ─────────────────────────────────────────────────────

interface ApiTemplateItem {
  id: string;
  text: string;
  order_index: number;
  is_blocking: boolean;
  requires_note: boolean;
  depends_on_item_id: string | null;
}

interface ApiTemplate {
  id: string;
  name: string;
  trigger_event?: string;
  triggers?: string[];
  asset_category?: string | null;
  asset_categories?: string[];
  frequency: string;
  is_required: boolean;
  requires_confirmation: boolean;
  confirmation_group_id?: string | null;
  is_active: boolean;
  items?: ApiTemplateItem[];
}

interface ApiCompletionItem {
  id: string;
  text: string;
  order_index: number;
  is_blocking: boolean;
  requires_note: boolean;
  depends_on: string | null;
  item_id: string;
  checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  note: string | null;
}

interface ApiCompletion {
  id: string;
  template_id: string;
  template_name?: string;
  trigger?: string;
  status: string;
  asset_id?: string;
  asset_name?: string;
  asset_inv?: string;
  asset_type?: string;
  asset_location?: string;
  triggered_by: string;
  created_at?: string;
  submitted_by?: string | null;
  submitted_at: string | null;
  confirmed_by?: string | null;
  confirmed_at: string | null;
  requires_confirmation?: boolean;
  pending_transition?: string | null;
  items?: ApiCompletionItem[];
}

interface ApiSchedule {
  id: string;
  name: string;
  template_id: string;
  asset_category_id: string | null;
  location_id: string | null;
  interval_days: number;
  last_run_at: string | null;
  next_run_at: string | null;
  is_active: boolean;
  notes: string | null;
}

export default function ChecklistsView() {
  const toast = useToast();

  // Backend returns raw array for /checklists/templates and /checklists/completions, or PagedResponse
  const { data: apiTemplatesRaw, refetch: refetchTemplates } = useApiQuery<ApiTemplate[] | PagedResponse<ApiTemplate>>('/checklists/templates?limit=100');
  const { data: apiCompletionsRaw, refetch: refetchCompletions } = useApiQuery<ApiCompletion[] | PagedResponse<ApiCompletion>>('/checklists/completions?limit=100');
  const { data: apiSchedulesData, refetch: refetchSchedules } = useApiQuery<PagedResponse<ApiSchedule>>('/maintenance-schedules/?limit=100');
  const { data: assetsData } = useApiQuery<PagedResponse<AssetResponse>>('/assets/?limit=200');
  const { data: locationsData } = useApiQuery<PagedResponse<LocationResponse>>('/locations/?limit=200');

  const assetMap = useMemo(() => {
    const map = new Map<string, AssetResponse>();
    for (const a of assetsData?.items ?? []) map.set(a.id, a);
    return map;
  }, [assetsData]);

  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of locationsData?.items ?? []) map.set(l.id, l.name);
    return map;
  }, [locationsData]);

  const mappedTemplates: SopTemplate[] | null = useMemo(() => {
    const list = Array.isArray(apiTemplatesRaw) ? apiTemplatesRaw : apiTemplatesRaw?.items;
    if (!list) return null;
    return list.map(t => ({
      id: t.id,
      name: t.name,
      triggers: t.triggers ?? (t.trigger_event ? [t.trigger_event] : []),
      assetCategories: t.asset_categories ?? (t.asset_category ? [t.asset_category] : []),
      frequency: (t.frequency || 'per_event') as Frequency,
      isRequired: t.is_required,
      requiresConfirmation: t.requires_confirmation,
      confirmationGroupId: t.confirmation_group_id ?? null,
      isActive: t.is_active,
      items: (t.items ?? []).map(i => ({
        id: i.id,
        text: i.text,
        orderIndex: i.order_index,
        isBlocking: i.is_blocking,
        requiresNote: i.requires_note,
        dependsOn: i.depends_on_item_id,
      })),
    }));
  }, [apiTemplatesRaw]);

  const [templates, setTemplates] = useState<SopTemplate[]>(INITIAL_TEMPLATES);
  useEffect(() => {
    if (mappedTemplates && mappedTemplates.length > 0) setTemplates(mappedTemplates);
  }, [mappedTemplates]);

  const mappedCompletions: ChecklistCompletion[] | null = useMemo(() => {
    const list = Array.isArray(apiCompletionsRaw) ? apiCompletionsRaw : apiCompletionsRaw?.items;
    if (!list) return null;
    return list.map(c => {
      const tpl = templates.find(t => t.id === c.template_id);
      const asset = c.asset_id ? assetMap.get(c.asset_id) : undefined;
      return {
        id: c.id,
        templateId: c.template_id,
        templateName: c.template_name ?? tpl?.name ?? 'SOP Checklist',
        trigger: c.trigger ?? tpl?.triggers[0] ?? 'asset_stock_to_assigned',
        status: c.status as CompletionStatus,
        assetName: c.asset_name ?? asset?.name ?? 'Asset',
        assetInv: c.asset_inv ?? asset?.inventory_number ?? '',
        assetType: c.asset_type ?? asset?.category_name ?? 'Equipment',
        assetLocation: c.asset_location ?? asset?.location_path ?? 'Zagreb HQ',
        triggeredBy: c.triggered_by,
        createdAt: c.created_at ?? new Date().toISOString(),
        submittedBy: c.submitted_by ?? null,
        submittedAt: c.submitted_at,
        confirmedBy: c.confirmed_by ?? null,
        confirmedAt: c.confirmed_at,
        requiresConfirmation: c.requires_confirmation ?? tpl?.requiresConfirmation ?? false,
        pendingTransition: c.pending_transition ?? null,
        items: (c.items ?? []).map(i => ({
          id: i.id,
          text: i.text,
          orderIndex: i.order_index,
          isBlocking: i.is_blocking,
          requiresNote: i.requires_note,
          dependsOn: i.depends_on,
          itemId: i.item_id,
          checked: i.checked,
          checkedBy: i.checked_by,
          checkedAt: i.checked_at,
          note: i.note,
        })),
      };
    });
  }, [apiCompletionsRaw, templates, assetMap]);

  const [completions, setCompletions] = useState<ChecklistCompletion[]>(INITIAL_COMPLETIONS);
  useEffect(() => {
    if (mappedCompletions && mappedCompletions.length > 0) setCompletions(mappedCompletions);
  }, [mappedCompletions]);

  const mappedSchedules: MaintenanceSchedule[] | null = useMemo(() => {
    if (!apiSchedulesData?.items) return null;
    return apiSchedulesData.items.map(s => {
      const tpl = templates.find(t => t.id === s.template_id);
      const { interval, customDays } = daysToScheduleInterval(s.interval_days);
      return {
        id: s.id,
        name: s.name,
        templateId: s.template_id,
        templateName: tpl?.name ?? 'Preventive Maintenance',
        assetTypeId: s.asset_category_id,
        locationId: s.location_id,
        locationName: s.location_id ? (locationMap.get(s.location_id) ?? s.location_id) : null,
        interval,
        customDays,
        lastRun: s.last_run_at ? s.last_run_at.slice(0, 10) : null,
        nextRun: s.next_run_at ? s.next_run_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
        isActive: s.is_active,
        notes: s.notes ?? '',
      };
    });
  }, [apiSchedulesData, templates, locationMap]);

  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>(INITIAL_SCHEDULES);
  useEffect(() => {
    if (mappedSchedules && mappedSchedules.length > 0) setSchedules(mappedSchedules);
  }, [mappedSchedules]);

  const [activeTab, setActiveTab] = useState<TabKey>('templates');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templates[0]?.id || null);
  const [tplSearch, setTplSearch] = useState('');
  const [tplFilterTrigger, setTplFilterTrigger] = useState('');
  const [tplFilterCategory, setTplFilterCategory] = useState('');

  const selectedTemplate = selectedTemplateId ? templates.find(t => t.id === selectedTemplateId) || null : null;

  const handleUpdateTemplate = useCallback(async (updated: SopTemplate) => {
    const prev = templates.find(t => t.id === updated.id);
    setTemplates(list => list.map(t => t.id === updated.id ? updated : t));

    if (updated.id.startsWith('t') || updated.id.startsWith('tpl_')) return;
    try {
      await apiFetch(`/checklists/templates/${updated.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: updated.name,
          trigger_event: updated.triggers[0] || 'asset_stock_to_assigned',
          asset_category: updated.assetCategories[0] || null,
          frequency: updated.frequency,
          is_required: updated.isRequired,
          requires_confirmation: updated.requiresConfirmation,
          is_active: updated.isActive,
        }),
      });

      // Check if an item was added or updated
      if (prev && updated.items.length > prev.items.length) {
        const added = updated.items[updated.items.length - 1];
        if (added.text.trim()) {
          await apiFetch(`/checklists/templates/${updated.id}/items`, {
            method: 'POST',
            body: JSON.stringify({
              text: added.text,
              order_index: added.orderIndex,
              is_blocking: added.isBlocking,
              requires_note: added.requiresNote,
            }),
          });
        }
      } else if (prev) {
        for (const it of updated.items) {
          const oldIt = prev.items.find(p => p.id === it.id);
          if (it.id.startsWith('item_') && it.text.trim() && (!oldIt || !oldIt.text.trim())) {
            await apiFetch(`/checklists/templates/${updated.id}/items`, {
              method: 'POST',
              body: JSON.stringify({
                text: it.text,
                order_index: it.orderIndex,
                is_blocking: it.isBlocking,
                requires_note: it.requiresNote,
              }),
            });
          } else if (!it.id.startsWith('item_') && !it.id.startsWith('i') && oldIt && (
            oldIt.text !== it.text || oldIt.isBlocking !== it.isBlocking || oldIt.requiresNote !== it.requiresNote
          )) {
            await apiFetch(`/checklists/items/${it.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                text: it.text,
                order_index: it.orderIndex,
                is_blocking: it.isBlocking,
                requires_note: it.requiresNote,
              }),
            });
          }
        }
      }
      refetchTemplates();
    } catch {
      // Fallback to local state
    }
  }, [templates, refetchTemplates]);

  const handleCreateTemplate = useCallback(async () => {
    try {
      const created = await apiFetch<ApiTemplate>('/checklists/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Untitled Template',
          trigger_event: 'asset_stock_to_assigned',
          asset_category: null,
          frequency: 'per_event',
          is_required: true,
          requires_confirmation: false,
        }),
      });
      toast.success('Predložak kreiran');
      refetchTemplates();
      setSelectedTemplateId(created.id);
    } catch {
      const newTpl: SopTemplate = {
        id: genId('tpl_'),
        name: 'Untitled Template',
        triggers: [],
        assetCategories: [],
        frequency: 'per_event',
        isRequired: false,
        requiresConfirmation: false,
        confirmationGroupId: null,
        isActive: true,
        items: [],
      };
      setTemplates(prev => [...prev, newTpl]);
      setSelectedTemplateId(newTpl.id);
    }
  }, [refetchTemplates, toast]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedTemplateId === id) setSelectedTemplateId(null);
    if (!id.startsWith('t') && !id.startsWith('tpl_')) {
      try {
        await apiFetch(`/checklists/templates/${id}`, { method: 'DELETE' });
        toast.success('Predložak obrisan');
        refetchTemplates();
      } catch {
        // Ignore if mock
      }
    }
  }, [selectedTemplateId, refetchTemplates, toast]);

  const handleToggleItemApi = useCallback(async (completionId: string, itemId: string, checked: boolean, note: string | null) => {
    if (completionId.startsWith('c')) return;
    try {
      if (checked) {
        await apiFetch(`/checklists/completions/${completionId}/items/${itemId}/check`, {
          method: 'POST',
          body: JSON.stringify({ note }),
        });
      } else {
        await apiFetch(`/checklists/completions/${completionId}/items/${itemId}/uncheck`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
      }
      refetchCompletions();
    } catch {
      // Ignore if mock
    }
  }, [refetchCompletions]);

  const handleSubmitCompletionApi = useCallback(async (completionId: string) => {
    if (completionId.startsWith('c')) return;
    try {
      await apiFetch(`/checklists/completions/${completionId}/submit`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success('Checklista predana');
      refetchCompletions();
    } catch {
      // Ignore
    }
  }, [refetchCompletions, toast]);

  const handleConfirmCompletionApi = useCallback(async (completionId: string) => {
    if (completionId.startsWith('c')) return;
    try {
      await apiFetch(`/checklists/completions/${completionId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success('Checklista potvrđena (4-oči)');
      refetchCompletions();
    } catch {
      // Ignore
    }
  }, [refetchCompletions, toast]);

  const handleCreateScheduleApi = useCallback(async (sched: MaintenanceSchedule) => {
    if (!sched.templateId || sched.templateId.startsWith('t')) return;
    try {
      await apiFetch('/maintenance-schedules/', {
        method: 'POST',
        body: JSON.stringify({
          name: sched.name,
          template_id: sched.templateId,
          interval_days: sched.customDays ?? INTERVAL_DAYS_MAP[sched.interval],
          next_run_at: new Date(sched.nextRun).toISOString(),
          notes: sched.notes || null,
        }),
      });
      refetchSchedules();
    } catch {
      // Ignore
    }
  }, [refetchSchedules]);

  const handleUpdateScheduleApi = useCallback(async (id: string, patch: Partial<MaintenanceSchedule>) => {
    if (id.startsWith('ms')) return;
    try {
      const payload: Record<string, unknown> = {};
      if (patch.name !== undefined) payload.name = patch.name;
      if (patch.isActive !== undefined) payload.is_active = patch.isActive;
      if (patch.notes !== undefined) payload.notes = patch.notes;
      if (patch.interval !== undefined) payload.interval_days = patch.customDays ?? INTERVAL_DAYS_MAP[patch.interval];
      if (patch.customDays !== undefined && patch.customDays !== null) payload.interval_days = patch.customDays;
      if (patch.nextRun !== undefined) payload.next_run_at = new Date(patch.nextRun).toISOString();
      if (Object.keys(payload).length > 0) {
        await apiFetch(`/maintenance-schedules/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        refetchSchedules();
      }
    } catch {
      // Ignore
    }
  }, [refetchSchedules]);

  const handleDeleteScheduleApi = useCallback(async (id: string) => {
    if (id.startsWith('ms')) return;
    try {
      await apiFetch(`/maintenance-schedules/${id}`, { method: 'DELETE' });
      toast.success('Raspored obrisan');
      refetchSchedules();
    } catch {
      // Ignore
    }
  }, [refetchSchedules, toast]);

  const openCount = completions.filter(c => c.status === 'open').length;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <ClipboardCheck size={20} className="text-blue-600" />
            <h1 className="text-lg font-semibold text-slate-800">Checklists &amp; SOPs</h1>
          </div>
        </div>
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('templates')}
            className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Templates
            <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {templates.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('completions')}
            className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'completions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Active Checklists
            {openCount > 0 && (
              <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                {openCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('schedules')}
            className={`pb-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'schedules'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calendar size={14} />
            Schedules
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {schedules.filter(s => s.isActive).length}
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'templates' && (
          <div className="flex h-full">
            <TemplateListPanel
              templates={templates}
              selectedId={selectedTemplateId}
              onSelect={setSelectedTemplateId}
              onCreate={handleCreateTemplate}
              searchQuery={tplSearch}
              onSearchChange={setTplSearch}
              filterTrigger={tplFilterTrigger}
              onFilterTriggerChange={setTplFilterTrigger}
              filterCategory={tplFilterCategory}
              onFilterCategoryChange={setTplFilterCategory}
            />
            {selectedTemplate ? (
              <TemplateEditor
                template={selectedTemplate}
                onUpdate={handleUpdateTemplate}
                onDeleteTemplate={handleDeleteTemplate}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                Select a template to edit
              </div>
            )}
          </div>
        )}

        {activeTab === 'completions' && (
          <ActiveChecklistsTab
            completions={completions}
            onUpdateCompletions={setCompletions}
            onToggleItemApi={handleToggleItemApi}
            onSubmitCompletionApi={handleSubmitCompletionApi}
            onConfirmCompletionApi={handleConfirmCompletionApi}
          />
        )}

        {activeTab === 'schedules' && (
          <SchedulesTab
            schedules={schedules}
            templates={templates}
            onUpdate={setSchedules}
            onCreateSchedule={handleCreateScheduleApi}
            onUpdateSchedule={handleUpdateScheduleApi}
            onDeleteSchedule={handleDeleteScheduleApi}
          />
        )}
      </div>
    </div>
  );
}
