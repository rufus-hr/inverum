import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import {
  Wrench, Search, Plus, X, Check, Clock, AlertTriangle,
  Calendar, User, ClipboardCheck, Play, Pause,
  CheckCircle2, XCircle, MapPin, Timer, FileText,
  ChevronDown, Monitor, Shield, Eye, Package, Laptop,
  Server, Edit2, ArrowRight, DollarSign, MoreHorizontal,
  ChevronRight, ChevronLeft, ChevronUp, BarChart3, Users, TrendingUp,
  GripVertical, Lock, ExternalLink, Hand,
} from 'lucide-react';

// ── Types & Constants ───────────────────────────────────────────────────────

type WOStatus = 'draft' | 'submitted' | 'pending_approval' | 'open' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
type WOPriority = 'critical' | 'high' | 'medium' | 'low';
type WOType = 'Repair' | 'Installation' | 'Decommission' | 'Transfer' | 'Inspection' | 'Software Update' | 'Preventive Maintenance';
type WOSource = 'manual' | 'sop' | 'maintenance' | 'project' | 'integration';
type TabId = 'queue' | 'management';
type QueueFilter = 'action_needed' | 'in_progress' | 'on_hold';
type SortField = 'priority' | 'dueDate' | 'createdAt' | 'status';

interface ChecklistItem { id: string; label: string; done: boolean }
interface ActivityEntry { id: string; action: string; actor: string; date: string }

interface WorkOrder {
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
  comments: WOComment[];
}

interface WOComment {
  id: string;
  author: string;
  text: string;
  date: string;
}

interface NewWOForm {
  title: string;
  type: WOType;
  priority: WOPriority;
  assetName: string;
  location: string;
  assigneeName: string;
  dueDate: string;
  description: string;
}

interface UndoEntry {
  id: string;
  woId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  label: string;
  timestamp: number;
}

interface TechnicianInfo {
  name: string;
  skills: string[];
  activeWOs: number;
  eligible: boolean;
  reason?: string;
}

const CURRENT_USER = 'Ivan Horvat';

const ASSIGNEES = [
  'Ivan Horvat', 'Maja Kovač', 'Tomislav Blažević', 'Ana Marić',
  'Nikola Šimić', 'Petra Babić', 'Luka Jurić', 'Ivana Novak',
];

const WO_TYPES: WOType[] = [
  'Repair', 'Installation', 'Decommission', 'Transfer',
  'Inspection', 'Software Update', 'Preventive Maintenance',
];

const WO_PRIORITIES: WOPriority[] = ['critical', 'high', 'medium', 'low'];

const STATUS_TRANSITIONS: Record<WOStatus, WOStatus[]> = {
  draft: ['open', 'cancelled'],
  submitted: ['pending_approval', 'cancelled'],
  pending_approval: ['open', 'draft'],
  open: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'on_hold', 'cancelled'],
  on_hold: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

const STATUS_LABELS: Record<WOStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  pending_approval: 'Pending Approval',
  open: 'Open',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_BADGE: Record<WOStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-slate-100 text-slate-600',
  pending_approval: 'bg-amber-100 text-amber-700',
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-emerald-100 text-emerald-700',
  on_hold: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-200 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-500 line-through',
};

const PRIORITY_DOT: Record<WOPriority, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-amber-400',
  low: 'bg-blue-400',
};

const PRIORITY_BORDER: Record<WOPriority, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-400',
  medium: 'border-l-amber-400',
  low: 'border-l-blue-400',
};

const PRIORITY_ORDER: Record<WOPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const STATUS_ORDER: Record<WOStatus, number> = {
  draft: 0, submitted: 1, pending_approval: 2, open: 3, in_progress: 4, on_hold: 5, completed: 6, cancelled: 7,
};

const SOURCE_BADGE: Record<WOSource, { cls: string; label: string }> = {
  manual: { cls: 'bg-slate-100 text-slate-600', label: 'Manual' },
  sop: { cls: 'bg-violet-100 text-violet-700', label: 'SOP' },
  maintenance: { cls: 'bg-amber-100 text-amber-700', label: 'Maintenance' },
  project: { cls: 'bg-indigo-100 text-indigo-700', label: 'Project' },
  integration: { cls: 'bg-cyan-100 text-cyan-700', label: 'Integration' },
};

const TECHNICIAN_POOL: TechnicianInfo[] = [
  { name: 'Ivan Horvat', skills: ['Hardware', 'Network', 'Storage'], activeWOs: 2, eligible: true },
  { name: 'Maja Kovač', skills: ['Software', 'Installation'], activeWOs: 1, eligible: true },
  { name: 'Tomislav Blažević', skills: ['Hardware', 'Decommission'], activeWOs: 3, eligible: true },
  { name: 'Ana Marić', skills: ['Software'], activeWOs: 0, eligible: false, reason: 'No access to Zagreb DC' },
  { name: 'Luka Jurić', skills: ['Network'], activeWOs: 1, eligible: false, reason: 'Missing skill: Hardware' },
];

// Stepper steps for normal and approval workflows
const NORMAL_STEPS: WOStatus[] = ['draft', 'open', 'in_progress', 'completed'];
const APPROVAL_STEPS: WOStatus[] = ['draft', 'submitted', 'pending_approval', 'open', 'in_progress', 'completed'];

function getStepperSteps(wo: WorkOrder): WOStatus[] {
  return wo.requiresApproval ? APPROVAL_STEPS : NORMAL_STEPS;
}

function getStepIndex(steps: WOStatus[], status: WOStatus): number {
  // on_hold maps to in_progress position, cancelled maps to last reached
  if (status === 'on_hold') return steps.indexOf('in_progress');
  if (status === 'cancelled') return -1; // special handling
  return steps.indexOf(status);
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const initialWorkOrders: WorkOrder[] = [
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
  {
    id: 'wo-004', wo_number: 'WO-2026-004', title: 'Decommission old file server',
    description: 'Server has been migrated to new cluster. Wipe drives, remove from rack, update CMDB, arrange disposal.',
    type: 'Decommission', priority: 'low', status: 'in_progress',
    asset_id: 'a4', assetName: 'PowerEdge R640', assetInv: 'IT-SRV-003', assetType: 'Server',
    location: 'Zagreb HQ, Server Room A',
    assignee_id: 'u3', assigneeName: 'Tomislav Blažević',
    reporter_id: 'u1', reporterName: 'Ivan Horvat',
    source: 'maintenance', sourceRef: 'Maintenance: Quarterly Server Check', externalTicketRef: null,
    requiresApproval: true, approverName: 'Nikola Šimić',
    dueDate: '2026-05-10', startedAt: '2026-04-18T10:00:00Z', completedAt: null,
    estimatedHours: 4, actualHours: 2,
    checklist: [
      { id: 'c1', label: 'Verify all data migrated', done: true },
      { id: 'c2', label: 'Wipe drives with DBAN', done: true },
      { id: 'c3', label: 'Remove from rack', done: false },
      { id: 'c4', label: 'Update CMDB entry', done: false },
    ],
    activity: [
      { id: 'a3', action: 'In Progress', date: '2026-04-18T10:00:00Z', actor: 'Tomislav Blažević' },
      { id: 'a2', action: 'Approved → Open', date: '2026-04-16T14:00:00Z', actor: 'Nikola Šimić' },
      { id: 'a1', action: 'Created', date: '2026-04-15T08:00:00Z', actor: 'Ivan Horvat' },
    ],
    notes: 'Drives wiped. Physical removal scheduled for next maintenance window.',
    comments: [],
  },
  {
    id: 'wo-005', wo_number: 'WO-2026-005', title: 'Network switch firmware update',
    description: 'Cisco released critical firmware update for Catalyst 9300 series. Apply during maintenance window.',
    type: 'Software Update', priority: 'medium', status: 'draft',
    asset_id: 'a5', assetName: 'Cisco Catalyst 9300', assetInv: 'IT-NET-012', assetType: 'Network',
    location: 'Zagreb HQ, Server Room A',
    assignee_id: 'u1', assigneeName: 'Ivan Horvat',
    reporter_id: 'u1', reporterName: 'Ivan Horvat',
    source: 'manual', sourceRef: null, externalTicketRef: null,
    requiresApproval: false, approverName: null,
    dueDate: '2026-05-20', startedAt: null, completedAt: null,
    estimatedHours: 1, actualHours: null,
    checklist: [
      { id: 'c1', label: 'Download firmware from Cisco', done: false },
      { id: 'c2', label: 'Schedule maintenance window', done: false },
      { id: 'c3', label: 'Apply firmware', done: false },
      { id: 'c4', label: 'Verify connectivity', done: false },
    ],
    activity: [
      { id: 'a1', action: 'Created', date: '2026-04-25T10:00:00Z', actor: 'Ivan Horvat' },
    ],
    notes: '',
    comments: [],
  },
  {
    id: 'wo-006', wo_number: 'WO-2026-006', title: 'Move server to new rack',
    description: 'Relocate Dell PowerEdge R750 from Rack A3 to Rack B1 as part of DC reorganization.',
    type: 'Transfer', priority: 'medium', status: 'pending_approval',
    asset_id: 'a6', assetName: 'Dell PowerEdge R750', assetInv: 'IT-SRV-011', assetType: 'Server',
    location: 'Zagreb HQ, Server Room A',
    assignee_id: null, assigneeName: null,
    reporter_id: 'u5', reporterName: 'Nikola Šimić',
    source: 'manual', sourceRef: null, externalTicketRef: null,
    requiresApproval: true, approverName: 'Ivan Horvat',
    dueDate: '2026-05-15', startedAt: null, completedAt: null,
    estimatedHours: 3, actualHours: null,
    checklist: [],
    activity: [
      { id: 'a2', action: 'Submitted for approval', date: '2026-04-24T11:00:00Z', actor: 'Nikola Šimić' },
      { id: 'a1', action: 'Created', date: '2026-04-24T10:30:00Z', actor: 'Nikola Šimić' },
    ],
    notes: '',
    comments: [],
  },
  {
    id: 'wo-007', wo_number: 'WO-2026-007', title: 'Organize cabling in Server Room B',
    description: 'Cable management overhaul. Label all cables, replace damaged ones, update documentation.',
    type: 'Preventive Maintenance', priority: 'low', status: 'open',
    asset_id: null, assetName: null, assetInv: null, assetType: null,
    location: 'Zagreb HQ, Server Room B',
    assignee_id: null, assigneeName: null,
    reporter_id: 'u1', reporterName: 'Ivan Horvat',
    source: 'manual', sourceRef: null, externalTicketRef: null,
    requiresApproval: false, approverName: null,
    dueDate: '2026-05-30', startedAt: null, completedAt: null,
    estimatedHours: 8, actualHours: null,
    checklist: [
      { id: 'c1', label: 'Audit existing cables', done: false },
      { id: 'c2', label: 'Label all connections', done: false },
      { id: 'c3', label: 'Replace damaged cables', done: false },
    ],
    activity: [
      { id: 'a1', action: 'Created', date: '2026-04-23T15:00:00Z', actor: 'Ivan Horvat' },
    ],
    notes: 'Low priority, schedule when server room has a quiet period.',
    comments: [],
  },
  {
    id: 'wo-008', wo_number: 'WO-2026-008', title: 'Inspect UPS battery condition',
    description: 'Annual inspection of UPS units. Check battery health, test failover, document results.',
    type: 'Inspection', priority: 'medium', status: 'on_hold',
    asset_id: 'a8', assetName: 'APC Smart-UPS 3000', assetInv: 'IT-UPS-002', assetType: 'UPS',
    location: 'Zagreb HQ, Server Room A',
    assignee_id: 'u1', assigneeName: 'Ivan Horvat',
    reporter_id: 'u5', reporterName: 'Nikola Šimić',
    source: 'maintenance', sourceRef: 'Maintenance: Annual UPS Check', externalTicketRef: null,
    requiresApproval: false, approverName: null,
    dueDate: '2026-04-25', startedAt: '2026-04-24T09:00:00Z', completedAt: null,
    estimatedHours: 2, actualHours: 1,
    checklist: [
      { id: 'c1', label: 'Visual inspection', done: true },
      { id: 'c2', label: 'Battery voltage test', done: false },
      { id: 'c3', label: 'Failover test', done: false },
    ],
    activity: [
      { id: 'a3', action: 'On Hold', date: '2026-04-24T11:00:00Z', actor: 'Ivan Horvat' },
      { id: 'a2', action: 'In Progress', date: '2026-04-24T09:00:00Z', actor: 'Ivan Horvat' },
      { id: 'a1', action: 'Created', date: '2026-04-22T08:00:00Z', actor: 'Nikola Šimić' },
    ],
    notes: 'Waiting for replacement battery to arrive before continuing.',
    comments: [],
  },
  {
    id: 'wo-009', wo_number: 'WO-2026-009', title: 'Deploy monitoring agent on new VMs',
    description: 'Install and configure Zabbix agent on 5 newly provisioned VMs in production cluster.',
    type: 'Software Update', priority: 'high', status: 'open',
    asset_id: null, assetName: null, assetInv: null, assetType: null,
    location: 'Zagreb HQ, Server Room A',
    assignee_id: 'u2', assigneeName: 'Maja Kovač',
    reporter_id: 'u1', reporterName: 'Ivan Horvat',
    source: 'sop', sourceRef: 'SOP: User Offboarding', externalTicketRef: null,
    requiresApproval: false, approverName: null,
    dueDate: '2026-04-30', startedAt: null, completedAt: null,
    estimatedHours: 2, actualHours: null,
    checklist: [
      { id: 'c1', label: 'Prepare agent package', done: false },
      { id: 'c2', label: 'Deploy to VMs', done: false },
      { id: 'c3', label: 'Verify check-in in Zabbix', done: false },
    ],
    activity: [
      { id: 'a1', action: 'Created', date: '2026-04-25T14:00:00Z', actor: 'System → SOP' },
    ],
    notes: '',
    comments: [],
  },
  {
    id: 'wo-010', wo_number: 'WO-2026-010', title: 'Transfer laptop to Split office',
    description: 'Employee relocating to Split. Ship laptop and peripherals, update asset location.',
    type: 'Transfer', priority: 'medium', status: 'draft',
    asset_id: 'a10', assetName: 'MacBook Pro 16"', assetInv: 'IT-LAP-042', assetType: 'Laptop',
    assetInTransit: true,
    location: 'Split Office, Floor 1',
    assignee_id: 'u1', assigneeName: 'Ivan Horvat',
    reporter_id: 'u6', reporterName: 'Petra Babić',
    source: 'manual', sourceRef: null, externalTicketRef: null,
    requiresApproval: true, approverName: 'Nikola Šimić',
    dueDate: '2026-05-05', startedAt: null, completedAt: null,
    estimatedHours: 1, actualHours: null,
    checklist: [],
    activity: [
      { id: 'a1', action: 'Created', date: '2026-04-25T16:00:00Z', actor: 'Petra Babić' },
    ],
    notes: 'Asset currently in transit to Split.',
    comments: [],
  },
  {
    id: 'wo-011', wo_number: 'WO-2026-011', title: 'Completed: Replace network cable Floor 3',
    description: 'Damaged Ethernet cable causing intermittent connectivity in office 305.',
    type: 'Repair', priority: 'medium', status: 'completed',
    asset_id: null, assetName: null, assetInv: null, assetType: null,
    location: 'Zagreb HQ, Floor 3',
    assignee_id: 'u7', assigneeName: 'Luka Jurić',
    reporter_id: 'u4', reporterName: 'Ana Marić',
    source: 'manual', sourceRef: null, externalTicketRef: null,
    requiresApproval: false, approverName: null,
    dueDate: '2026-04-20', startedAt: '2026-04-19T10:00:00Z', completedAt: '2026-04-19T11:30:00Z',
    estimatedHours: 1, actualHours: 1.5,
    checklist: [
      { id: 'c1', label: 'Identify faulty cable', done: true },
      { id: 'c2', label: 'Run new cable', done: true },
      { id: 'c3', label: 'Test connectivity', done: true },
    ],
    activity: [
      { id: 'a3', action: 'Completed', date: '2026-04-19T11:30:00Z', actor: 'Luka Jurić' },
      { id: 'a2', action: 'In Progress', date: '2026-04-19T10:00:00Z', actor: 'Luka Jurić' },
      { id: 'a1', action: 'Created', date: '2026-04-18T08:00:00Z', actor: 'Ana Marić' },
    ],
    notes: 'Cable replaced with Cat6a. Tested OK.',
    comments: [],
  },
  {
    id: 'wo-012', wo_number: 'WO-2026-012', title: 'Cancelled: Old printer decommission',
    description: 'Was going to decommission printer but department still needs it.',
    type: 'Decommission', priority: 'low', status: 'cancelled',
    asset_id: 'a12', assetName: 'HP LaserJet Pro', assetInv: 'IT-PRT-003', assetType: 'Printer',
    location: 'Zagreb HQ, Floor 2',
    assignee_id: 'u3', assigneeName: 'Tomislav Blažević',
    reporter_id: 'u6', reporterName: 'Petra Babić',
    source: 'manual', sourceRef: null, externalTicketRef: null,
    requiresApproval: false, approverName: null,
    dueDate: '2026-04-22', startedAt: null, completedAt: null,
    estimatedHours: 1, actualHours: null,
    checklist: [],
    activity: [
      { id: 'a2', action: 'Cancelled', date: '2026-04-21T10:00:00Z', actor: 'Petra Babić' },
      { id: 'a1', action: 'Created', date: '2026-04-19T09:00:00Z', actor: 'Petra Babić' },
    ],
    notes: 'Department decided to keep the printer.',
    comments: [],
  },
  {
    id: 'wo-013', wo_number: 'WO-2026-013', title: 'Preventive check on cooling system',
    description: 'Quarterly check of CRAC units in Server Room A. Verify temps and airflow.',
    type: 'Preventive Maintenance', priority: 'medium', status: 'open',
    asset_id: null, assetName: null, assetInv: null, assetType: null,
    location: 'Zagreb HQ, Server Room A',
    assignee_id: null, assigneeName: null,
    reporter_id: 'u5', reporterName: 'Nikola Šimić',
    source: 'maintenance', sourceRef: 'Maintenance: Quarterly HVAC', externalTicketRef: null,
    requiresApproval: false, approverName: null,
    dueDate: '2026-05-01', startedAt: null, completedAt: null,
    estimatedHours: 3, actualHours: null,
    checklist: [
      { id: 'c1', label: 'Check ambient temperature', done: false },
      { id: 'c2', label: 'Inspect filters', done: false },
      { id: 'c3', label: 'Test redundancy failover', done: false },
    ],
    activity: [
      { id: 'a1', action: 'Created', date: '2026-04-24T08:00:00Z', actor: 'System → Maintenance' },
    ],
    notes: '',
    comments: [],
  },
  {
    id: 'wo-014', wo_number: 'WO-2026-014', title: 'Upgrade RAM in developer workstations',
    description: 'Add 16GB RAM to 3 developer workstations as approved in Q2 budget.',
    type: 'Repair', priority: 'low', status: 'draft',
    asset_id: 'a14', assetName: 'Dell Precision 5570', assetInv: 'IT-WRK-008', assetType: 'Workstation',
    location: 'Zagreb HQ, Floor 2',
    assignee_id: 'u2', assigneeName: 'Maja Kovač',
    reporter_id: 'u1', reporterName: 'Ivan Horvat',
    source: 'project', sourceRef: 'Q2 Hardware Refresh', externalTicketRef: null,
    requiresApproval: false, approverName: null,
    dueDate: '2026-06-01', startedAt: null, completedAt: null,
    estimatedHours: 2, actualHours: null,
    checklist: [],
    activity: [
      { id: 'a1', action: 'Created', date: '2026-04-26T09:00:00Z', actor: 'Ivan Horvat' },
    ],
    notes: 'RAM modules on order.',
    comments: [],
  },
  {
    id: 'wo-015', wo_number: 'WO-2026-015', title: 'Setup VPN appliance at Split office',
    description: 'Install and configure FortiGate 60F at Split branch office for site-to-site VPN.',
    type: 'Installation', priority: 'critical', status: 'in_progress',
    asset_id: 'a15', assetName: 'FortiGate 60F', assetInv: 'IT-FW-005', assetType: 'Firewall',
    location: 'Split Office, Server Room',
    assignee_id: 'u1', assigneeName: 'Ivan Horvat',
    reporter_id: 'u5', reporterName: 'Nikola Šimić',
    source: 'project', sourceRef: 'Split Office Setup', externalTicketRef: 'JRA-4055',
    requiresApproval: false, approverName: null,
    dueDate: '2026-04-27', startedAt: '2026-04-26T08:00:00Z', completedAt: null,
    estimatedHours: 6, actualHours: 3,
    checklist: [
      { id: 'c1', label: 'Rack mount appliance', done: true },
      { id: 'c2', label: 'Configure WAN interface', done: true },
      { id: 'c3', label: 'Setup VPN tunnels', done: false },
      { id: 'c4', label: 'Test connectivity to HQ', done: false },
      { id: 'c5', label: 'Document configuration', done: false },
    ],
    activity: [
      { id: 'a2', action: 'In Progress', date: '2026-04-26T08:00:00Z', actor: 'Ivan Horvat' },
      { id: 'a1', action: 'Created', date: '2026-04-23T12:00:00Z', actor: 'Nikola Šimić' },
    ],
    notes: 'On site at Split. WAN link active, VPN config in progress.',
    comments: [],
  },
];

// ── Undo System ─────────────────────────────────────────────────────────────

let undoIdCounter = 0;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${hh}:${mm}`;
}

function isOverdue(dueDate: string | null, status: WOStatus): boolean {
  if (!dueDate || status === 'completed' || status === 'cancelled') return false;
  return new Date(dueDate) < new Date('2026-04-26T23:59:59Z');
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr.startsWith('2026-04-26');
}

function fuzzyMatch(query: string, haystack: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystackLower = haystack.toLowerCase();
  const haystackWords = haystackLower.split(/\s+/);
  return words.every(qWord =>
    haystackWords.some(hWord => hWord.startsWith(qWord))
  );
}

function buildSearchHaystack(wo: WorkOrder): string {
  return [wo.title, wo.assetName, wo.assigneeName, wo.location, wo.wo_number]
    .filter(Boolean)
    .join(' ');
}

// ── Workflow Stepper Component ──────────────────────────────────────────────

function WorkflowStepper({ wo, size = 'normal' }: { wo: WorkOrder; size?: 'normal' | 'small' }) {
  const steps = getStepperSteps(wo);
  const currentIdx = getStepIndex(steps, wo.status);
  const isCancelled = wo.status === 'cancelled';
  const isSmall = size === 'small';

  return (
    <div className={`flex items-center w-full ${isSmall ? 'gap-0.5' : 'gap-0'}`}>
      {steps.map((step, i) => {
        const isPast = !isCancelled && currentIdx >= 0 && i < currentIdx;
        const isCurrent = !isCancelled && i === currentIdx;
        const isFuture = isCancelled || currentIdx < 0 || i > currentIdx;

        const circleSize = isSmall ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';
        let circleCls = '';
        if (isPast) circleCls = 'bg-emerald-500';
        else if (isCurrent) circleCls = 'bg-blue-500 ring-2 ring-blue-200';
        else circleCls = 'bg-slate-200';

        if (isCancelled) circleCls = 'bg-slate-300';

        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center" style={{ minWidth: isSmall ? 'auto' : '0' }}>
              <div className={`${circleSize} rounded-full ${circleCls} flex-shrink-0`} />
              {!isSmall && (
                <span className={`text-[10px] mt-0.5 whitespace-nowrap ${
                  isCurrent ? 'text-blue-700 font-semibold' : isPast ? 'text-emerald-600' : 'text-slate-400'
                } ${isCancelled ? 'text-slate-400' : ''}`}>
                  {STATUS_LABELS[step]}
                </span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 ${isSmall ? 'mx-0.5' : 'mx-1'} ${
                isPast && !isCancelled ? 'bg-emerald-400' : 'bg-slate-200'
              } self-start ${isSmall ? 'mt-[5px]' : 'mt-[7px]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── WO Card Component ───────────────────────────────────────────────────────

function WOCard({
  wo,
  onSelect,
  onAction,
  onClaim,
}: {
  wo: WorkOrder;
  onSelect: (id: string) => void;
  onAction: (id: string, newStatus: WOStatus) => void;
  onClaim: (id: string) => void;
}) {
  const isUnassigned = !wo.assigneeName;
  const overdue = isOverdue(wo.dueDate, wo.status);
  const today = isToday(wo.dueDate);

  function getActionButton() {
    if (isUnassigned && wo.status !== 'pending_approval' && wo.status !== 'submitted') {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onClaim(wo.id); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
        >
          <Hand className="w-3.5 h-3.5" /> Claim
        </button>
      );
    }

    switch (wo.status) {
      case 'open':
        return (
          <button
            onClick={(e) => { e.stopPropagation(); onAction(wo.id, 'in_progress'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <Play className="w-3.5 h-3.5" /> Start Work
          </button>
        );
      case 'in_progress':
        return (
          <button
            onClick={(e) => { e.stopPropagation(); onAction(wo.id, 'completed'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Complete
          </button>
        );
      case 'on_hold':
        return (
          <button
            onClick={(e) => { e.stopPropagation(); onAction(wo.id, 'in_progress'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <Play className="w-3.5 h-3.5" /> Resume
          </button>
        );
      case 'draft':
        if (wo.requiresApproval) {
          return (
            <button
              onClick={(e) => { e.stopPropagation(); onAction(wo.id, 'submitted'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" /> Submit
            </button>
          );
        }
        return (
          <button
            onClick={(e) => { e.stopPropagation(); onAction(wo.id, 'open'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" /> Open
          </button>
        );
      case 'pending_approval':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-50 text-amber-600 cursor-default">
            <Clock className="w-3.5 h-3.5" /> Awaiting Approval
          </span>
        );
      case 'submitted':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-50 text-slate-500 cursor-default">
            <Clock className="w-3.5 h-3.5" /> Submitted
          </span>
        );
      default:
        return null;
    }
  }

  const checkDone = wo.checklist.filter(c => c.done).length;
  const checkTotal = wo.checklist.length;

  return (
    <div
      onClick={() => onSelect(wo.id)}
      className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border-l-4 ${PRIORITY_BORDER[wo.priority]} cursor-pointer flex flex-col`}
    >
      {/* Stepper */}
      <div className="px-5 pt-4 pb-3">
        <WorkflowStepper wo={wo} size="small" />
      </div>

      {/* Body */}
      <div className="px-5 pb-3 flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-slate-500 uppercase">{wo.type}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SOURCE_BADGE[wo.source].cls}`}>
            {SOURCE_BADGE[wo.source].label}
          </span>
        </div>
        <p className="text-sm font-semibold text-slate-800 leading-snug mb-3">{wo.title}</p>

        {wo.assetName && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2">
            <Package className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{wo.assetName}</span>
            <span className="text-slate-400">{wo.assetInv}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate">{wo.location}</span>
        </div>

        {wo.assigneeName && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2">
            <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>{wo.assigneeName}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs mb-2">
          <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className={overdue ? 'text-red-600 font-semibold' : today ? 'text-amber-600 font-medium' : 'text-slate-600'}>
            {formatDate(wo.dueDate)}{today ? ' (Today)' : ''}{overdue ? ' — Overdue' : ''}
          </span>
        </div>

        <div className="text-[10px] text-slate-400 mt-2">{wo.wo_number}</div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
        {getActionButton()}
        {checkTotal > 0 && (
          <div className="flex items-center gap-1 text-xs text-slate-400" title={`${checkDone}/${checkTotal} completed`}>
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>{checkDone}/{checkTotal}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── My Queue Tab ────────────────────────────────────────────────────────────

function MyQueueTab({
  workOrders,
  onSelect,
  onAction,
  onClaim,
  onNewWO,
  singleColumn = false,
  selectedId = null,
}: {
  workOrders: WorkOrder[];
  onSelect: (id: string) => void;
  onAction: (id: string, newStatus: WOStatus) => void;
  onClaim: (id: string) => void;
  onNewWO: () => void;
  singleColumn?: boolean;
  selectedId?: string | null;
}) {
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('action_needed');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<WOPriority | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<WOType | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('priority');

  // My queue = assigned to current user OR unassigned
  const myWOs = useMemo(() =>
    workOrders.filter(wo =>
      wo.assigneeName === CURRENT_USER || wo.assigneeName === null
    ),
    [workOrders]
  );

  const actionNeeded = useMemo(() =>
    myWOs.filter(wo => ['draft', 'open', 'submitted', 'pending_approval'].includes(wo.status)),
    [myWOs]
  );
  const inProgress = useMemo(() =>
    myWOs.filter(wo => wo.status === 'in_progress'),
    [myWOs]
  );
  const onHold = useMemo(() =>
    myWOs.filter(wo => wo.status === 'on_hold'),
    [myWOs]
  );

  const filteredByQueue = useMemo(() => {
    switch (queueFilter) {
      case 'action_needed': return actionNeeded;
      case 'in_progress': return inProgress;
      case 'on_hold': return onHold;
    }
  }, [queueFilter, actionNeeded, inProgress, onHold]);

  const filtered = useMemo(() => {
    let result = filteredByQueue;
    if (searchQuery) {
      result = result.filter(wo => fuzzyMatch(searchQuery, buildSearchHaystack(wo)));
    }
    if (priorityFilter !== 'all') {
      result = result.filter(wo => wo.priority === priorityFilter);
    }
    if (typeFilter !== 'all') {
      result = result.filter(wo => wo.type === typeFilter);
    }
    // Sort
    result = [...result].sort((a, b) => {
      switch (sortField) {
        case 'priority': return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        case 'dueDate': return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
        case 'createdAt': return 0; // already in order
        case 'status': return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        default: return 0;
      }
    });
    return result;
  }, [filteredByQueue, searchQuery, priorityFilter, typeFilter, sortField]);

  return (
    <div>
      {/* Header */}
      {!singleColumn && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800">My Queue</h2>
          <button
            onClick={onNewWO}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Work Order
          </button>
        </div>
      )}

      {/* Queue filter badges */}
      {!singleColumn && (
        <div className="flex gap-2 mb-4">
          {([
            ['action_needed', 'Action Needed', actionNeeded.length],
            ['in_progress', 'In Progress', inProgress.length],
            ['on_hold', 'On Hold', onHold.length],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setQueueFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                queueFilter === key
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search work orders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setSearchQuery(''); } }}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          </button>
        )}
      </div>

      {/* Filter bar */}
      {!singleColumn && <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Priority filters */}
        <button
          onClick={() => setPriorityFilter('all')}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            priorityFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All
        </button>
        {WO_PRIORITIES.map(p => (
          <button
            key={p}
            onClick={() => setPriorityFilter(priorityFilter === p ? 'all' : p)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              priorityFilter === p ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[p]}`} />
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as WOType | 'all')}
          className="px-2.5 py-1 rounded border border-slate-200 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="all">All Types</option>
          {WO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Sort */}
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as SortField)}
          className="px-2.5 py-1 rounded border border-slate-200 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="priority">Sort: Priority</option>
          <option value="dueDate">Sort: Due Date</option>
          <option value="status">Sort: Status</option>
        </select>
      </div>}

      {/* Card grid or compact list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No work orders match your filters.</p>
        </div>
      ) : (
        <div className={singleColumn
          ? 'flex flex-col gap-3'
          : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4'
        }>
          {filtered.map(wo => (
            <div key={wo.id} className={selectedId === wo.id ? 'ring-2 ring-blue-500 rounded-xl' : ''}>
              <WOCard wo={wo} onSelect={onSelect} onAction={onAction} onClaim={onClaim} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Management Tab ──────────────────────────────────────────────────────────

function ManagementTab({
  workOrders,
  onSelect,
  onAction,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onDueDateChange,
  selectedIds,
  setSelectedIds,
  onBulkStatus,
  onBulkPriority,
  onBulkAssign,
  onBulkCancel,
  compact = false,
}: {
  workOrders: WorkOrder[];
  onSelect: (id: string) => void;
  onAction: (id: string, newStatus: WOStatus) => void;
  onStatusChange: (id: string, newStatus: WOStatus) => void;
  onPriorityChange: (id: string, newPriority: WOPriority) => void;
  onAssigneeChange: (id: string, newAssignee: string | null) => void;
  onDueDateChange: (id: string, newDate: string) => void;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onBulkStatus: (status: WOStatus) => void;
  onBulkPriority: (priority: WOPriority) => void;
  onBulkAssign: (assignee: string) => void;
  onBulkCancel: () => void;
  compact?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<WOStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<WOPriority | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<WOType | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<WOSource | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState<string>('priority');
  const [sortAsc, setSortAsc] = useState(true);
  const [showAssigneePanel, setShowAssigneePanel] = useState(false);

  // KPIs
  const totalOpen = workOrders.filter(wo => !['completed', 'cancelled'].includes(wo.status)).length;
  const overdueCount = workOrders.filter(wo => isOverdue(wo.dueDate, wo.status)).length;
  const pendingApproval = workOrders.filter(wo => wo.status === 'pending_approval').length;
  const completedWOs = workOrders.filter(wo => wo.status === 'completed');
  const avgResolution = completedWOs.length > 0
    ? (completedWOs.reduce((sum, wo) => {
        if (wo.completedAt && wo.activity.length > 0) {
          const created = new Date(wo.activity[wo.activity.length - 1].date);
          const completed = new Date(wo.completedAt);
          return sum + (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        }
        return sum;
      }, 0) / completedWOs.length).toFixed(1)
    : '—';

  // Pending my approval
  const pendingMyApproval = workOrders.filter(
    wo => wo.status === 'pending_approval' && wo.approverName === CURRENT_USER
  );

  // Filtered & sorted
  const filtered = useMemo(() => {
    let result = workOrders;
    if (statusFilter !== 'all') result = result.filter(wo => wo.status === statusFilter);
    if (priorityFilter !== 'all') result = result.filter(wo => wo.priority === priorityFilter);
    if (typeFilter !== 'all') result = result.filter(wo => wo.type === typeFilter);
    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned') result = result.filter(wo => !wo.assigneeName);
      else result = result.filter(wo => wo.assigneeName === assigneeFilter);
    }
    if (sourceFilter !== 'all') result = result.filter(wo => wo.source === sourceFilter);
    if (searchQuery) {
      result = result.filter(wo => fuzzyMatch(searchQuery, buildSearchHaystack(wo)));
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'priority': cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]; break;
        case 'status': cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]; break;
        case 'dueDate': cmp = (a.dueDate || '9999').localeCompare(b.dueDate || '9999'); break;
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'type': cmp = a.type.localeCompare(b.type); break;
        case 'assignee': cmp = (a.assigneeName || 'zzz').localeCompare(b.assigneeName || 'zzz'); break;
        case 'wo_number': cmp = a.wo_number.localeCompare(b.wo_number); break;
        default: cmp = 0;
      }
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [workOrders, statusFilter, priorityFilter, typeFilter, assigneeFilter, sourceFilter, searchQuery, sortCol, sortAsc]);

  function toggleSort(col: string) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(wo => wo.id)));
  }

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filtered.length;

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <th
      className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
      onClick={() => toggleSort(col)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortCol === col && (
          sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        )}
      </div>
    </th>
  );

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        {/* KPI Bar */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="text-xs text-slate-500 uppercase font-medium mb-1">Total Open</div>
            <div className="text-2xl font-bold text-blue-600">{totalOpen}</div>
          </div>
          <div className={`rounded-xl p-4 shadow-sm border ${overdueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
            <div className={`text-xs uppercase font-medium mb-1 ${overdueCount > 0 ? 'text-red-600' : 'text-slate-500'}`}>Overdue</div>
            <div className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>{overdueCount}</div>
          </div>
          <div className={`rounded-xl p-4 shadow-sm border ${pendingApproval > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
            <div className={`text-xs uppercase font-medium mb-1 ${pendingApproval > 0 ? 'text-amber-700' : 'text-slate-500'}`}>Pending Approval</div>
            <div className={`text-2xl font-bold ${pendingApproval > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{pendingApproval}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="text-xs text-slate-500 uppercase font-medium mb-1">Avg Resolution</div>
            <div className="text-2xl font-bold text-slate-400">{avgResolution}{avgResolution !== '—' ? 'd' : ''}</div>
          </div>
        </div>

        {/* Pending My Approval */}
        {pendingMyApproval.length > 0 && (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Pending My Approval ({pendingMyApproval.length})
            </h3>
            <div className="space-y-2">
              {pendingMyApproval.map(wo => (
                <div key={wo.id} className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{wo.title}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      {wo.assetName && <span>{wo.assetName} {wo.assetInv}</span>}
                      <span>Requested by: {wo.reporterName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <button
                      onClick={() => onAction(wo.id, 'open')}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => onAction(wo.id, 'draft')}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as WOStatus | 'all')}
            className="px-2.5 py-1.5 rounded border border-slate-200 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200">
            <option value="all">All Statuses</option>
            {(Object.keys(STATUS_LABELS) as WOStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as WOPriority | 'all')}
            className="px-2.5 py-1.5 rounded border border-slate-200 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200">
            <option value="all">All Priorities</option>
            {WO_PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as WOType | 'all')}
            className="px-2.5 py-1.5 rounded border border-slate-200 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200">
            <option value="all">All Types</option>
            {WO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded border border-slate-200 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200">
            <option value="all">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as WOSource | 'all')}
            className="px-2.5 py-1.5 rounded border border-slate-200 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200">
            <option value="all">All Sources</option>
            {(Object.keys(SOURCE_BADGE) as WOSource[]).map(s => <option key={s} value={s}>{SOURCE_BADGE[s].label}</option>)}
          </select>

          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setSearchQuery(''); } }}
              className="pl-8 pr-3 py-1.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 w-48"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <SortHeader col="priority">PRI</SortHeader>
                  <SortHeader col="wo_number">WO#</SortHeader>
                  <SortHeader col="title">TITLE</SortHeader>
                  <SortHeader col="type">TYPE</SortHeader>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ASSET</th>
                  <SortHeader col="assignee">ASSIGNEE</SortHeader>
                  <SortHeader col="status">STATUS</SortHeader>
                  <SortHeader col="dueDate">DUE DATE</SortHeader>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">SOURCE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(wo => {
                  const overdue = isOverdue(wo.dueDate, wo.status);
                  const validTransitions = STATUS_TRANSITIONS[wo.status];
                  return (
                    <tr
                      key={wo.id}
                      onClick={() => onSelect(wo.id)}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors border-l-4 ${PRIORITY_BORDER[wo.priority]} ${
                        selectedIds.has(wo.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(wo.id)}
                          onChange={() => toggleSelect(wo.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <select
                          value={wo.priority}
                          onChange={e => onPriorityChange(wo.id, e.target.value as WOPriority)}
                          className="appearance-none bg-transparent cursor-pointer focus:outline-none"
                          title={wo.priority}
                        >
                          {WO_PRIORITIES.map(p => (
                            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 font-mono">{wo.wo_number}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-sm text-slate-800 font-medium">{wo.title}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{wo.type}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        {wo.assetName ? (
                          <span>{wo.assetName} <span className="text-slate-400">{wo.assetInv}</span></span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <select
                          value={wo.assigneeName || ''}
                          onChange={e => onAssigneeChange(wo.id, e.target.value || null)}
                          className="text-xs text-slate-600 bg-transparent border-none cursor-pointer focus:outline-none focus:ring-0 p-0 max-w-[120px]"
                        >
                          <option value="">Unassigned</option>
                          {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        {validTransitions.length > 0 ? (
                          <select
                            value={wo.status}
                            onChange={e => onStatusChange(wo.id, e.target.value as WOStatus)}
                            className={`text-xs font-medium px-2 py-0.5 rounded-full border-none cursor-pointer focus:outline-none ${STATUS_BADGE[wo.status]}`}
                          >
                            <option value={wo.status}>{STATUS_LABELS[wo.status]}</option>
                            {validTransitions.map(s => (
                              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[wo.status]}`}>
                            {STATUS_LABELS[wo.status]}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="date"
                          value={wo.dueDate || ''}
                          onChange={e => onDueDateChange(wo.id, e.target.value)}
                          className={`text-xs bg-transparent border-none cursor-pointer focus:outline-none p-0 ${
                            overdue ? 'text-red-600 font-semibold' : 'text-slate-600'
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SOURCE_BADGE[wo.source].cls}`}>
                          {SOURCE_BADGE[wo.source].label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">No work orders match your filters.</div>
          )}
        </div>

        {/* Assignee Panel toggle */}
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => setShowAssigneePanel(!showAssigneePanel)}
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <Users className="w-3.5 h-3.5" />
            {showAssigneePanel ? 'Hide' : 'Show'} Technician Panel
          </button>
        </div>
      </div>

      {/* Assignee Panel */}
      {showAssigneePanel && (
        <AssigneePanel onAssign={(techName) => {
          // If there's exactly one selected unassigned WO, assign it
          const selectedUnassigned = [...selectedIds].filter(id => {
            const wo = workOrders.find(w => w.id === id);
            return wo && !wo.assigneeName;
          });
          if (selectedUnassigned.length > 0) {
            selectedUnassigned.forEach(id => onAssigneeChange(id, techName));
          }
        }} />
      )}
    </div>
  );
}

// ── Assignee Panel ──────────────────────────────────────────────────────────

function AssigneePanel({ onAssign }: { onAssign: (name: string) => void }) {
  const eligible = TECHNICIAN_POOL.filter(t => t.eligible);
  const notEligible = TECHNICIAN_POOL.filter(t => !t.eligible);

  return (
    <div className="w-64 bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex-shrink-0 self-start sticky top-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Technicians</h3>

      <div className="mb-4">
        <div className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider mb-2">Eligible</div>
        <div className="space-y-2">
          {eligible.map(tech => (
            <button
              key={tech.name}
              onClick={() => onAssign(tech.name)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm text-slate-700">{tech.name}</span>
              </div>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 3 }, (_, i) => (
                  <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < tech.activeWOs ? 'bg-amber-400' : 'bg-slate-200'}`} />
                ))}
                <span className="text-[10px] text-slate-400 ml-1">{tech.activeWOs}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Not Eligible</div>
        <div className="space-y-2">
          {notEligible.map(tech => (
            <div
              key={tech.name}
              className="flex items-center justify-between p-2 rounded-lg opacity-60 cursor-not-allowed"
              title={tech.reason}
            >
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-300" />
                <span className="text-sm text-slate-500">{tech.name}</span>
              </div>
              <Lock className="w-3.5 h-3.5 text-slate-300" title={tech.reason} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Detail Panel ────────────────────────────────────────────────────────────

function DetailPanel({
  wo,
  onClose,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onDueDateChange,
  onTypeChange,
  onChecklistToggle,
  onChecklistAdd,
  onDescriptionChange,
  onNotesChange,
  onTitleChange,
  onCommentAdd,
  inline = false,
}: {
  wo: WorkOrder;
  onClose: () => void;
  onStatusChange: (id: string, status: WOStatus) => void;
  onPriorityChange: (id: string, priority: WOPriority) => void;
  onAssigneeChange: (id: string, assignee: string | null) => void;
  onDueDateChange: (id: string, date: string) => void;
  onTypeChange: (id: string, type: WOType) => void;
  onChecklistToggle: (woId: string, itemId: string) => void;
  onChecklistAdd: (woId: string, label: string) => void;
  onDescriptionChange: (woId: string, desc: string) => void;
  onNotesChange: (woId: string, notes: string) => void;
  onTitleChange: (woId: string, title: string) => void;
  onCommentAdd: (woId: string, text: string) => void;
  inline?: boolean;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(wo.title);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(wo.description);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(wo.notes);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleDraft(wo.title);
    setDescDraft(wo.description);
    setNotesDraft(wo.notes);
    setEditingTitle(false);
    setEditingDesc(false);
    setEditingNotes(false);
  }, [wo.id, wo.title, wo.description, wo.notes]);

  const validTransitions = STATUS_TRANSITIONS[wo.status];
  const checkDone = wo.checklist.filter(c => c.done).length;
  const checkTotal = wo.checklist.length;
  const checkPct = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0;

  function getActionButtons() {
    const buttons: React.ReactNode[] = [];

    if (wo.status === 'open') {
      buttons.push(
        <button key="start" onClick={() => onStatusChange(wo.id, 'in_progress')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
          <Play className="w-3.5 h-3.5" /> Start Work
        </button>
      );
    }
    if (wo.status === 'in_progress') {
      buttons.push(
        <button key="complete" onClick={() => onStatusChange(wo.id, 'completed')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
          <Check className="w-3.5 h-3.5" /> Complete
        </button>,
        <button key="hold" onClick={() => onStatusChange(wo.id, 'on_hold')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
          <Pause className="w-3.5 h-3.5" /> Put on Hold
        </button>
      );
    }
    if (wo.status === 'on_hold') {
      buttons.push(
        <button key="resume" onClick={() => onStatusChange(wo.id, 'in_progress')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
          <Play className="w-3.5 h-3.5" /> Resume
        </button>
      );
    }
    if (wo.status === 'draft') {
      if (wo.requiresApproval) {
        buttons.push(
          <button key="submit" onClick={() => onStatusChange(wo.id, 'submitted')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
            <ArrowRight className="w-3.5 h-3.5" /> Submit for Approval
          </button>
        );
      } else {
        buttons.push(
          <button key="open" onClick={() => onStatusChange(wo.id, 'open')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
            <ArrowRight className="w-3.5 h-3.5" /> Open
          </button>
        );
      }
    }

    // Cancel button for any status that allows it
    if (validTransitions.includes('cancelled')) {
      buttons.push(
        <button key="cancel" onClick={() => onStatusChange(wo.id, 'cancelled')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
          <XCircle className="w-3.5 h-3.5" /> Cancel
        </button>
      );
    }

    return buttons;
  }

  const inner = (
        <div className="p-6">
          {/* WO number */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono text-slate-400">{wo.wo_number}</span>
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 transition-colors" title="Close">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Title */}
          <div className="flex items-start gap-2 mb-4">
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={() => { onTitleChange(wo.id, titleDraft); setEditingTitle(false); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { onTitleChange(wo.id, titleDraft); setEditingTitle(false); }
                  if (e.key === 'Escape') { setTitleDraft(wo.title); setEditingTitle(false); }
                }}
                className="text-lg font-bold text-slate-800 flex-1 px-2 py-1 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-800 flex-1">{wo.title}</h2>
                <button onClick={() => setEditingTitle(true)} className="p-1 rounded hover:bg-slate-100 transition-colors flex-shrink-0">
                  <Edit2 className="w-4 h-4 text-slate-400" />
                </button>
              </>
            )}
          </div>

          {/* Stepper */}
          <div className="mb-5">
            <WorkflowStepper wo={wo} />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            {getActionButtons()}
          </div>

          {/* DETAILS */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">Details</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 uppercase">Status</label>
                {validTransitions.length > 0 ? (
                  <select
                    value={wo.status}
                    onChange={e => onStatusChange(wo.id, e.target.value as WOStatus)}
                    className={`block w-full mt-0.5 text-xs font-medium px-2 py-1 rounded border border-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200 ${STATUS_BADGE[wo.status]}`}
                  >
                    <option value={wo.status}>{STATUS_LABELS[wo.status]}</option>
                    {validTransitions.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                ) : (
                  <div className={`mt-0.5 text-xs font-medium px-2 py-1 rounded inline-block ${STATUS_BADGE[wo.status]}`}>
                    {STATUS_LABELS[wo.status]}
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase">Priority</label>
                <select
                  value={wo.priority}
                  onChange={e => onPriorityChange(wo.id, e.target.value as WOPriority)}
                  className="block w-full mt-0.5 text-xs px-2 py-1 rounded border border-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {WO_PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase">Type</label>
                <select
                  value={wo.type}
                  onChange={e => onTypeChange(wo.id, e.target.value as WOType)}
                  className="block w-full mt-0.5 text-xs px-2 py-1 rounded border border-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {WO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase">Due Date</label>
                <input
                  type="date"
                  value={wo.dueDate || ''}
                  onChange={e => onDueDateChange(wo.id, e.target.value)}
                  className={`block w-full mt-0.5 text-xs px-2 py-1 rounded border border-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                    isOverdue(wo.dueDate, wo.status) ? 'text-red-600 font-semibold' : ''
                  }`}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase">Assignee</label>
                <select
                  value={wo.assigneeName || ''}
                  onChange={e => onAssigneeChange(wo.id, e.target.value || null)}
                  className="block w-full mt-0.5 text-xs px-2 py-1 rounded border border-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Unassigned</option>
                  {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase">Reporter</label>
                <div className="mt-0.5 text-xs text-slate-600 px-2 py-1">{wo.reporterName}</div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase">Source</label>
                <div className="mt-0.5">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${SOURCE_BADGE[wo.source].cls}`}>
                    {SOURCE_BADGE[wo.source].label}
                  </span>
                  {wo.sourceRef && <span className="text-[10px] text-slate-400 ml-1.5">{wo.sourceRef}</span>}
                </div>
              </div>
              {wo.externalTicketRef && (
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Ticket</label>
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className="text-xs text-blue-600 font-medium">{wo.externalTicketRef}</span>
                    <ExternalLink className="w-3 h-3 text-blue-400" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ASSET / LOCATION */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">Asset / Location</div>
            {wo.assetName ? (
              <div className="mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{wo.assetName}</span>
                  <span className="text-xs text-slate-400">{wo.assetInv}</span>
                  <button className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5 ml-auto">
                    <ArrowRight className="w-3 h-3" /> View asset
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mb-2">No asset linked (location-only WO)</p>
            )}
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400" />
              {wo.location}
            </div>
            {wo.assetInTransit && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Asset is in transit — assignee pool unavailable until asset arrives</span>
              </div>
            )}
          </div>

          {/* DESCRIPTION */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">Description</div>
            {editingDesc ? (
              <textarea
                autoFocus
                value={descDraft}
                onChange={e => setDescDraft(e.target.value)}
                onBlur={() => { onDescriptionChange(wo.id, descDraft); setEditingDesc(false); }}
                className="w-full text-sm text-slate-700 p-2 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 min-h-[80px] resize-y"
              />
            ) : (
              <div
                onClick={() => setEditingDesc(true)}
                className="text-sm text-slate-700 p-2 rounded hover:bg-slate-50 cursor-text min-h-[40px]"
              >
                {wo.description || <span className="text-slate-400 italic">Click to add description...</span>}
              </div>
            )}
          </div>

          {/* CHECKLIST */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">
              Checklist {checkTotal > 0 && `(${checkDone}/${checkTotal} completed)`}
            </div>
            {checkTotal > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${checkPct}%` }}
                />
              </div>
            )}
            <div className="space-y-1.5 mb-3">
              {wo.checklist.map(item => (
                <label
                  key={item.id}
                  className="flex items-center gap-2.5 p-1.5 rounded hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => onChecklistToggle(wo.id, item.id)}
                    className="rounded border-slate-300"
                  />
                  <span className={`text-sm ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add item..."
                value={newCheckItem}
                onChange={e => setNewCheckItem(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newCheckItem.trim()) {
                    onChecklistAdd(wo.id, newCheckItem.trim());
                    setNewCheckItem('');
                  }
                }}
                className="flex-1 text-sm px-2 py-1 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button
                onClick={() => {
                  if (newCheckItem.trim()) {
                    onChecklistAdd(wo.id, newCheckItem.trim());
                    setNewCheckItem('');
                  }
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add
              </button>
            </div>
          </div>

          {/* ACTIVITY TIMELINE */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">Activity Timeline</div>
            <div className="space-y-0">
              {wo.activity.map((entry, idx) => (
                <div key={entry.id} className="flex items-start gap-3 relative">
                  {/* Vertical line */}
                  {idx < wo.activity.length - 1 && (
                    <div className="absolute left-[7px] top-[14px] bottom-0 w-0.5 bg-slate-200" style={{ height: '100%' }} />
                  )}
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-300 flex-shrink-0 mt-0.5 z-10 border-2 border-white" />
                  <div className="flex-1 pb-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-slate-700">{entry.action}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {formatDateTime(entry.date)} &middot; {entry.actor}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* COMMENTS */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">
              Comments {wo.comments.length > 0 && <span className="text-slate-300 ml-1">({wo.comments.length})</span>}
            </div>
            {wo.comments.length > 0 && (
              <div className="space-y-3 mb-3">
                {wo.comments.map(c => (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0 mt-0.5">
                      {c.author.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-slate-700">{c.author}</span>
                        <span className="text-[10px] text-slate-400">{new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} {new Date(c.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a comment..."
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                    onCommentAdd(wo.id, (e.target as HTMLInputElement).value.trim());
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
            </div>
          </div>

          {/* NOTES */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">Notes</div>
            {editingNotes ? (
              <textarea
                autoFocus
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                onBlur={() => { onNotesChange(wo.id, notesDraft); setEditingNotes(false); }}
                className="w-full text-sm text-slate-700 p-2 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 min-h-[80px] resize-y"
              />
            ) : (
              <div
                onClick={() => setEditingNotes(true)}
                className="text-sm text-slate-700 p-2 rounded hover:bg-slate-50 cursor-text min-h-[40px]"
              >
                {wo.notes || <span className="text-slate-400 italic">Click to add notes...</span>}
              </div>
            )}
          </div>
        </div>
  );

  if (inline) return inner;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 w-[640px] bg-white shadow-2xl border-l border-slate-200 z-50 overflow-y-auto"
        style={{ animation: 'slideIn 0.2s ease-out' }}
      >
        {inner}
      </div>
    </>
  );
}

// ── Inline Detail Panel wrapper ─────────────────────────────────────────────

function InlineDetailPanel(props: {
  wo: WorkOrder;
  onClose: () => void;
  onStatusChange: (id: string, status: WOStatus) => void;
  onPriorityChange: (id: string, priority: WOPriority) => void;
  onAssigneeChange: (id: string, assignee: string | null) => void;
  onDueDateChange: (id: string, date: string) => void;
  onTypeChange: (id: string, type: WOType) => void;
  onChecklistToggle: (woId: string, itemId: string) => void;
  onChecklistAdd: (woId: string, label: string) => void;
  onDescriptionChange: (woId: string, desc: string) => void;
  onNotesChange: (woId: string, notes: string) => void;
  onTitleChange: (woId: string, title: string) => void;
  onCommentAdd: (woId: string, text: string) => void;
}) {
  return <DetailPanel {...props} inline />;
}

// ── New WO Form ─────────────────────────────────────────────────────────────

function NewWOForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (form: NewWOForm) => void;
}) {
  const [form, setForm] = useState<NewWOForm>({
    title: '',
    type: 'Repair',
    priority: 'medium',
    assetName: '',
    location: '',
    assigneeName: '',
    dueDate: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.assetName.trim() && !form.location.trim()) errs.location = 'Asset or location is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (validate()) onCreate(form);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 w-[640px] bg-white shadow-2xl border-l border-slate-200 z-50 overflow-y-auto"
        style={{ animation: 'slideIn 0.2s ease-out' }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800">New Work Order</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 uppercase">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className={`block w-full mt-1 px-3 py-2 rounded-lg border ${errors.title ? 'border-red-300' : 'border-slate-200'} text-sm focus:outline-none focus:ring-2 focus:ring-blue-200`}
                placeholder="Work order title..."
              />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600 uppercase">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value as WOType })}
                  className="block w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {WO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 uppercase">Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value as WOPriority })}
                  className="block w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {WO_PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 uppercase">Asset</label>
              <input
                type="text"
                value={form.assetName}
                onChange={e => setForm({ ...form, assetName: e.target.value })}
                className="block w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Search assets... (optional)"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 uppercase">Location {!form.assetName && '*'}</label>
              <input
                type="text"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                className={`block w-full mt-1 px-3 py-2 rounded-lg border ${errors.location ? 'border-red-300' : 'border-slate-200'} text-sm focus:outline-none focus:ring-2 focus:ring-blue-200`}
                placeholder="Location... (required if no asset)"
              />
              {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 uppercase">Assignee</label>
              <select
                value={form.assigneeName}
                onChange={e => setForm({ ...form, assigneeName: e.target.value })}
                className="block w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Unassigned</option>
                {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 uppercase">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm({ ...form, dueDate: e.target.value })}
                className="block w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 uppercase">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="block w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 min-h-[100px] resize-y"
                placeholder="Describe the work to be done..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Create <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Bulk Actions Bar ────────────────────────────────────────────────────────

function BulkActionsBar({
  count,
  onStatusChange,
  onPriorityChange,
  onAssign,
  onCancel,
  onClear,
}: {
  count: number;
  onStatusChange: (status: WOStatus) => void;
  onPriorityChange: (priority: WOPriority) => void;
  onAssign: (assignee: string) => void;
  onCancel: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-3"
      style={{ animation: 'slideUp 0.2s ease-out' }}>
      <span className="text-sm font-medium">{count} selected</span>
      <div className="w-px h-5 bg-slate-600" />

      <select
        defaultValue=""
        onChange={e => { if (e.target.value) onStatusChange(e.target.value as WOStatus); e.target.value = ''; }}
        className="bg-slate-700 text-white text-xs rounded px-2 py-1.5 border-none focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
      >
        <option value="" disabled>Change Status</option>
        {(Object.keys(STATUS_LABELS) as WOStatus[]).filter(s => s !== 'completed' && s !== 'cancelled').map(s => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>

      <select
        defaultValue=""
        onChange={e => { if (e.target.value) onPriorityChange(e.target.value as WOPriority); e.target.value = ''; }}
        className="bg-slate-700 text-white text-xs rounded px-2 py-1.5 border-none focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
      >
        <option value="" disabled>Change Priority</option>
        {WO_PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
      </select>

      <select
        defaultValue=""
        onChange={e => { if (e.target.value) onAssign(e.target.value); e.target.value = ''; }}
        className="bg-slate-700 text-white text-xs rounded px-2 py-1.5 border-none focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
      >
        <option value="" disabled>Reassign</option>
        {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
      </select>

      <button
        onClick={onCancel}
        className="text-xs text-red-300 hover:text-red-200 font-medium px-2 py-1 rounded hover:bg-slate-700 transition-colors"
      >
        Cancel Selected
      </button>

      <div className="w-px h-5 bg-slate-600" />

      <button onClick={onClear} className="p-1 rounded hover:bg-slate-700 transition-colors">
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}

// ── Undo Toast ──────────────────────────────────────────────────────────────

function UndoToast({
  entry,
  onUndo,
  onDismiss,
}: {
  entry: UndoEntry;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [entry.id, onDismiss]);

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-800 text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-3"
      style={{ animation: 'slideUp 0.2s ease-out' }}
    >
      <span className="text-sm">Undo: {entry.label}</span>
      <button
        onClick={onUndo}
        className="text-sm font-semibold text-blue-300 hover:text-blue-200 transition-colors"
      >
        Undo
      </button>
      <button onClick={onDismiss} className="p-0.5 rounded hover:bg-slate-700 transition-colors">
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}

// ── Helper Components ───────────────────────────────────────────────────────

// CSS animation keyframes injected via style tag
const animStyles = `
@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
@keyframes slideUp {
  from { transform: translate(-50%, 20px); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
}
`;

// ── Main Component ──────────────────────────────────────────────────────────

export function WorkOrdersView() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  useEffect(() => {
    apiFetch<{ items: any[] }>('/work-orders/?limit=200')
      .then(resp => {
        if (resp.items?.length > 0) {
          setWorkOrders(resp.items.map((wo: any) => ({
            id: wo.id,
            wo_number: wo.wo_number ?? '',
            title: wo.title ?? '',
            description: wo.description ?? '',
            type: wo.type ?? 'Repair',
            priority: wo.priority ?? 'medium',
            status: wo.status ?? 'open',
            asset_id: wo.asset_id ?? null,
            assetName: wo.asset_name ?? null,
            assetInv: wo.asset_inv ?? null,
            assetType: wo.asset_type ?? null,
            assetInTransit: wo.asset_in_transit ?? false,
            location: wo.location ?? '',
            assignee_id: wo.assignee_id ?? null,
            assigneeName: wo.assignee_name ?? null,
            reporter_id: wo.reporter_id ?? '',
            reporterName: wo.reporter_name ?? '',
            source: wo.source ?? 'manual',
            sourceRef: wo.source_ref ?? null,
            externalTicketRef: wo.external_ticket_ref ?? null,
            requiresApproval: wo.requires_approval ?? false,
            approverName: wo.approver_name ?? null,
            dueDate: wo.due_date ?? null,
            startedAt: wo.started_at ?? null,
            completedAt: wo.completed_at ?? null,
            estimatedHours: wo.estimated_hours ?? null,
            actualHours: wo.actual_hours ?? null,
            checklist: wo.checklist ?? [],
            activity: wo.activity ?? [],
            notes: wo.notes ?? '',
            comments: wo.comments ?? [],
          })));
        }
      })
      .catch(() => {});
  }, []);

  const [activeTab, setActiveTab] = useState<TabId>('queue');
  const [selectedWOId, setSelectedWOId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [currentUndo, setCurrentUndo] = useState<UndoEntry | null>(null);

  const selectedWO = useMemo(() =>
    selectedWOId ? workOrders.find(wo => wo.id === selectedWOId) || null : null,
    [workOrders, selectedWOId]
  );

  // Ctrl+Z undo + Escape to close detail
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (undoStack.length > 0) {
          const entry = undoStack[undoStack.length - 1];
          // Perform undo immediately
          setWorkOrders(prev => prev.map(wo => wo.id === entry.woId ? { ...wo, [entry.field]: entry.oldValue } : wo));
          setUndoStack(prev => prev.slice(0, -1));
          setCurrentUndo(entry);
          setTimeout(() => setCurrentUndo(null), 3000);
        }
      }
      if (e.key === 'Escape' && selectedWOId) {
        setSelectedWOId(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, selectedWOId]);

  function pushUndo(woId: string, field: string, oldValue: unknown, newValue: unknown, label: string) {
    const entry: UndoEntry = {
      id: String(++undoIdCounter),
      woId,
      field,
      oldValue,
      newValue,
      label,
      timestamp: Date.now(),
    };
    setUndoStack(prev => [...prev, entry]);
  }

  function performUndo() {
    if (!currentUndo) return;
    const { woId, field, oldValue } = currentUndo;
    setWorkOrders(prev => prev.map(wo => {
      if (wo.id !== woId) return wo;
      return { ...wo, [field]: oldValue };
    }));
    setUndoStack(prev => prev.filter(e => e.id !== currentUndo.id));
    setCurrentUndo(null);
  }

  // Status change with undo
  function handleStatusChange(id: string, newStatus: WOStatus) {
    const wo = workOrders.find(w => w.id === id);
    if (!wo) return;
    const oldStatus = wo.status;
    pushUndo(id, 'status', oldStatus, newStatus, `Status changed to ${STATUS_LABELS[newStatus]}`);

    setWorkOrders(prev => prev.map(w => {
      if (w.id !== id) return w;
      const updates: Partial<WorkOrder> = { status: newStatus };
      if (newStatus === 'in_progress' && !w.startedAt) {
        updates.startedAt = new Date().toISOString();
      }
      if (newStatus === 'completed') {
        updates.completedAt = new Date().toISOString();
      }
      updates.activity = [
        { id: `a-${Date.now()}`, action: STATUS_LABELS[newStatus], date: new Date().toISOString(), actor: CURRENT_USER },
        ...w.activity,
      ];
      return { ...w, ...updates };
    }));
  }

  // Priority change with undo
  function handlePriorityChange(id: string, newPriority: WOPriority) {
    const wo = workOrders.find(w => w.id === id);
    if (!wo) return;
    pushUndo(id, 'priority', wo.priority, newPriority, `Priority changed to ${newPriority}`);
    setWorkOrders(prev => prev.map(w => w.id === id ? { ...w, priority: newPriority } : w));
  }

  // Assignee change with undo
  function handleAssigneeChange(id: string, newAssignee: string | null) {
    const wo = workOrders.find(w => w.id === id);
    if (!wo) return;
    pushUndo(id, 'assigneeName', wo.assigneeName, newAssignee, `Assignee changed to ${newAssignee || 'Unassigned'}`);
    setWorkOrders(prev => prev.map(w => {
      if (w.id !== id) return w;
      return {
        ...w,
        assigneeName: newAssignee,
        assignee_id: newAssignee ? `u-${newAssignee}` : null,
        activity: [
          { id: `a-${Date.now()}`, action: `Assigned to ${newAssignee || 'Unassigned'}`, date: new Date().toISOString(), actor: CURRENT_USER },
          ...w.activity,
        ],
      };
    }));
  }

  // Due date change with undo
  function handleDueDateChange(id: string, newDate: string) {
    const wo = workOrders.find(w => w.id === id);
    if (!wo) return;
    pushUndo(id, 'dueDate', wo.dueDate, newDate, `Due date changed to ${formatDate(newDate)}`);
    setWorkOrders(prev => prev.map(w => w.id === id ? { ...w, dueDate: newDate || null } : w));
  }

  // Type change (no undo)
  function handleTypeChange(id: string, newType: WOType) {
    setWorkOrders(prev => prev.map(w => w.id === id ? { ...w, type: newType } : w));
  }

  // Claim
  function handleClaim(id: string) {
    handleAssigneeChange(id, CURRENT_USER);
  }

  // Checklist toggle (no undo)
  function handleChecklistToggle(woId: string, itemId: string) {
    setWorkOrders(prev => prev.map(w => {
      if (w.id !== woId) return w;
      return {
        ...w,
        checklist: w.checklist.map(c => c.id === itemId ? { ...c, done: !c.done } : c),
      };
    }));
  }

  // Checklist add
  function handleChecklistAdd(woId: string, label: string) {
    setWorkOrders(prev => prev.map(w => {
      if (w.id !== woId) return w;
      return {
        ...w,
        checklist: [...w.checklist, { id: `c-${Date.now()}`, label, done: false }],
      };
    }));
  }

  // Description change
  function handleDescriptionChange(woId: string, desc: string) {
    setWorkOrders(prev => prev.map(w => w.id === woId ? { ...w, description: desc } : w));
  }

  // Notes change
  function handleNotesChange(woId: string, notes: string) {
    setWorkOrders(prev => prev.map(w => w.id === woId ? { ...w, notes } : w));
  }

  // Title change
  function handleTitleChange(woId: string, title: string) {
    setWorkOrders(prev => prev.map(w => w.id === woId ? { ...w, title } : w));
  }

  // Comment add
  function handleCommentAdd(woId: string, text: string) {
    setWorkOrders(prev => prev.map(w => w.id === woId ? {
      ...w,
      comments: [...w.comments, { id: `c-${Date.now()}`, author: CURRENT_USER, text, date: new Date().toISOString() }],
    } : w));
  }

  // Create new WO
  function handleCreate(form: NewWOForm) {
    const num = workOrders.length + 1;
    const newWO: WorkOrder = {
      id: `wo-new-${Date.now()}`,
      wo_number: `WO-2026-${String(num).padStart(3, '0')}`,
      title: form.title,
      description: form.description,
      type: form.type,
      priority: form.priority,
      status: 'draft',
      asset_id: form.assetName ? `a-new-${Date.now()}` : null,
      assetName: form.assetName || null,
      assetInv: form.assetName ? 'IT-NEW-001' : null,
      assetType: form.assetName ? 'Other' : null,
      location: form.location || 'Zagreb HQ',
      assignee_id: form.assigneeName ? `u-${form.assigneeName}` : null,
      assigneeName: form.assigneeName || null,
      reporter_id: 'u1',
      reporterName: CURRENT_USER,
      source: 'manual',
      sourceRef: null,
      externalTicketRef: null,
      requiresApproval: false,
      approverName: null,
      dueDate: form.dueDate || null,
      startedAt: null,
      completedAt: null,
      estimatedHours: null,
      actualHours: null,
      checklist: [],
      activity: [
        { id: `a-${Date.now()}`, action: 'Created', date: new Date().toISOString(), actor: CURRENT_USER },
      ],
      notes: '',
      comments: [],
    };
    setWorkOrders(prev => [newWO, ...prev]);
    setShowNewForm(false);
    setSelectedWOId(newWO.id);
  }

  // Bulk operations
  function handleBulkStatus(status: WOStatus) {
    selectedIds.forEach(id => handleStatusChange(id, status));
  }
  function handleBulkPriority(priority: WOPriority) {
    selectedIds.forEach(id => handlePriorityChange(id, priority));
  }
  function handleBulkAssign(assignee: string) {
    selectedIds.forEach(id => handleAssigneeChange(id, assignee));
  }
  function handleBulkCancel() {
    selectedIds.forEach(id => handleStatusChange(id, 'cancelled'));
  }

  const hasDetail = !!selectedWO;

  return (
    <>
      <style>{animStyles}</style>
      <div className="h-full bg-slate-50 flex flex-col overflow-hidden">
        {/* Tab header */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-200 shrink-0">
          <button
            onClick={() => { setActiveTab('queue'); setSelectedIds(new Set()); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'queue'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            My Queue
          </button>
          <button
            onClick={() => { setActiveTab('management'); setSelectedIds(new Set()); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'management'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Management
          </button>
        </div>

        {/* ── My Queue layout ──────────────────────────────────────────── */}
        {activeTab === 'queue' && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left: single column card when detail open, full grid when not */}
            <div className={`overflow-y-auto ${
              hasDetail ? 'w-[420px] shrink-0 border-r border-slate-200 bg-slate-50' : 'flex-1'
            }`}>
              <div className="p-4">
                {hasDetail && (
                  <button
                    onClick={() => setSelectedWOId(null)}
                    className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-3"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back to grid
                  </button>
                )}
                <MyQueueTab
                  workOrders={workOrders}
                  onSelect={setSelectedWOId}
                  onAction={handleStatusChange}
                  onClaim={handleClaim}
                  onNewWO={() => setShowNewForm(true)}
                  singleColumn={!!hasDetail}
                  selectedId={selectedWOId}
                />
              </div>
            </div>

            {/* Right: detail fills remaining space */}
            {selectedWO && (
              <div className="flex-1 min-w-0 overflow-y-auto bg-white border-l border-slate-100">
                <InlineDetailPanel
                  wo={selectedWO}
                  onClose={() => setSelectedWOId(null)}
                  onStatusChange={handleStatusChange}
                  onPriorityChange={handlePriorityChange}
                  onAssigneeChange={handleAssigneeChange}
                  onDueDateChange={handleDueDateChange}
                  onTypeChange={handleTypeChange}
                  onChecklistToggle={handleChecklistToggle}
                  onChecklistAdd={handleChecklistAdd}
                  onDescriptionChange={handleDescriptionChange}
                  onNotesChange={handleNotesChange}
                  onTitleChange={handleTitleChange}
                  onCommentAdd={handleCommentAdd}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Management layout ──────────────────────────────────────── */}
        {activeTab === 'management' && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left: table (always full featured) */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              <div className="p-4">
                <ManagementTab
                  workOrders={workOrders}
                  onSelect={setSelectedWOId}
                  onAction={handleStatusChange}
                  onStatusChange={handleStatusChange}
                  onPriorityChange={handlePriorityChange}
                  onAssigneeChange={handleAssigneeChange}
                  onDueDateChange={handleDueDateChange}
                  selectedIds={selectedIds}
                  setSelectedIds={setSelectedIds}
                  onBulkStatus={handleBulkStatus}
                  onBulkPriority={handleBulkPriority}
                  onBulkAssign={handleBulkAssign}
                  onBulkCancel={handleBulkCancel}
                />
              </div>
            </div>

            {/* Right: narrower detail panel */}
            {selectedWO && (
              <div className="w-[38%] min-w-[420px] max-w-[600px] shrink-0 overflow-y-auto bg-white border-l border-slate-100">
                <InlineDetailPanel
                  wo={selectedWO}
                  onClose={() => setSelectedWOId(null)}
                  onStatusChange={handleStatusChange}
                  onPriorityChange={handlePriorityChange}
                  onAssigneeChange={handleAssigneeChange}
                  onDueDateChange={handleDueDateChange}
                  onTypeChange={handleTypeChange}
                  onChecklistToggle={handleChecklistToggle}
                  onChecklistAdd={handleChecklistAdd}
                  onDescriptionChange={handleDescriptionChange}
                  onNotesChange={handleNotesChange}
                  onTitleChange={handleTitleChange}
                  onCommentAdd={handleCommentAdd}
                />
              </div>
            )}

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
              <BulkActionsBar
                count={selectedIds.size}
                onStatusChange={handleBulkStatus}
                onPriorityChange={handleBulkPriority}
                onAssign={handleBulkAssign}
                onCancel={handleBulkCancel}
                onClear={() => setSelectedIds(new Set())}
              />
            )}
          </div>
        )}

        {/* New WO Form (overlay, shared) */}
        {showNewForm && (
          <NewWOForm
            onClose={() => setShowNewForm(false)}
            onCreate={handleCreate}
          />
        )}

        {/* Undo Toast — only on Ctrl+Z */}
        {currentUndo && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white text-sm rounded-lg px-4 py-2.5 shadow-xl animate-fade-in">
            Undone: {currentUndo.label}
          </div>
        )}
      </div>
    </>
  );
}

export default WorkOrdersView;
