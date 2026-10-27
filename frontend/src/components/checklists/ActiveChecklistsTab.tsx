import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck, Search, CheckCircle2, AlertTriangle,
  ChevronRight, X, Check, Lock, FileText, MapPin, Eye,
} from 'lucide-react';
import {
  ChecklistCompletion, CompletionStatus, StatusFilter, SopTemplate,
  CURRENT_USER, INITIAL_TEMPLATES, USER_GROUPS,
  relativeDate, formatDateTime, getTriggerBadge, getAssetIcon,
} from './ChecklistTypesAndHelpers';

// ── Active Checklists Tab ───────────────────────────────────────────────────

export function ActiveChecklistsTab({
  completions,
  templates = INITIAL_TEMPLATES,
  onUpdateCompletions,
  onToggleItemApi,
  onSubmitCompletionApi,
  onConfirmCompletionApi,
}: {
  completions: ChecklistCompletion[];
  templates?: SopTemplate[];
  onUpdateCompletions: (updated: ChecklistCompletion[]) => void;
  onToggleItemApi?: (completionId: string, itemId: string, checked: boolean, note: string | null) => void;
  onSubmitCompletionApi?: (completionId: string) => void;
  onConfirmCompletionApi?: (completionId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedId) {
        e.stopPropagation();
        setSelectedId(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedId]);

  const templateNames = useMemo(() => {
    const names = new Set(completions.map(c => c.templateName));
    return Array.from(names).sort();
  }, [completions]);

  const filtered = useMemo(() => {
    return completions.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!c.assetName.toLowerCase().includes(q) && !c.assetInv.toLowerCase().includes(q) && !c.templateName.toLowerCase().includes(q)) return false;
      }
      if (templateFilter && c.templateName !== templateFilter) return false;
      return true;
    });
  }, [completions, statusFilter, searchQuery, templateFilter]);

  const selected = selectedId ? completions.find(c => c.id === selectedId) || null : null;

  const statusCounts = useMemo(() => {
    const counts = { all: completions.length, open: 0, submitted: 0, confirmed: 0 };
    completions.forEach(c => counts[c.status]++);
    return counts;
  }, [completions]);

  const getProgress = (c: ChecklistCompletion) => {
    const total = c.items.length;
    const done = c.items.filter(i => i.checked).length;
    return { done, total, pct: total > 0 ? (done / total) * 100 : 0 };
  };

  const isItemBlocked = (item: ChecklistCompletion['items'][0], allItems: ChecklistCompletion['items']) => {
    if (!item.dependsOn) return false;
    const parent = allItems.find(i => i.id === item.dependsOn);
    return parent ? !parent.checked : false;
  };

  const getParentText = (depId: string, items: ChecklistCompletion['items']) => {
    const parent = items.find(i => i.id === depId);
    return parent ? parent.text : '';
  };

  const allBlockingChecked = (c: ChecklistCompletion) => {
    return c.items.filter(i => i.isBlocking).every(i => i.checked);
  };

  const toggleItem = (completionId: string, itemId: string) => {
    const comp = completions.find(c => c.id === completionId);
    if (!comp || comp.status !== 'open') return;

    const item = comp.items.find(i => i.id === itemId);
    if (!item) return;
    if (isItemBlocked(item, comp.items)) return;

    if (!item.checked && item.requiresNote) {
      const note = noteInputs[itemId];
      if (!note?.trim()) return;
    }

    const nextChecked = !item.checked;
    const nextNote = nextChecked && item.requiresNote ? (noteInputs[itemId] || null) : item.note;

    const updatedItems = comp.items.map(i =>
      i.id === itemId
        ? {
            ...i,
            checked: nextChecked,
            checkedBy: nextChecked ? CURRENT_USER : null,
            checkedAt: nextChecked ? new Date().toISOString() : null,
            note: nextNote,
          }
        : i
    );

    onUpdateCompletions(
      completions.map(c => c.id === completionId ? { ...c, items: updatedItems } : c)
    );
    onToggleItemApi?.(completionId, itemId, nextChecked, nextNote);

    if (nextChecked) {
      setNoteInputs(prev => { const n = { ...prev }; delete n[itemId]; return n; });
    }
  };

  const submitCompletion = (completionId: string) => {
    onUpdateCompletions(
      completions.map(c =>
        c.id === completionId
          ? { ...c, status: 'submitted' as CompletionStatus, submittedBy: CURRENT_USER, submittedAt: new Date().toISOString() }
          : c
      )
    );
    onSubmitCompletionApi?.(completionId);
  };

  const confirmCompletion = (completionId: string) => {
    onUpdateCompletions(
      completions.map(c =>
        c.id === completionId
          ? { ...c, status: 'confirmed' as CompletionStatus, confirmedBy: CURRENT_USER, confirmedAt: new Date().toISOString() }
          : c
      )
    );
    onConfirmCompletionApi?.(completionId);
  };

  const statusPills: { key: StatusFilter; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: '' },
    { key: 'open', label: 'Open', color: 'blue' },
    { key: 'submitted', label: 'Submitted', color: 'amber' },
    { key: 'confirmed', label: 'Confirmed', color: 'emerald' },
  ];

  const STATUS_BADGE: Record<CompletionStatus, string> = {
    open: 'bg-blue-50 text-blue-700 border border-blue-200/50',
    submitted: 'bg-amber-50 text-amber-700 border border-amber-200/50',
    confirmed: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
  };

  const STATUS_LABEL: Record<CompletionStatus, string> = {
    open: 'OPEN',
    submitted: 'SUBMITTED',
    confirmed: 'CONFIRMED',
  };

  return (
    <div className="flex h-full">
      <div className={`flex-1 flex flex-col min-w-0 ${selected ? 'border-r border-slate-200' : ''}`}>
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-3 mb-3">
            {statusPills.map(p => (
              <button
                key={p.key}
                onClick={() => setStatusFilter(p.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  statusFilter === p.key
                    ? p.color
                      ? `bg-${p.color}-100 text-${p.color}-700`
                      : 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
                <span className="ml-1.5 text-[10px] opacity-70">{statusCounts[p.key]}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              value={templateFilter}
              onChange={e => setTemplateFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-md px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Templates</option>
              {templateNames.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Asset</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">SOP Template</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Trigger</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Progress</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Triggered By</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No checklists found</td>
                </tr>
              ) : (
                filtered.map(c => {
                  const prog = getProgress(c);
                  const badge = getTriggerBadge(c.trigger);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                      className={`border-b border-slate-100 cursor-pointer transition-colors ${
                        selectedId === c.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{c.assetName}</div>
                        <div className="text-xs text-slate-400">{c.assetInv}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{c.templateName}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${badge.colorClass}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${prog.pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                              style={{ width: `${prog.pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{prog.done}/{prog.total}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE[c.status]}`}>
                          {STATUS_LABEL[c.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.triggeredBy}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{relativeDate(c.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <CompletionDetailPanel
          completion={selected}
          templates={templates}
          onClose={() => setSelectedId(null)}
          onToggleItem={(itemId) => toggleItem(selected.id, itemId)}
          onSubmit={() => submitCompletion(selected.id)}
          onConfirm={() => confirmCompletion(selected.id)}
          isItemBlocked={(item) => isItemBlocked(item, selected.items)}
          getParentText={(depId) => getParentText(depId, selected.items)}
          allBlockingChecked={allBlockingChecked(selected)}
          noteInputs={noteInputs}
          onNoteInputChange={(itemId, val) => setNoteInputs(prev => ({ ...prev, [itemId]: val }))}
        />
      )}
    </div>
  );
}

// ── Completion Detail Panel ─────────────────────────────────────────────────

export function CompletionDetailPanel({
  completion,
  templates = INITIAL_TEMPLATES,
  onClose,
  onToggleItem,
  onSubmit,
  onConfirm,
  isItemBlocked,
  getParentText,
  allBlockingChecked,
  noteInputs,
  onNoteInputChange,
}: {
  completion: ChecklistCompletion;
  templates?: SopTemplate[];
  onClose: () => void;
  onToggleItem: (itemId: string) => void;
  onSubmit: () => void;
  onConfirm: () => void;
  isItemBlocked: (item: ChecklistCompletion['items'][0]) => boolean;
  getParentText: (depId: string) => string;
  allBlockingChecked: boolean;
  noteInputs: Record<string, string>;
  onNoteInputChange: (itemId: string, value: string) => void;
}) {
  const prog = (() => {
    const total = completion.items.length;
    const done = completion.items.filter(i => i.checked).length;
    return { done, total, pct: total > 0 ? (done / total) * 100 : 0 };
  })();

  const AssetIcon = getAssetIcon(completion.assetType);
  const triggerBadge = getTriggerBadge(completion.trigger);
  const sortedItems = [...completion.items].sort((a, b) => a.orderIndex - b.orderIndex);

  const canSubmit = completion.status === 'open' && allBlockingChecked;
  const canConfirm = completion.status === 'submitted' && completion.requiresConfirmation && completion.submittedBy !== CURRENT_USER;
  const isSubmittedBySelf = completion.status === 'submitted' && completion.requiresConfirmation && completion.submittedBy === CURRENT_USER;

  return (
    <div className="w-[40%] min-w-[380px] max-w-[520px] flex-shrink-0 overflow-y-auto bg-white">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Checklist Detail</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 mb-4">
          <div className="w-9 h-9 bg-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
            <AssetIcon size={18} className="text-slate-500" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm text-slate-800">{completion.assetName}</div>
            <div className="text-xs text-slate-500">{completion.assetInv} &middot; {completion.assetType}</div>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
              <MapPin size={11} />
              {completion.assetLocation}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck size={14} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-700">{completion.templateName}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${triggerBadge.colorClass}`}>
              {triggerBadge.label}
            </span>
            <span>&middot; Triggered by {completion.triggeredBy} &middot; {relativeDate(completion.createdAt)}</span>
          </div>
        </div>

        {completion.pendingTransition && completion.status !== 'confirmed' && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4 text-sm text-amber-800">
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Pending transition</div>
              <div className="text-xs mt-0.5">When completed: {completion.pendingTransition}</div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-slate-600">Progress</span>
            <span className="text-xs text-slate-500">{prog.done}/{prog.total} completed</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${prog.pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
              style={{ width: `${prog.pct}%` }}
            />
          </div>
        </div>

        <div className="space-y-1 mb-4">
          {sortedItems.map(item => {
            const blocked = isItemBlocked(item);
            const isOpen = completion.status === 'open';
            const disabled = !isOpen || blocked;
            const needsNoteBefore = isOpen && !item.checked && item.requiresNote;

            return (
              <div key={item.id} className={`rounded-lg border p-3 ${blocked ? 'border-slate-200 bg-slate-50' : item.checked ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start gap-2.5">
                  <button
                    onClick={() => !disabled && !(needsNoteBefore && !(noteInputs[item.id]?.trim())) && onToggleItem(item.id)}
                    disabled={disabled || (needsNoteBefore && !(noteInputs[item.id]?.trim()))}
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      item.checked
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : blocked
                          ? 'border-slate-300 bg-slate-100 cursor-not-allowed'
                          : 'border-slate-300 hover:border-blue-400 cursor-pointer'
                    }`}
                  >
                    {item.checked && <Check size={12} strokeWidth={3} />}
                    {blocked && !item.checked && <Lock size={10} className="text-slate-400" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${blocked ? 'text-slate-400' : item.checked ? 'text-slate-600' : 'text-slate-800'}`}>
                      {item.text}
                      {item.isBlocking && (
                        <span className="inline-flex w-2 h-2 bg-red-400 rounded-full ml-1.5 align-middle" title="Blocking" />
                      )}
                    </div>

                    {item.checked && item.checkedBy && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        <Check size={10} className="inline text-emerald-500 mr-1" />
                        {item.checkedBy}, {item.checkedAt ? formatDateTime(item.checkedAt) : ''}
                      </div>
                    )}

                    {item.checked && item.note && (
                      <div className="mt-1.5 text-xs text-slate-500 bg-slate-50 rounded px-2 py-1.5 border border-slate-200">
                        <FileText size={10} className="inline text-slate-400 mr-1" />
                        {item.note}
                      </div>
                    )}

                    {blocked && item.dependsOn && (
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Lock size={10} />
                        Complete &ldquo;{getParentText(item.dependsOn).slice(0, 40)}{getParentText(item.dependsOn).length > 40 ? '...' : ''}&rdquo; first
                      </div>
                    )}

                    {needsNoteBefore && (
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="Note required before checking..."
                          value={noteInputs[item.id] || ''}
                          onChange={e => onNoteInputChange(item.id, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (noteInputs[item.id]?.trim())) {
                              onToggleItem(item.id);
                            }
                          }}
                          className="w-full text-xs border border-amber-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400 bg-amber-50/50"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {completion.requiresConfirmation && (() => {
          const tpl = templates.find(t => t.id === completion.templateId) ?? INITIAL_TEMPLATES.find(t => t.id === completion.templateId);
          const groupName = tpl?.confirmationGroupId ? USER_GROUPS.find(g => g.id === tpl.confirmationGroupId)?.name : null;
          return (
            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                <Eye size={12} />
                4-Eyes Confirmation Required
                {groupName && <span className="text-slate-400">· {groupName}</span>}
              </div>
              {completion.submittedBy && (
                <div className="text-xs text-slate-500">
                  Submitted by: <span className="font-medium text-slate-700">{completion.submittedBy}</span>
                  {completion.submittedAt && <span> ({formatDateTime(completion.submittedAt)})</span>}
                </div>
              )}
              {completion.confirmedBy && (
                <div className="text-xs text-slate-500 mt-0.5">
                  Confirmed by: <span className="font-medium text-emerald-700">{completion.confirmedBy}</span>
                  {completion.confirmedAt && <span> ({formatDateTime(completion.confirmedAt)})</span>}
                </div>
              )}
              {isSubmittedBySelf && !completion.confirmedBy && (
                <div className="text-xs text-amber-600 mt-1">
                  Awaiting confirmation from a different user
                </div>
              )}
            </div>
          );
        })()}

        <div className="flex items-center gap-3">
          {completion.status === 'open' && (
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                canSubmit
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <ChevronRight size={14} />
              Submit
            </button>
          )}

          {completion.status === 'submitted' && completion.requiresConfirmation && (
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                canConfirm
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              title={isSubmittedBySelf ? 'Cannot confirm your own submission' : ''}
            >
              <Eye size={14} />
              Confirm (4-Eyes)
            </button>
          )}

          {completion.status === 'confirmed' && (
            <div className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-md">
              <CheckCircle2 size={14} />
              Completed
            </div>
          )}

          {completion.status === 'submitted' && !completion.requiresConfirmation && (
            <div className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-md">
              <CheckCircle2 size={14} />
              Completed
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
