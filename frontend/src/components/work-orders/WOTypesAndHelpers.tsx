import React, { useState, useEffect, useRef } from 'react';
import {
  Wrench, Plus, CheckCircle2, AlertTriangle,
  Clock, ChevronRight, X, Check,
  CornerUpLeft, Play, Pause, RotateCcw,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

export type WOType = 'Repair' | 'Installation' | 'Inspection' | 'Transfer' | 'Decommission' | 'Software Update' | 'Preventive Maintenance';
export type WOPriority = 'critical' | 'high' | 'medium' | 'low';
export type WOStatus = 'draft' | 'submitted' | 'pending_approval' | 'open' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
export type WOSource = 'manual' | 'sop' | 'maintenance' | 'project' | 'integration';

export interface ChecklistItem { id: string; label: string; done: boolean }
export interface ActivityEntry { id: string; action: string; date: string; actor: string }
export interface CommentEntry { id: string; author: string; text: string; date: string }

export interface WorkOrder {
  id: string;
  wo_number: string;
  title: string;
  description: string;
  type: WOType;
  priority: WOPriority;
  status: WOStatus;
  asset_id: string | null;
  assetName: string | null;
  assetInv: string | null;
  assetType: string | null;
  assetInTransit?: boolean;
  location: string;
  assignee_id: string | null;
  assigneeName: string | null;
  reporter_id: string;
  reporterName: string;
  source: WOSource;
  sourceRef: string | null;
  externalTicketRef: string | null;
  requiresApproval: boolean;
  approverName: string | null;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  checklist: ChecklistItem[];
  activity: ActivityEntry[];
  notes: string;
  comments: CommentEntry[];
}

export interface TechnicianInfo {
  name: string;
  skills: string[];
  activeWOs: number;
  eligible: boolean;
  reason?: string;
}

export interface UndoItem {
  id: number;
  label: string;
  undo: () => void;
}

export type SortField = 'priority' | 'dueDate' | 'status' | 'assignee' | 'created';
export type SortDir = 'asc' | 'desc';

// ── Constants ───────────────────────────────────────────────────────────────

export const CURRENT_USER = 'Ivan Horvat';

export const ALL_TYPES: WOType[] = [
  'Repair', 'Installation', 'Inspection', 'Transfer', 'Decommission', 'Software Update', 'Preventive Maintenance',
];

export const ALL_PRIORITIES: WOPriority[] = ['critical', 'high', 'medium', 'low'];

export const ALL_STATUSES: WOStatus[] = [
  'draft', 'submitted', 'pending_approval', 'open', 'in_progress', 'on_hold', 'completed', 'cancelled',
];

export const ALL_SOURCES: WOSource[] = ['manual', 'sop', 'maintenance', 'project', 'integration'];

export const ALL_LOCATIONS = [
  'Zagreb HQ, Floor 1', 'Zagreb HQ, Floor 2', 'Zagreb HQ, Floor 3',
  'Zagreb HQ, Server Room A', 'Zagreb HQ, Server Room B',
  'Split Office, Floor 1', 'Split Office, Server Room',
];

export const ALL_REPORTERS = [
  'Ivan Horvat', 'Nikola Šimić', 'Ana Marić', 'Petra Babić', 'Maja Kovač', 'Tomislav Blažević',
];

export const MOCK_ASSETS = [
  { id: 'a1', name: 'HP ProLiant DL380', inv: 'IT-SRV-007', type: 'Server', location: 'Zagreb HQ, Server Room B' },
  { id: 'a2', name: 'ThinkPad T14s', inv: 'IT-LAP-001', type: 'Laptop', location: 'Zagreb HQ, Floor 2' },
  { id: 'a3', name: 'Dell OptiPlex 7020', inv: 'IT-DES-015', type: 'Desktop', location: 'Zagreb HQ, Floor 1' },
  { id: 'a4', name: 'PowerEdge R640', inv: 'IT-SRV-003', type: 'Server', location: 'Zagreb HQ, Server Room A' },
  { id: 'a5', name: 'Cisco Catalyst 9300', inv: 'IT-NET-012', type: 'Network', location: 'Zagreb HQ, Server Room A' },
  { id: 'a6', name: 'Dell PowerEdge R750', inv: 'IT-SRV-011', type: 'Server', location: 'Zagreb HQ, Server Room A' },
  { id: 'a8', name: 'APC Smart-UPS 3000', inv: 'IT-UPS-002', type: 'UPS', location: 'Zagreb HQ, Server Room A' },
  { id: 'a10', name: 'MacBook Pro 16"', inv: 'IT-LAP-042', type: 'Laptop', location: 'Split Office, Floor 1' },
  { id: 'a12', name: 'HP LaserJet Pro', inv: 'IT-PRT-003', type: 'Printer', location: 'Zagreb HQ, Floor 2' },
  { id: 'a14', name: 'Dell Precision 5570', inv: 'IT-WRK-008', type: 'Workstation', location: 'Zagreb HQ, Floor 2' },
  { id: 'a15', name: 'FortiGate 60F', inv: 'IT-FW-005', type: 'Firewall', location: 'Split Office, Server Room' },
];

export const STATUS_BADGE: Record<WOStatus, string> = {
  draft: 'bg-slate-50 text-slate-600 border border-slate-200/50',
  submitted: 'bg-blue-50 text-blue-700 border border-blue-200/50',
  pending_approval: 'bg-amber-50 text-amber-700 border border-amber-200/50',
  open: 'bg-sky-50 text-sky-700 border border-sky-200/50',
  in_progress: 'bg-blue-50 text-blue-700 border border-blue-200/50',
  on_hold: 'bg-amber-50 text-amber-700 border border-amber-200/50',
  completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
  cancelled: 'bg-slate-50 text-slate-500 border border-slate-200/50 line-through',
};

export const STATUS_LABEL: Record<WOStatus, string> = {
  draft: 'DRAFT',
  submitted: 'SUBMITTED',
  pending_approval: 'PENDING APPROVAL',
  open: 'OPEN',
  in_progress: 'IN PROGRESS',
  on_hold: 'ON HOLD',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

export const STATUS_SHORT_LABEL: Record<WOStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  pending_approval: 'Pending Approval',
  open: 'Open',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const PRIORITY_BADGE: Record<WOPriority, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
};

export const PRIORITY_BORDER: Record<WOPriority, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-400',
  medium: 'border-l-amber-400',
  low: 'border-l-blue-400',
};

export const PRIORITY_ORDER: Record<WOPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const STATUS_ORDER: Record<WOStatus, number> = {
  draft: 0, submitted: 1, pending_approval: 2, open: 3, in_progress: 4, on_hold: 5, completed: 6, cancelled: 7,
};

export const SOURCE_BADGE: Record<WOSource, { cls: string; label: string }> = {
  manual: { cls: 'bg-slate-100 text-slate-600', label: 'Manual' },
  sop: { cls: 'bg-violet-100 text-violet-700', label: 'SOP' },
  maintenance: { cls: 'bg-amber-100 text-amber-700', label: 'Maintenance' },
  project: { cls: 'bg-indigo-100 text-indigo-700', label: 'Project' },
  integration: { cls: 'bg-cyan-100 text-cyan-700', label: 'Integration' },
};

export const TECHNICIAN_POOL: TechnicianInfo[] = [
  { name: 'Ivan Horvat', skills: ['Hardware', 'Network', 'Storage'], activeWOs: 2, eligible: true },
  { name: 'Maja Kovač', skills: ['Software', 'Installation'], activeWOs: 1, eligible: true },
  { name: 'Tomislav Blažević', skills: ['Hardware', 'Decommission'], activeWOs: 3, eligible: true },
  { name: 'Ana Marić', skills: ['Software'], activeWOs: 0, eligible: false, reason: 'No access to Zagreb DC' },
  { name: 'Luka Jurić', skills: ['Network'], activeWOs: 1, eligible: false, reason: 'Missing skill: Hardware' },
];

export const NORMAL_STEPS: WOStatus[] = ['draft', 'open', 'in_progress', 'completed'];
export const APPROVAL_STEPS: WOStatus[] = ['draft', 'submitted', 'pending_approval', 'open', 'in_progress', 'completed'];

export function getStepperSteps(wo: WorkOrder): WOStatus[] {
  return wo.requiresApproval ? APPROVAL_STEPS : NORMAL_STEPS;
}

export function getStepIndex(steps: WOStatus[], status: WOStatus): number {
  if (status === 'on_hold') return steps.indexOf('in_progress');
  if (status === 'cancelled') return -1;
  return steps.indexOf(status);
}

// ── Mock Data ───────────────────────────────────────────────────────────────

export const initialWorkOrders: WorkOrder[] = [
  {
    id: 'wo-001', wo_number: 'WO-2026-001', title: 'Replace failing SSD in build server',
    description: 'The primary SSD in build server shows SMART warnings. Replace before failure causes downtime.',
    type: 'Repair', priority: 'high', status: 'in_progress',
    asset_id: 'a1', assetName: 'HP ProLiant DL380', assetInv: 'IT-SRV-007', assetType: 'Server',
    location: 'Zagreb HQ, Server Room B',
    assignee_id: 'u1', assigneeName: 'Ivan Horvat',
    reporter_id: 'u5', reporterName: 'Nikola Šimić',
    source: 'integration', sourceRef: 'Zabbix Alert #8841', externalTicketRef: 'JRA-4012',
    requiresApproval: false, approverName: null,
    dueDate: '2026-04-26', startedAt: '2026-04-26T14:32:00Z', completedAt: null,
    estimatedHours: 2, actualHours: null,
    checklist: [
      { id: 'c1', label: 'Power down server', done: true },
      { id: 'c2', label: 'Remove old SSD', done: true },
      { id: 'c3', label: 'Install new SSD', done: false },
      { id: 'c4', label: 'Boot and verify', done: false },
    ],
    activity: [
      { id: 'a3', action: 'In Progress', date: '2026-04-26T14:32:00Z', actor: 'Ivan Horvat' },
      { id: 'a2', action: 'Open', date: '2026-04-25T09:15:00Z', actor: 'System' },
      { id: 'a1', action: 'Created', date: '2026-04-24T16:00:00Z', actor: 'System → JRA-4012' },
    ],
    notes: 'Samsung 870 EVO 1TB ordered. ETA same day.',
    comments: [
      { id: 'c1', author: 'Ivan Horvat', text: 'Confirmed SSD model with vendor. Shipping today.', date: '2026-04-25T10:30:00Z' },
      { id: 'c2', author: 'Nikola Šimić', text: 'Server is on secondary backup, no rush but don\'t leave it over the weekend.', date: '2026-04-25T11:15:00Z' },
    ],
  },
  {
    id: 'wo-002', wo_number: 'WO-2026-002', title: 'Replace cracked display',
    description: 'User reported a crack across the lower-left corner of the display panel after a drop.',
    type: 'Repair', priority: 'high', status: 'open',
    asset_id: 'a2', assetName: 'ThinkPad T14s', assetInv: 'IT-LAP-001', assetType: 'Laptop',
    location: 'Zagreb HQ, Floor 2',
    assignee_id: 'u1', assigneeName: 'Ivan Horvat',
    reporter_id: 'u4', reporterName: 'Ana Marić',
    source: 'manual', sourceRef: null, externalTicketRef: null,
    requiresApproval: false, approverName: null,
    dueDate: '2026-04-28', startedAt: null, completedAt: null,
    estimatedHours: 2, actualHours: null,
    checklist: [
      { id: 'c1', label: 'Order replacement panel', done: true },
      { id: 'c2', label: 'Back up user data', done: true },
      { id: 'c3', label: 'Replace display assembly', done: false },
      { id: 'c4', label: 'Run display diagnostics', done: false },
    ],
    activity: [
      { id: 'a2', action: 'Open', date: '2026-04-20T09:15:00Z', actor: 'Ivan Horvat' },
      { id: 'a1', action: 'Created', date: '2026-04-20T09:00:00Z', actor: 'Ana Marić' },
    ],
    notes: 'Replacement panel ordered from Lenovo, ETA 2 days.',
    comments: [
      { id: 'c3', author: 'Maja Kovač', text: 'User says screen flickers only under load. Could be GPU not panel.', date: '2026-04-21T14:00:00Z' },
    ],
  },
  {
    id: 'wo-003', wo_number: 'WO-2026-003', title: 'Install new workstation for hire',
    description: 'New hire starting May 5. Set up full workstation with dual monitors, docking station, peripherals.',
    type: 'Installation', priority: 'medium', status: 'open',
    asset_id: 'a3', assetName: 'Dell OptiPlex 7020', assetInv: 'IT-DES-015', assetType: 'Desktop',
    location: 'Zagreb HQ, Floor 1',
    assignee_id: 'u1', assigneeName: 'Ivan Horvat',
    reporter_id: 'u6', reporterName: 'Petra Babić',
    source: 'manual', sourceRef: null, externalTicketRef: null,
    requiresApproval: false, approverName: null,
    dueDate: '2026-05-03', startedAt: null, completedAt: null,
    estimatedHours: 3, actualHours: null,
    checklist: [
      { id: 'c1', label: 'Image workstation with SOE', done: false },
      { id: 'c2', label: 'Install department-specific software', done: false },
      { id: 'c3', label: 'Cable management & desk setup', done: false },
      { id: 'c4', label: 'User acceptance test', done: false },
    ],
    activity: [
      { id: 'a2', action: 'Open', date: '2026-04-22T11:35:00Z', actor: 'Petra Babić' },
      { id: 'a1', action: 'Created', date: '2026-04-22T11:30:00Z', actor: 'Petra Babić' },
    ],
    notes: '',
    comments: [],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

let undoIdCounter = 0;
export function nextUndoId(): number {
  return ++undoIdCounter;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${hh}:${mm}`;
}

export function isOverdue(dueDate: string | null, status: WOStatus): boolean {
  if (!dueDate || status === 'completed' || status === 'cancelled') return false;
  return new Date(dueDate) < new Date('2026-04-26T23:59:59Z');
}

export function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr.startsWith('2026-04-26');
}

export function fuzzyMatch(query: string, haystack: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystackLower = haystack.toLowerCase();
  const haystackWords = haystackLower.split(/\s+/);
  return words.every(qWord =>
    haystackWords.some(hWord => hWord.startsWith(qWord))
  );
}

export function buildSearchHaystack(wo: WorkOrder): string {
  return [wo.title, wo.assetName, wo.assigneeName, wo.location, wo.wo_number]
    .filter(Boolean)
    .join(' ');
}

// ── Workflow Stepper Component ──────────────────────────────────────────────

export function WorkflowStepper({ wo, size = 'normal' }: { wo: WorkOrder; size?: 'normal' | 'small' }) {
  const steps = getStepperSteps(wo);
  const currentIdx = getStepIndex(steps, wo.status);
  const isOnHold = wo.status === 'on_hold';
  const isCancelled = wo.status === 'cancelled';

  const circleSize = size === 'small' ? 'w-4 h-4 text-[9px]' : 'w-5 h-5 text-[10px]';
  const labelSize = size === 'small' ? 'text-[9px]' : 'text-[10px]';

  let lastReachedIdx = 0;
  if (isCancelled) {
    for (const act of wo.activity) {
      const actLower = act.action.toLowerCase();
      for (let i = steps.length - 1; i >= 0; i--) {
        if (actLower.includes(steps[i].replace('_', ' '))) {
          lastReachedIdx = Math.max(lastReachedIdx, i);
        }
      }
    }
  }

  return (
    <div className="flex items-center gap-0 w-full py-2">
      {steps.map((step, i) => {
        const isCompleted = isCancelled ? i < lastReachedIdx : i < currentIdx;
        const isCurrent = isCancelled ? i === lastReachedIdx : i === currentIdx;

        let circleClass = 'bg-slate-200 text-slate-400';
        let labelClass = 'text-slate-400';

        if (isCompleted) {
          circleClass = 'bg-emerald-500 text-white';
          labelClass = 'text-emerald-600 font-medium';
        } else if (isCurrent) {
          if (isCancelled) {
            circleClass = 'bg-red-500 text-white';
            labelClass = 'text-red-600 font-semibold';
          } else if (isOnHold) {
            circleClass = 'bg-amber-500 text-white';
            labelClass = 'text-amber-600 font-semibold';
          } else {
            circleClass = 'bg-blue-600 text-white ring-2 ring-blue-200';
            labelClass = 'text-blue-600 font-semibold';
          }
        }

        const stepLabel = isCurrent && isOnHold
          ? 'On Hold'
          : isCurrent && isCancelled
            ? 'Cancelled'
            : STATUS_SHORT_LABEL[step];

        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center min-w-0">
              <div className={`${circleSize} rounded-full flex items-center justify-center font-bold shrink-0 ${circleClass}`}>
                {isCompleted ? (
                  <Check size={size === 'small' ? 9 : 11} />
                ) : isCurrent && isCancelled ? (
                  <X size={size === 'small' ? 9 : 11} />
                ) : isCurrent && isOnHold ? (
                  <Pause size={size === 'small' ? 8 : 10} />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                )}
              </div>
              <span className={`${labelSize} mt-1 whitespace-nowrap ${labelClass}`}>
                {stepLabel}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mt-[-12px] ${
                (isCancelled ? i < lastReachedIdx : i < currentIdx) ? 'bg-emerald-400' : 'bg-slate-200'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── WOCard (for My Queue) ───────────────────────────────────────────────────

export function WOCard({
  wo, selected, onSelect, onStatusChange, onToggleCheck,
}: {
  wo: WorkOrder;
  selected: boolean;
  onSelect: () => void;
  onStatusChange: (status: WOStatus) => void;
  onToggleCheck: (itemId: string) => void;
}) {
  const overdue = isOverdue(wo.dueDate, wo.status);
  const doneCount = wo.checklist.filter(c => c.done).length;
  const totalCheck = wo.checklist.length;
  const [expanded, setExpanded] = useState(false);

  const actionBtn = () => {
    switch (wo.status) {
      case 'open':
        return (
          <button
            onClick={e => { e.stopPropagation(); onStatusChange('in_progress'); }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Play size={11} /> Start Work
          </button>
        );
      case 'in_progress':
        return (
          <button
            onClick={e => { e.stopPropagation(); onStatusChange('completed'); }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            <Check size={11} /> Complete
          </button>
        );
      case 'on_hold':
        return (
          <button
            onClick={e => { e.stopPropagation(); onStatusChange('in_progress'); }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            <RotateCcw size={11} /> Resume
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`border border-slate-200 border-l-4 ${PRIORITY_BORDER[wo.priority]} rounded-lg p-3 cursor-pointer transition-all ${
        selected ? 'bg-blue-50/70 ring-1 ring-blue-300' : 'bg-white hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${PRIORITY_BADGE[wo.priority]}`}>
            {wo.priority}
          </span>
          <span className="font-mono text-xs text-slate-400">{wo.wo_number}</span>
          <span className="text-sm font-medium text-slate-800 truncate">{wo.title}</span>
        </div>
        <div className="shrink-0">{actionBtn()}</div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
        {wo.assetName ? (
          <span>{wo.assetName} <span className="text-slate-400">({wo.assetInv})</span></span>
        ) : (
          <span className="italic text-slate-400">No asset</span>
        )}
        <span className="text-slate-300">·</span>
        <span>{wo.location}</span>
        {wo.dueDate && (
          <>
            <span className="text-slate-300">·</span>
            <span className={overdue ? 'text-red-600 font-medium' : ''}>
              Due: {formatDate(wo.dueDate)}
              {overdue && ' (Overdue)'}
            </span>
          </>
        )}
        {wo.estimatedHours && (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400">Est. {wo.estimatedHours}h</span>
          </>
        )}
      </div>

      {wo.source !== 'manual' && (
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${SOURCE_BADGE[wo.source].cls}`}>
            {wo.source === 'sop' ? wo.sourceRef : wo.source === 'maintenance' ? wo.sourceRef : wo.source === 'project' ? `Project: ${wo.sourceRef}` : wo.sourceRef}
          </span>
          {wo.externalTicketRef && (
            <span className="text-[11px] font-mono text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded">
              {wo.externalTicketRef}
            </span>
          )}
        </div>
      )}

      {wo.status === 'on_hold' && wo.notes && (
        <div className="mt-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
          Note: "{wo.notes}"
        </div>
      )}

      {totalCheck > 0 && (
        <div className="mt-2" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
            >
              <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
              <span>Checklist {doneCount}/{totalCheck}</span>
            </button>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[120px]">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${totalCheck > 0 ? (doneCount / totalCheck) * 100 : 0}%` }}
              />
            </div>
          </div>
          {expanded && (
            <div className="mt-1.5 pl-4 space-y-1">
              {wo.checklist.map(item => (
                <label key={item.id} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:text-slate-800">
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
          )}
        </div>
      )}
    </div>
  );
}

// ── Inline New WO Form ──────────────────────────────────────────────────────

export function NewWOForm({
  onSubmit, onCancel,
}: {
  onSubmit: (data: {
    title: string; type: WOType; priority: WOPriority;
    asset_id: string | null; location: string; assigneeName: string | null;
    dueDate: string; description: string; requiresApproval: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<WOType>('Repair');
  const [priority, setPriority] = useState<WOPriority>('medium');
  const [assetId, setAssetId] = useState<string>('');
  const [location, setLocation] = useState(ALL_LOCATIONS[0]);
  const [assignee, setAssignee] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  useEffect(() => {
    if (assetId) {
      const found = MOCK_ASSETS.find(a => a.id === assetId);
      if (found) setLocation(found.location);
    }
  }, [assetId]);

  useEffect(() => {
    if (type === 'Decommission' || type === 'Transfer') {
      setRequiresApproval(true);
    }
  }, [type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(), type, priority,
      asset_id: assetId || null,
      location,
      assigneeName: assignee || null,
      dueDate, description, requiresApproval,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50/60 border border-blue-200 rounded-lg p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">New Work Order</span>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
          <input
            ref={titleRef}
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Describe the work needed..."
            className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
            <select value={type} onChange={e => setType(e.target.value as WOType)} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md bg-white">
              {ALL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value as WOPriority)} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md bg-white">
              {ALL_PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Asset</label>
          <select value={assetId} onChange={e => setAssetId(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md bg-white">
            <option value="">None (location task)</option>
            {MOCK_ASSETS.map(a => <option key={a.id} value={a.id}>{a.name} ({a.inv})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
          <select value={location} onChange={e => setLocation(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md bg-white">
            {ALL_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Assignee</label>
          <select value={assignee} onChange={e => setAssignee(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md bg-white">
            <option value="">Unassigned</option>
            {TECHNICIAN_POOL.filter(t => t.eligible).map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md bg-white" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Additional details..." className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={requiresApproval} onChange={e => setRequiresApproval(e.target.checked)} className="rounded border-slate-300 text-blue-600" />
          Requires Approval
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800">Cancel</button>
          <button type="submit" className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700">Create Work Order</button>
        </div>
      </div>
    </form>
  );
}

// ── Bulk Actions Bar ────────────────────────────────────────────────────────

export function BulkActionsBar({
  count, onAssign, onPriority, onStatus, onClear,
}: {
  count: number;
  onAssign: (name: string) => void;
  onPriority: (p: WOPriority) => void;
  onStatus: (s: WOStatus) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-blue-600 text-white px-4 py-2 rounded-lg mb-3 text-xs font-medium">
      <span>{count} selected</span>
      <select
        onChange={e => { if (e.target.value) { onAssign(e.target.value); e.target.value = ''; } }}
        defaultValue=""
        className="bg-blue-700 text-white px-2 py-1 rounded text-xs border border-blue-500"
      >
        <option value="" disabled>Assign to...</option>
        {TECHNICIAN_POOL.filter(t => t.eligible).map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
      </select>
      <select
        onChange={e => { if (e.target.value) { onPriority(e.target.value as WOPriority); e.target.value = ''; } }}
        defaultValue=""
        className="bg-blue-700 text-white px-2 py-1 rounded text-xs border border-blue-500"
      >
        <option value="" disabled>Change priority...</option>
        {ALL_PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
      </select>
      <select
        onChange={e => { if (e.target.value) { onStatus(e.target.value as WOStatus); e.target.value = ''; } }}
        defaultValue=""
        className="bg-blue-700 text-white px-2 py-1 rounded text-xs border border-blue-500"
      >
        <option value="" disabled>Change status...</option>
        {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_SHORT_LABEL[s]}</option>)}
      </select>
      <button onClick={onClear} className="ml-auto text-blue-200 hover:text-white">
        <X size={14} />
      </button>
    </div>
  );
}

// ── Undo Toast ──────────────────────────────────────────────────────────────

export function UndoToast({ item, onDismiss }: { item: UndoItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-slate-800 text-white px-4 py-2.5 rounded-lg shadow-lg text-xs">
      <span>{item.label}</span>
      <button
        onClick={() => { item.undo(); onDismiss(); }}
        className="flex items-center gap-1 font-semibold text-blue-300 hover:text-blue-200"
      >
        <CornerUpLeft size={12} /> Undo
      </button>
      <button onClick={onDismiss} className="text-slate-400 hover:text-white ml-1">
        <X size={13} />
      </button>
    </div>
  );
}
