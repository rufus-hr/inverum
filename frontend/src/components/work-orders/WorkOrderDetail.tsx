import React, { useState, useEffect } from 'react';
import {
  Wrench, CheckCircle2, AlertTriangle, Clock, X, Check,
  Play, Pause, RotateCcw, Send, Ban, ThumbsUp, ThumbsDown,
  MapPin, ExternalLink, Lock, MessageSquare, ListChecks,
} from 'lucide-react';
import {
  WorkOrder, WOStatus, WOPriority, WOType,
  ALL_PRIORITIES, ALL_TYPES, STATUS_BADGE, STATUS_LABEL,
  PRIORITY_BADGE, PRIORITY_BORDER, SOURCE_BADGE, TECHNICIAN_POOL,
  WorkflowStepper, formatDateTime, isOverdue,
} from './WOTypesAndHelpers';

// ── Detail Panel (Full for Management, Simplified for Queue) ────────────────

export function DetailPanel({
  wo, mode, onClose, onStatusChange, onPriorityChange, onTypeChange,
  onAssigneeChange, onDueDateChange, onDescriptionChange, onNotesChange,
  onToggleCheck, onAddCheckItem, onRemoveCheckItem, onAddComment,
  onTitleChange,
}: {
  wo: WorkOrder;
  mode: 'queue' | 'management';
  onClose: () => void;
  onStatusChange: (s: WOStatus) => void;
  onPriorityChange: (p: WOPriority) => void;
  onTypeChange: (t: WOType) => void;
  onAssigneeChange: (name: string | null) => void;
  onDueDateChange: (d: string | null) => void;
  onDescriptionChange: (d: string) => void;
  onNotesChange: (n: string) => void;
  onToggleCheck: (itemId: string) => void;
  onAddCheckItem: (label: string) => void;
  onRemoveCheckItem: (itemId: string) => void;
  onAddComment: (text: string) => void;
  onTitleChange: (t: string) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(wo.title);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(wo.description);
  const [notesDraft, setNotesDraft] = useState(wo.notes);
  const [newCheckLabel, setNewCheckLabel] = useState('');
  const [commentText, setCommentText] = useState('');
  const [showTechPicker, setShowTechPicker] = useState(false);

  useEffect(() => {
    setTitleDraft(wo.title);
    setDescDraft(wo.description);
    setNotesDraft(wo.notes);
    setEditingTitle(false);
    setEditingDesc(false);
    setShowTechPicker(false);
  }, [wo.id, wo.title, wo.description, wo.notes]);

  const overdue = isOverdue(wo.dueDate, wo.status);
  const doneCount = wo.checklist.filter(c => c.done).length;
  const totalCheck = wo.checklist.length;
  const isFull = mode === 'management';

  const renderStatusActions = () => {
    const btns: React.ReactNode[] = [];
    switch (wo.status) {
      case 'draft':
        if (wo.requiresApproval) {
          btns.push(
            <button key="submit" onClick={() => onStatusChange('submitted')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">
              <Send size={12} /> Submit for Approval
            </button>
          );
        } else {
          btns.push(
            <button key="open" onClick={() => onStatusChange('open')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700">
              <Play size={12} /> Open
            </button>
          );
        }
        btns.push(
          <button key="cancel" onClick={() => onStatusChange('cancelled')} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-md hover:bg-slate-100">
            <Ban size={12} /> Cancel
          </button>
        );
        break;
      case 'submitted':
      case 'pending_approval':
        btns.push(
          <button key="approve" onClick={() => onStatusChange('open')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700">
            <ThumbsUp size={12} /> Approve
          </button>,
          <button key="reject" onClick={() => onStatusChange('draft')} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-300 rounded-md hover:bg-red-50">
            <ThumbsDown size={12} /> Reject
          </button>
        );
        break;
      case 'open':
        btns.push(
          <button key="start" onClick={() => onStatusChange('in_progress')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">
            <Play size={12} /> Start Work
          </button>,
          <button key="hold" onClick={() => onStatusChange('on_hold')} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 border border-amber-300 rounded-md hover:bg-amber-50">
            <Pause size={12} /> Put On Hold
          </button>
        );
        if (isFull) {
          btns.push(
            <button key="cancel" onClick={() => onStatusChange('cancelled')} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 border border-slate-300 rounded-md hover:bg-slate-100">
              <Ban size={12} /> Cancel
            </button>
          );
        }
        break;
      case 'in_progress':
        btns.push(
          <button key="complete" onClick={() => onStatusChange('completed')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700">
            <Check size={12} /> Complete
          </button>,
          <button key="hold" onClick={() => onStatusChange('on_hold')} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 border border-amber-300 rounded-md hover:bg-amber-50">
            <Pause size={12} /> Put On Hold
          </button>
        );
        break;
      case 'on_hold':
        btns.push(
          <button key="resume" onClick={() => onStatusChange('in_progress')} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">
            <RotateCcw size={12} /> Resume Work
          </button>
        );
        if (isFull) {
          btns.push(
            <button key="cancel" onClick={() => onStatusChange('cancelled')} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 border border-slate-300 rounded-md hover:bg-slate-100">
              <Ban size={12} /> Cancel
            </button>
          );
        }
        break;
      default:
        break;
    }
    return btns.length > 0 ? <div className="flex items-center gap-2 flex-wrap">{btns}</div> : null;
  };

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200 overflow-y-auto">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-400">{wo.wo_number}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE[wo.status]}`}>
              {STATUS_LABEL[wo.status]}
            </span>
            <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${PRIORITY_BADGE[wo.priority]}`}>
              {wo.priority}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={16} />
          </button>
        </div>

        {isFull && editingTitle ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={() => { if (titleDraft.trim()) onTitleChange(titleDraft.trim()); setEditingTitle(false); }}
              onKeyDown={e => { if (e.key === 'Enter') { if (titleDraft.trim()) onTitleChange(titleDraft.trim()); setEditingTitle(false); } }}
              className="flex-1 text-base font-semibold text-slate-800 border-b border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>
        ) : (
          <h3
            onClick={() => isFull && setEditingTitle(true)}
            className={`text-base font-semibold text-slate-800 mt-1 ${isFull ? 'cursor-pointer hover:text-blue-600' : ''}`}
          >
            {wo.title}
          </h3>
        )}

        <WorkflowStepper wo={wo} size={isFull ? 'normal' : 'small'} />
        {renderStatusActions()}
      </div>

      {wo.assetInTransit && (
        <div className="mx-4 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2 text-xs text-amber-700">
          <AlertTriangle size={14} className="shrink-0" />
          <span>Asset is currently in transit to {wo.location.split(',')[0]}. Physical work cannot begin until delivery is confirmed.</span>
        </div>
      )}

      {wo.assetName && (
        <div className="mx-4 mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center text-slate-500">
            <Wrench size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-800">{wo.assetName}</div>
            <div className="text-xs text-slate-500">{wo.assetInv} · {wo.assetType}</div>
            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <MapPin size={10} /> {wo.location}
            </div>
          </div>
        </div>
      )}

      {isFull && (
        <div className="p-4 border-b border-slate-100 space-y-2.5 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <span className="text-slate-400 block mb-0.5">Type</span>
              <select
                value={wo.type}
                onChange={e => onTypeChange(e.target.value as WOType)}
                className="w-full px-2 py-1 border border-slate-200 rounded text-slate-700 bg-white text-xs"
              >
                {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Priority</span>
              <select
                value={wo.priority}
                onChange={e => onPriorityChange(e.target.value as WOPriority)}
                className="w-full px-2 py-1 border border-slate-200 rounded text-slate-700 bg-white text-xs"
              >
                {ALL_PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <span className="text-slate-400 block mb-0.5">Assignee</span>
              <div className="relative">
                <button
                  onClick={() => setShowTechPicker(!showTechPicker)}
                  className="w-full text-left px-2 py-1 border border-slate-200 rounded text-slate-700 bg-white text-xs hover:border-slate-300 flex items-center justify-between"
                >
                  <span className={wo.assigneeName ? '' : 'text-amber-600 font-medium'}>
                    {wo.assigneeName || 'Unassigned'}
                  </span>
                  <span className="text-slate-400 text-[10px]">Change</span>
                </button>
                {showTechPicker && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 space-y-1 w-64">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase px-1">Eligible Technicians</div>
                    {TECHNICIAN_POOL.filter(t => t.eligible).map(t => (
                      <button
                        key={t.name}
                        onClick={() => { onAssigneeChange(t.name); setShowTechPicker(false); }}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-blue-50 flex items-center justify-between ${
                          wo.assigneeName === t.name ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700'
                        }`}
                      >
                        <div>
                          <div>{t.name}</div>
                          <div className="text-[10px] text-slate-400">{t.skills.join(', ')}</div>
                        </div>
                        <span className="text-[10px] text-slate-400">{t.activeWOs} active</span>
                      </button>
                    ))}
                    <div className="text-[10px] font-semibold text-slate-400 uppercase px-1 pt-1 border-t border-slate-100">Unavailable</div>
                    {TECHNICIAN_POOL.filter(t => !t.eligible).map(t => (
                      <div key={t.name} className="px-2 py-1 text-xs text-slate-400 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1"><Lock size={10} /> {t.name}</div>
                          <div className="text-[10px] text-slate-300">{t.reason}</div>
                        </div>
                      </div>
                    ))}
                    {wo.assigneeName && (
                      <button
                        onClick={() => { onAssigneeChange(null); setShowTechPicker(false); }}
                        className="w-full text-left px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded border-t border-slate-100 mt-1 pt-1"
                      >
                        Unassign
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Reporter</span>
              <div className="px-2 py-1 text-slate-700">{wo.reporterName}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <span className="text-slate-400 block mb-0.5">Location</span>
              <div className="px-2 py-1 text-slate-700">{wo.location}</div>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Source</span>
              <div className="px-2 py-1 flex items-center gap-1.5">
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${SOURCE_BADGE[wo.source].cls}`}>
                  {SOURCE_BADGE[wo.source].label}
                </span>
                {wo.sourceRef && <span className="text-slate-500 truncate text-[11px]">{wo.sourceRef}</span>}
              </div>
            </div>
          </div>

          {wo.externalTicketRef && (
            <div>
              <span className="text-slate-400 block mb-0.5">External Ticket</span>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded">
                {wo.externalTicketRef} <ExternalLink size={10} />
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-slate-400 block mb-0.5">Due Date</span>
              <input
                type="date"
                value={wo.dueDate || ''}
                onChange={e => onDueDateChange(e.target.value || null)}
                className={`w-full px-1.5 py-1 border rounded text-xs ${overdue ? 'border-red-300 text-red-600 bg-red-50' : 'border-slate-200 text-slate-700'}`}
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Started</span>
              <div className="px-1.5 py-1 text-slate-600">{wo.startedAt ? formatDateTime(wo.startedAt) : '—'}</div>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Completed</span>
              <div className="px-1.5 py-1 text-slate-600">{wo.completedAt ? formatDateTime(wo.completedAt) : '—'}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <span className="text-slate-400 block mb-0.5">Estimated Hours</span>
              <div className="px-2 py-1 text-slate-700">{wo.estimatedHours != null ? `${wo.estimatedHours}h` : '—'}</div>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Actual Hours</span>
              <div className="px-2 py-1 text-slate-700">{wo.actualHours != null ? `${wo.actualHours}h` : '—'}</div>
            </div>
          </div>

          {wo.requiresApproval && (
            <div>
              <span className="text-slate-400 block mb-0.5">Approver</span>
              <div className="px-2 py-1 text-slate-700">{wo.approverName || 'Pending'}</div>
            </div>
          )}
        </div>
      )}

      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</span>
          {isFull && !editingDesc && (
            <button onClick={() => setEditingDesc(true)} className="text-[11px] text-blue-600 hover:underline">Edit</button>
          )}
        </div>
        {isFull && editingDesc ? (
          <div className="space-y-2">
            <textarea
              value={descDraft}
              onChange={e => setDescDraft(e.target.value)}
              rows={3}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setDescDraft(wo.description); setEditingDesc(false); }} className="text-xs text-slate-500">Cancel</button>
              <button onClick={() => { onDescriptionChange(descDraft); setEditingDesc(false); }} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Save</button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600 leading-relaxed">{wo.description || 'No description.'}</p>
        )}
      </div>

      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <ListChecks size={13} /> Checklist ({doneCount}/{totalCheck})
          </span>
          {totalCheck > 0 && (
            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(doneCount / totalCheck) * 100}%` }} />
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          {wo.checklist.map(item => (
            <div key={item.id} className="flex items-center gap-2 group">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => onToggleCheck(item.id)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
              />
              <span className={`text-xs flex-1 ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.label}</span>
              {isFull && (
                <button
                  onClick={() => onRemoveCheckItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        {isFull && (
          <div className="flex items-center gap-1.5 mt-2">
            <input
              value={newCheckLabel}
              onChange={e => setNewCheckLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newCheckLabel.trim()) {
                  onAddCheckItem(newCheckLabel.trim());
                  setNewCheckLabel('');
                }
              }}
              placeholder="Add checklist item..."
              className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => { if (newCheckLabel.trim()) { onAddCheckItem(newCheckLabel.trim()); setNewCheckLabel(''); } }}
              className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded font-medium"
            >
              + Add
            </button>
          </div>
        )}
      </div>

      <div className="p-4 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Technician Notes</span>
        <textarea
          value={notesDraft}
          onChange={e => setNotesDraft(e.target.value)}
          onBlur={() => { if (notesDraft !== wo.notes) onNotesChange(notesDraft); }}
          rows={2}
          placeholder="Add notes..."
          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="p-4 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
          <MessageSquare size={13} /> Comments ({wo.comments.length})
        </span>
        {wo.comments.length > 0 && (
          <div className="space-y-2.5 mb-3">
            {wo.comments.map(c => (
              <div key={c.id} className="bg-slate-50 rounded-md p-2.5 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-700">{c.author}</span>
                  <span className="text-[10px] text-slate-400">{formatDateTime(c.date)}</span>
                </div>
                <p className="text-slate-600">{c.text}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && commentText.trim()) {
                onAddComment(commentText.trim());
                setCommentText('');
              }
            }}
            placeholder="Write a comment..."
            className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => { if (commentText.trim()) { onAddComment(commentText.trim()); setCommentText(''); } }}
            className="px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Post
          </button>
        </div>
      </div>

      {isFull && (
        <div className="p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Activity Log</span>
          <div className="space-y-2">
            {wo.activity.map(a => (
              <div key={a.id} className="flex items-start gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium text-slate-700">{a.action}</span>
                  <span className="text-slate-400"> · {formatDateTime(a.date)} · {a.actor}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline Detail Panel (Expanded row inside Queue) ─────────────────────────

export function InlineDetailPanel({
  wo, onClose, onStatusChange, onNotesChange, onToggleCheck, onAddComment,
}: {
  wo: WorkOrder;
  onClose: () => void;
  onStatusChange: (s: WOStatus) => void;
  onNotesChange: (n: string) => void;
  onToggleCheck: (itemId: string) => void;
  onAddComment: (text: string) => void;
}) {
  const [notesDraft, setNotesDraft] = useState(wo.notes);
  const [commentText, setCommentText] = useState('');
  const doneCount = wo.checklist.filter(c => c.done).length;
  const totalCheck = wo.checklist.length;

  useEffect(() => { setNotesDraft(wo.notes); }, [wo.id, wo.notes]);

  return (
    <div className={`border border-t-0 border-slate-200 border-l-4 ${PRIORITY_BORDER[wo.priority]} rounded-b-lg bg-slate-50/70 p-4 -mt-1 space-y-3`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <WorkflowStepper wo={wo} size="small" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {wo.status === 'open' && (
            <>
              <button onClick={() => onStatusChange('in_progress')} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">
                <Play size={11} /> Start Work
              </button>
              <button onClick={() => onStatusChange('on_hold')} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 border border-amber-300 rounded-md hover:bg-amber-50">
                <Pause size={11} /> Hold
              </button>
            </>
          )}
          {wo.status === 'in_progress' && (
            <>
              <button onClick={() => onStatusChange('completed')} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700">
                <Check size={11} /> Complete
              </button>
              <button onClick={() => onStatusChange('on_hold')} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 border border-amber-300 rounded-md hover:bg-amber-50">
                <Pause size={11} /> Hold
              </button>
            </>
          )}
          {wo.status === 'on_hold' && (
            <button onClick={() => onStatusChange('in_progress')} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">
              <RotateCcw size={11} /> Resume
            </button>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X size={14} /></button>
        </div>
      </div>

      {wo.description && (
        <p className="text-xs text-slate-600 leading-relaxed">{wo.description}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {totalCheck > 0 && (
          <div className="bg-white rounded-md border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <ListChecks size={12} /> Checklist ({doneCount}/{totalCheck})
              </span>
              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(doneCount / totalCheck) * 100}%` }} />
              </div>
            </div>
            <div className="space-y-1">
              {wo.checklist.map(item => (
                <label key={item.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => onToggleCheck(item.id)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span className={item.done ? 'line-through text-slate-400' : ''}>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-md border border-slate-200 p-3">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Notes</span>
          <textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            onBlur={() => { if (notesDraft !== wo.notes) onNotesChange(notesDraft); }}
            rows={2}
            placeholder="Add technician notes..."
            className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-md border border-slate-200 p-3">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-2">
          <MessageSquare size={12} /> Comments ({wo.comments.length})
        </span>
        {wo.comments.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {wo.comments.map(c => (
              <div key={c.id} className="bg-slate-50 rounded px-2.5 py-1.5 text-xs">
                <span className="font-medium text-slate-700">{c.author}</span>
                <span className="text-slate-400 text-[10px] ml-2">{formatDateTime(c.date)}</span>
                <p className="text-slate-600 mt-0.5">{c.text}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && commentText.trim()) {
                onAddComment(commentText.trim());
                setCommentText('');
              }
            }}
            placeholder="Add comment..."
            className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => { if (commentText.trim()) { onAddComment(commentText.trim()); setCommentText(''); } }}
            className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
