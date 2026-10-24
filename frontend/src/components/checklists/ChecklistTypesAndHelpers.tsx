import {
  Laptop, Monitor, Server, Smartphone, FileText,
} from 'lucide-react';

// ── Types & Constants ───────────────────────────────────────────────────────

export type TabKey = 'templates' | 'completions' | 'schedules';
export type Frequency = 'per_event' | 'per_first' | 'once';
export type CompletionStatus = 'open' | 'submitted' | 'confirmed';
export type StatusFilter = 'all' | CompletionStatus;
export type ScheduleInterval = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'biennial' | 'custom';

export interface ChecklistItemDef {
  id: string;
  text: string;
  orderIndex: number;
  isBlocking: boolean;
  requiresNote: boolean;
  dependsOn: string | null;
}

export interface SopTemplate {
  id: string;
  name: string;
  triggers: string[];
  assetCategories: string[];
  frequency: Frequency;
  isRequired: boolean;
  requiresConfirmation: boolean;
  confirmationGroupId: string | null;
  isActive: boolean;
  items: ChecklistItemDef[];
}

export const USER_GROUPS = [
  { id: 'g1', name: 'IT Security Team' },
  { id: 'g2', name: 'IT Managers' },
  { id: 'g3', name: 'Compliance Officers' },
  { id: 'g4', name: 'Department Heads' },
];

export interface ItemCompletion {
  itemId: string;
  checked: boolean;
  checkedBy: string | null;
  checkedAt: string | null;
  note: string | null;
}

export interface ChecklistCompletion {
  id: string;
  templateId: string;
  templateName: string;
  trigger: string;
  status: CompletionStatus;
  assetName: string;
  assetInv: string;
  assetType: string;
  assetLocation: string;
  triggeredBy: string;
  createdAt: string;
  submittedBy: string | null;
  submittedAt: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  requiresConfirmation: boolean;
  pendingTransition: string | null;
  items: (ChecklistItemDef & ItemCompletion)[];
}

export interface MaintenanceSchedule {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  assetTypeId: string | null;
  locationId: string | null;
  locationName: string | null;
  interval: ScheduleInterval;
  customDays: number | null;
  lastRun: string | null;
  nextRun: string;
  isActive: boolean;
  notes: string;
}

export const TRIGGER_EVENTS = [
  { id: 'asset_stock_to_assigned', label: 'Onboarding (Stock \u2192 Assigned)', color: 'emerald' },
  { id: 'asset_assigned_to_stock', label: 'Offboarding (Assigned \u2192 Stock)', color: 'amber' },
  { id: 'asset_reassigned', label: 'Reassignment', color: 'blue' },
  { id: 'asset_to_service', label: 'Sent to Service', color: 'orange' },
  { id: 'asset_retired', label: 'Retirement / Decommission', color: 'red' },
  { id: 'asset_created', label: 'Asset Registered', color: 'slate' },
  { id: 'asset_transferred', label: 'Location Transfer', color: 'purple' },
] as const;

export const TRIGGER_MAP: Record<string, { label: string; color: string }> = {};
TRIGGER_EVENTS.forEach(t => { TRIGGER_MAP[t.id] = { label: t.label, color: t.color }; });

export const TRIGGER_COLOR_CLASSES: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-700',
  purple: 'bg-purple-100 text-purple-700',
};

export interface AssetTypeNode {
  id: string;
  name: string;
  category: string;
}

export const ASSET_TYPE_TREE: { category: string; types: AssetTypeNode[] }[] = [
  {
    category: 'IT Equipment',
    types: [
      { id: 'laptop', name: 'Laptop', category: 'IT Equipment' },
      { id: 'desktop', name: 'Desktop', category: 'IT Equipment' },
      { id: 'monitor', name: 'Monitor', category: 'IT Equipment' },
      { id: 'server', name: 'Server', category: 'IT Equipment' },
      { id: 'phone', name: 'Phone', category: 'IT Equipment' },
      { id: 'printer', name: 'Printer', category: 'IT Equipment' },
    ],
  },
  {
    category: 'Network Equipment',
    types: [
      { id: 'network_switch', name: 'Network Switch', category: 'Network Equipment' },
      { id: 'firewall', name: 'Firewall', category: 'Network Equipment' },
      { id: 'access_point', name: 'Access Point', category: 'Network Equipment' },
      { id: 'router', name: 'Router', category: 'Network Equipment' },
    ],
  },
  {
    category: 'Vehicles',
    types: [
      { id: 'car', name: 'Car', category: 'Vehicles' },
      { id: 'van', name: 'Van', category: 'Vehicles' },
    ],
  },
  {
    category: 'Tools & Measuring',
    types: [
      { id: 'power_tool', name: 'Power Tool', category: 'Tools & Measuring' },
      { id: 'measuring_device', name: 'Measuring Device', category: 'Tools & Measuring' },
    ],
  },
  {
    category: 'Safety Equipment',
    types: [
      { id: 'fire_extinguisher', name: 'Fire Extinguisher', category: 'Safety Equipment' },
    ],
  },
];

export const ALL_ASSET_TYPES = ASSET_TYPE_TREE.flatMap(c => c.types);

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  per_event: 'Every Event',
  per_first: 'First Only',
  once: 'Once',
};

export const SCHEDULE_INTERVALS: Record<ScheduleInterval, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly (3 mo)',
  semi_annual: 'Semi-Annual (6 mo)',
  annual: 'Annual (12 mo)',
  biennial: 'Biennial (24 mo)',
  custom: 'Custom interval',
};

export const INTERVAL_DAYS_MAP: Record<ScheduleInterval, number> = {
  monthly: 30,
  quarterly: 90,
  semi_annual: 180,
  annual: 365,
  biennial: 730,
  custom: 60,
};

export function daysToScheduleInterval(days: number): { interval: ScheduleInterval; customDays: number | null } {
  if (days === 30) return { interval: 'monthly', customDays: null };
  if (days === 90) return { interval: 'quarterly', customDays: null };
  if (days === 180) return { interval: 'semi_annual', customDays: null };
  if (days === 365) return { interval: 'annual', customDays: null };
  if (days === 730) return { interval: 'biennial', customDays: null };
  return { interval: 'custom', customDays: days };
}

export const CURRENT_USER = 'Ivan Horvat';

// ── Mock Data ───────────────────────────────────────────────────────────────

export const INITIAL_TEMPLATES: SopTemplate[] = [
  {
    id: 't1', name: 'User Onboarding',
    triggers: ['asset_stock_to_assigned', 'asset_reassigned'],
    assetCategories: ['laptop', 'desktop', 'phone'],
    frequency: 'per_event', isRequired: true, requiresConfirmation: false, confirmationGroupId: null, isActive: true,
    items: [
      { id: 'i1', text: 'Verify asset serial number matches inventory', orderIndex: 0, isBlocking: true, requiresNote: false, dependsOn: null },
      { id: 'i2', text: 'Install standard software package', orderIndex: 1, isBlocking: true, requiresNote: false, dependsOn: 'i1' },
      { id: 'i3', text: 'Configure user account and email', orderIndex: 2, isBlocking: true, requiresNote: false, dependsOn: 'i2' },
      { id: 'i4', text: 'Test network connectivity', orderIndex: 3, isBlocking: false, requiresNote: false, dependsOn: null },
      { id: 'i5', text: 'Hand over to employee and collect signature', orderIndex: 4, isBlocking: true, requiresNote: true, dependsOn: 'i3' },
    ],
  },
  {
    id: 't2', name: 'User Offboarding',
    triggers: ['asset_assigned_to_stock'],
    assetCategories: [],
    frequency: 'per_event', isRequired: true, requiresConfirmation: true, confirmationGroupId: 'g1', isActive: true,
    items: [
      { id: 'i6', text: 'Backup user data to network drive', orderIndex: 0, isBlocking: true, requiresNote: false, dependsOn: null },
      { id: 'i7', text: 'Wipe local storage (NIST 800-88)', orderIndex: 1, isBlocking: true, requiresNote: true, dependsOn: 'i6' },
      { id: 'i8', text: 'Remove asset labels and stickers', orderIndex: 2, isBlocking: false, requiresNote: false, dependsOn: null },
      { id: 'i9', text: 'Return to stock shelf and update location', orderIndex: 3, isBlocking: true, requiresNote: false, dependsOn: 'i7' },
    ],
  },
  {
    id: 't3', name: 'EOL Decommission',
    triggers: ['asset_retired'],
    assetCategories: [],
    frequency: 'per_event', isRequired: true, requiresConfirmation: true, confirmationGroupId: 'g2', isActive: true,
    items: [
      { id: 'i10', text: 'Document asset condition with photos', orderIndex: 0, isBlocking: true, requiresNote: true, dependsOn: null },
      { id: 'i11', text: 'Remove all data (cryptographic erase)', orderIndex: 1, isBlocking: true, requiresNote: true, dependsOn: 'i10' },
      { id: 'i12', text: 'Remove from all monitoring systems', orderIndex: 2, isBlocking: true, requiresNote: false, dependsOn: null },
      { id: 'i13', text: 'Remove asset tag and inventory label', orderIndex: 3, isBlocking: false, requiresNote: false, dependsOn: null },
      { id: 'i14', text: 'Package for disposal vendor pickup', orderIndex: 4, isBlocking: true, requiresNote: false, dependsOn: 'i11' },
      { id: 'i15', text: 'Generate disposal certificate', orderIndex: 5, isBlocking: true, requiresNote: false, dependsOn: 'i14' },
    ],
  },
  {
    id: 't4', name: 'Preventive Maintenance',
    triggers: ['asset_to_service'],
    assetCategories: ['server', 'network_switch', 'firewall', 'access_point', 'router'],
    frequency: 'per_event', isRequired: false, requiresConfirmation: false, confirmationGroupId: null, isActive: true,
    items: [
      { id: 'i16', text: 'Check firmware version and update if needed', orderIndex: 0, isBlocking: false, requiresNote: true, dependsOn: null },
      { id: 'i17', text: 'Clean dust filters and fans', orderIndex: 1, isBlocking: false, requiresNote: false, dependsOn: null },
      { id: 'i18', text: 'Run diagnostic tests and log results', orderIndex: 2, isBlocking: false, requiresNote: true, dependsOn: null },
    ],
  },
];

export const INITIAL_COMPLETIONS: ChecklistCompletion[] = [
  {
    id: 'c1', templateId: 't1', templateName: 'User Onboarding',
    trigger: 'asset_stock_to_assigned', status: 'open',
    assetName: 'Dell Latitude 5540', assetInv: 'INV-2024-0142', assetType: 'Laptop', assetLocation: 'Zagreb HQ, Floor 2',
    triggeredBy: 'Ana Maric', createdAt: '2026-04-28T09:15:00Z',
    submittedBy: null, submittedAt: null, confirmedBy: null, confirmedAt: null,
    requiresConfirmation: false,
    pendingTransition: 'Asset will be assigned to Marko Petrovic',
    items: [
      { id: 'i1', text: 'Verify asset serial number matches inventory', orderIndex: 0, isBlocking: true, requiresNote: false, dependsOn: null, itemId: 'i1', checked: true, checkedBy: 'Ivan Horvat', checkedAt: '2026-04-28T09:20:00Z', note: null },
      { id: 'i2', text: 'Install standard software package', orderIndex: 1, isBlocking: true, requiresNote: false, dependsOn: 'i1', itemId: 'i2', checked: true, checkedBy: 'Ivan Horvat', checkedAt: '2026-04-28T09:45:00Z', note: null },
      { id: 'i3', text: 'Configure user account and email', orderIndex: 2, isBlocking: true, requiresNote: false, dependsOn: 'i2', itemId: 'i3', checked: true, checkedBy: 'Ivan Horvat', checkedAt: '2026-04-28T10:00:00Z', note: null },
      { id: 'i4', text: 'Test network connectivity', orderIndex: 3, isBlocking: false, requiresNote: false, dependsOn: null, itemId: 'i4', checked: false, checkedBy: null, checkedAt: null, note: null },
      { id: 'i5', text: 'Hand over to employee and collect signature', orderIndex: 4, isBlocking: true, requiresNote: true, dependsOn: 'i3', itemId: 'i5', checked: false, checkedBy: null, checkedAt: null, note: null },
    ],
  },
  {
    id: 'c2', templateId: 't2', templateName: 'User Offboarding',
    trigger: 'asset_assigned_to_stock', status: 'open',
    assetName: 'HP EliteBook 840 G9', assetInv: 'INV-2024-0087', assetType: 'Laptop', assetLocation: 'Zagreb HQ, IT Room',
    triggeredBy: 'Maja Kovac', createdAt: '2026-04-27T14:30:00Z',
    submittedBy: null, submittedAt: null, confirmedBy: null, confirmedAt: null,
    requiresConfirmation: true,
    pendingTransition: 'Asset will be returned to stock',
    items: [
      { id: 'i6', text: 'Backup user data to network drive', orderIndex: 0, isBlocking: true, requiresNote: false, dependsOn: null, itemId: 'i6', checked: true, checkedBy: 'Maja Kovac', checkedAt: '2026-04-27T15:00:00Z', note: null },
      { id: 'i7', text: 'Wipe local storage (NIST 800-88)', orderIndex: 1, isBlocking: true, requiresNote: true, dependsOn: 'i6', itemId: 'i7', checked: false, checkedBy: null, checkedAt: null, note: null },
      { id: 'i8', text: 'Remove asset labels and stickers', orderIndex: 2, isBlocking: false, requiresNote: false, dependsOn: null, itemId: 'i8', checked: true, checkedBy: 'Maja Kovac', checkedAt: '2026-04-27T15:10:00Z', note: null },
      { id: 'i9', text: 'Return to stock shelf and update location', orderIndex: 3, isBlocking: true, requiresNote: false, dependsOn: 'i7', itemId: 'i9', checked: false, checkedBy: null, checkedAt: null, note: null },
    ],
  },
];

export const INITIAL_SCHEDULES: MaintenanceSchedule[] = [
  {
    id: 'ms1', name: 'Server — Quarterly',
    templateId: 't4', templateName: 'Preventive Maintenance',
    assetTypeId: 'server', locationId: null, locationName: null,
    interval: 'quarterly', customDays: null,
    lastRun: '2026-01-15', nextRun: '2026-04-15',
    isActive: true, notes: 'Default quarterly maintenance for all servers.',
  },
  {
    id: 'ms2', name: 'Laptop — Annual',
    templateId: 't4', templateName: 'Preventive Maintenance',
    assetTypeId: 'laptop', locationId: null, locationName: null,
    interval: 'annual', customDays: null,
    lastRun: '2025-09-01', nextRun: '2026-09-01',
    isActive: true, notes: '',
  },
  {
    id: 'ms3', name: 'Network Switch — Semi-Annual',
    templateId: 't4', templateName: 'Preventive Maintenance',
    assetTypeId: 'network_switch', locationId: null, locationName: null,
    interval: 'semi_annual', customDays: null,
    lastRun: '2025-12-01', nextRun: '2026-06-01',
    isActive: true, notes: '',
  },
  {
    id: 'ms4', name: 'Split Ured → Server — Biennial',
    templateId: 't4', templateName: 'Preventive Maintenance',
    assetTypeId: 'server', locationId: 'loc-split', locationName: 'Split, Ured',
    interval: 'biennial', customDays: null,
    lastRun: '2025-06-20', nextRun: '2027-06-20',
    isActive: true, notes: 'Clean office, biennial is sufficient. Overrides quarterly global.',
  },
];

// ── Helper Functions ────────────────────────────────────────────────────────

export function relativeDate(iso: string): string {
  const now = new Date('2026-04-28T16:00:00Z');
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Yesterday';
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function getTriggerBadge(triggerId: string) {
  const t = TRIGGER_MAP[triggerId];
  if (!t) return { label: triggerId, colorClass: 'bg-slate-100 text-slate-700' };
  return { label: t.label, colorClass: TRIGGER_COLOR_CLASSES[t.color] || 'bg-slate-100 text-slate-700' };
}

export function getAssetIcon(type: string) {
  switch (type) {
    case 'Laptop': return Laptop;
    case 'Desktop': return Monitor;
    case 'Firewall': case 'Network Switch': return Server;
    case 'Printer': return FileText;
    default: return Smartphone;
  }
}

let _nextId = 100;
export function genId(prefix: string) {
  return `${prefix}${_nextId++}`;
}
