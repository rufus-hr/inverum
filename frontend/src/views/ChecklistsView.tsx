import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../lib/api';
import {
  Search, Plus, X, Check, Clock,
  ClipboardCheck, CheckCircle2, MapPin,
  ChevronDown, Monitor, Laptop, Server,
  Edit2, GripVertical, Lock, Smartphone,
  ArrowUp, ArrowDown, Trash2, ToggleLeft, ToggleRight,
  FileText, Eye, AlertTriangle, ChevronRight, Calendar,
} from 'lucide-react';

// ── Types & Constants ───────────────────────────────────────────────────────

type TabId = 'templates' | 'active' | 'schedules';
type Frequency = 'per_event' | 'per_employee_once' | 'per_employee_yearly';
type CompletionStatus = 'open' | 'submitted' | 'confirmed';
type StatusFilter = 'all' | CompletionStatus;

interface ChecklistItemDef {
  id: string;
  text: string;
  orderIndex: number;
  isBlocking: boolean;
  requiresNote: boolean;
  dependsOn: string | null;
}

interface SopTemplate {
  id: string;
  name: string;
  triggers: string[];
  assetCategories: string[]; // asset type IDs, empty = all
  frequency: Frequency;
  isRequired: boolean;
  requiresConfirmation: boolean;
  confirmationGroupId: string | null; // user group that can perform 4-eyes confirmation
  isActive: boolean;
  items: ChecklistItemDef[];
}

interface ItemCompletion {
  itemId: string;
  checked: boolean;
  checkedBy: string | null;
  checkedAt: string | null;
  note: string | null;
}

interface ChecklistCompletion {
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

const CURRENT_USER = 'Ivan Horvat';

const USER_GROUPS = [
  { id: 'g1', name: 'IT Managers' },
  { id: 'g2', name: 'Security Officers' },
  { id: 'g3', name: 'Asset Managers' },
  { id: 'g4', name: 'Compliance Team' },
  { id: 'g5', name: 'Warehouse Supervisors' },
];

const TRIGGER_EVENTS = [
  { id: 'asset_import_to_stock', label: 'Import \u2192 Stock', color: 'blue' },
  { id: 'asset_stock_to_assigned', label: 'Stock \u2192 Assigned', color: 'emerald' },
  { id: 'asset_assigned_to_stock', label: 'Assigned \u2192 Stock', color: 'amber' },
  { id: 'asset_reassigned', label: 'Reassigned', color: 'purple' },
  { id: 'asset_to_service', label: 'To Service', color: 'orange' },
  { id: 'asset_from_service', label: 'From Service', color: 'teal' },
  { id: 'asset_retired', label: 'Retired', color: 'red' },
] as const;

const TRIGGER_MAP: Record<string, { label: string; color: string }> = Object.fromEntries(
  TRIGGER_EVENTS.map(t => [t.id, { label: t.label, color: t.color }])
);


const ASSET_TYPE_TREE = [
  { category: 'IT Infrastructure', types: [
    { id: 'server', name: 'Server' },
    { id: 'network_switch', name: 'Network Switch' },
    { id: 'firewall', name: 'Firewall' },
    { id: 'access_point', name: 'Access Point' },
    { id: 'router', name: 'Router' },
  ]},
  { category: 'End-User Devices', types: [
    { id: 'laptop', name: 'Laptop' },
    { id: 'desktop', name: 'Desktop' },
    { id: 'mobile_device', name: 'Mobile Device' },
    { id: 'tablet', name: 'Tablet' },
  ]},
  { category: 'Peripherals & Other', types: [
    { id: 'printer', name: 'Printer' },
    { id: 'monitor', name: 'Monitor' },
    { id: 'projector', name: 'Projector' },
  ]},
];
const ALL_ASSET_TYPES = ASSET_TYPE_TREE.flatMap(c => c.types);

const FREQUENCY_LABELS: Record<Frequency, string> = {
  per_event: 'Per Event',
  per_employee_once: 'Per Employee Once',
  per_employee_yearly: 'Per Employee Yearly',
};

const TRIGGER_COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
  teal: 'bg-teal-100 text-teal-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-700',
};

// ── Mock Data ───────────────────────────────────────────────────────────────

const INITIAL_TEMPLATES: SopTemplate[] = [
  {
    id: 't1', name: 'User Onboarding',
    triggers: ['asset_stock_to_assigned', 'asset_reassigned'],
    assetCategories: ['laptop', 'desktop', 'mobile_device', 'tablet'],
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

const INITIAL_COMPLETIONS: ChecklistCompletion[] = [
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
  {
    id: 'c3', templateId: 't3', templateName: 'EOL Decommission',
    trigger: 'asset_retired', status: 'open',
    assetName: 'Cisco Catalyst 2960', assetInv: 'INV-2022-0034', assetType: 'Network Switch', assetLocation: 'Split Office, Server Room',
    triggeredBy: 'Tomislav Blazevic', createdAt: '2026-04-26T11:00:00Z',
    submittedBy: null, submittedAt: null, confirmedBy: null, confirmedAt: null,
    requiresConfirmation: true,
    pendingTransition: 'Asset will be marked as retired',
    items: [
      { id: 'i10', text: 'Document asset condition with photos', orderIndex: 0, isBlocking: true, requiresNote: true, dependsOn: null, itemId: 'i10', checked: true, checkedBy: 'Tomislav Blazevic', checkedAt: '2026-04-26T11:30:00Z', note: 'Visible corrosion on ports 3-5, fan noise abnormal' },
      { id: 'i11', text: 'Remove all data (cryptographic erase)', orderIndex: 1, isBlocking: true, requiresNote: true, dependsOn: 'i10', itemId: 'i11', checked: true, checkedBy: 'Tomislav Blazevic', checkedAt: '2026-04-26T13:00:00Z', note: 'Factory reset performed, config wiped' },
      { id: 'i12', text: 'Remove from all monitoring systems', orderIndex: 2, isBlocking: true, requiresNote: false, dependsOn: null, itemId: 'i12', checked: true, checkedBy: 'Ivan Horvat', checkedAt: '2026-04-26T14:00:00Z', note: null },
      { id: 'i13', text: 'Remove asset tag and inventory label', orderIndex: 3, isBlocking: false, requiresNote: false, dependsOn: null, itemId: 'i13', checked: false, checkedBy: null, checkedAt: null, note: null },
      { id: 'i14', text: 'Package for disposal vendor pickup', orderIndex: 4, isBlocking: true, requiresNote: false, dependsOn: 'i11', itemId: 'i14', checked: false, checkedBy: null, checkedAt: null, note: null },
      { id: 'i15', text: 'Generate disposal certificate', orderIndex: 5, isBlocking: true, requiresNote: false, dependsOn: 'i14', itemId: 'i15', checked: false, checkedBy: null, checkedAt: null, note: null },
    ],
  },
  {
    id: 'c4', templateId: 't2', templateName: 'User Offboarding',
    trigger: 'asset_assigned_to_stock', status: 'submitted',
    assetName: 'Lenovo ThinkPad T14s', assetInv: 'INV-2023-0198', assetType: 'Laptop', assetLocation: 'Zagreb HQ, IT Room',
    triggeredBy: 'Ivan Horvat', createdAt: '2026-04-25T08:00:00Z',
    submittedBy: 'Ivan Horvat', submittedAt: '2026-04-25T12:00:00Z', confirmedBy: null, confirmedAt: null,
    requiresConfirmation: true,
    pendingTransition: 'Asset will be returned to stock',
    items: [
      { id: 'i6', text: 'Backup user data to network drive', orderIndex: 0, isBlocking: true, requiresNote: false, dependsOn: null, itemId: 'i6', checked: true, checkedBy: 'Ivan Horvat', checkedAt: '2026-04-25T09:00:00Z', note: null },
      { id: 'i7', text: 'Wipe local storage (NIST 800-88)', orderIndex: 1, isBlocking: true, requiresNote: true, dependsOn: 'i6', itemId: 'i7', checked: true, checkedBy: 'Ivan Horvat', checkedAt: '2026-04-25T10:30:00Z', note: 'Secure erase completed, 3 passes' },
      { id: 'i8', text: 'Remove asset labels and stickers', orderIndex: 2, isBlocking: false, requiresNote: false, dependsOn: null, itemId: 'i8', checked: true, checkedBy: 'Ivan Horvat', checkedAt: '2026-04-25T11:00:00Z', note: null },
      { id: 'i9', text: 'Return to stock shelf and update location', orderIndex: 3, isBlocking: true, requiresNote: false, dependsOn: 'i7', itemId: 'i9', checked: true, checkedBy: 'Ivan Horvat', checkedAt: '2026-04-25T11:30:00Z', note: null },
    ],
  },
  {
    id: 'c5', templateId: 't1', templateName: 'User Onboarding',
    trigger: 'asset_reassigned', status: 'submitted',
    assetName: 'MacBook Pro 14"', assetInv: 'INV-2024-0201', assetType: 'Laptop', assetLocation: 'Zagreb HQ, Floor 3',
    triggeredBy: 'Petra Babic', createdAt: '2026-04-24T13:00:00Z',
    submittedBy: 'Petra Babic', submittedAt: '2026-04-24T16:30:00Z', confirmedBy: null, confirmedAt: null,
    requiresConfirmation: false,
    pendingTransition: null,
    items: [
      { id: 'i1', text: 'Verify asset serial number matches inventory', orderIndex: 0, isBlocking: true, requiresNote: false, dependsOn: null, itemId: 'i1', checked: true, checkedBy: 'Petra Babic', checkedAt: '2026-04-24T13:15:00Z', note: null },
      { id: 'i2', text: 'Install standard software package', orderIndex: 1, isBlocking: true, requiresNote: false, dependsOn: 'i1', itemId: 'i2', checked: true, checkedBy: 'Petra Babic', checkedAt: '2026-04-24T14:00:00Z', note: null },
      { id: 'i3', text: 'Configure user account and email', orderIndex: 2, isBlocking: true, requiresNote: false, dependsOn: 'i2', itemId: 'i3', checked: true, checkedBy: 'Petra Babic', checkedAt: '2026-04-24T14:30:00Z', note: null },
      { id: 'i4', text: 'Test network connectivity', orderIndex: 3, isBlocking: false, requiresNote: false, dependsOn: null, itemId: 'i4', checked: true, checkedBy: 'Petra Babic', checkedAt: '2026-04-24T14:45:00Z', note: null },
      { id: 'i5', text: 'Hand over to employee and collect signature', orderIndex: 4, isBlocking: true, requiresNote: true, dependsOn: 'i3', itemId: 'i5', checked: true, checkedBy: 'Petra Babic', checkedAt: '2026-04-24T16:00:00Z', note: 'Signature collected from Luka Juric' },
    ],
  },
  {
    id: 'c6', templateId: 't3', templateName: 'EOL Decommission',
    trigger: 'asset_retired', status: 'submitted',
    assetName: 'HP LaserJet Pro M404', assetInv: 'INV-2021-0056', assetType: 'Printer', assetLocation: 'Rijeka Office',
    triggeredBy: 'Nikola Simic', createdAt: '2026-04-23T09:00:00Z',
    submittedBy: 'Nikola Simic', submittedAt: '2026-04-24T11:00:00Z', confirmedBy: null, confirmedAt: null,
    requiresConfirmation: true,
    pendingTransition: 'Asset will be marked as retired',
    items: [
      { id: 'i10', text: 'Document asset condition with photos', orderIndex: 0, isBlocking: true, requiresNote: true, dependsOn: null, itemId: 'i10', checked: true, checkedBy: 'Nikola Simic', checkedAt: '2026-04-23T09:30:00Z', note: 'Paper tray broken, toner low' },
      { id: 'i11', text: 'Remove all data (cryptographic erase)', orderIndex: 1, isBlocking: true, requiresNote: true, dependsOn: 'i10', itemId: 'i11', checked: true, checkedBy: 'Nikola Simic', checkedAt: '2026-04-23T10:00:00Z', note: 'Internal storage wiped via service menu' },
      { id: 'i12', text: 'Remove from all monitoring systems', orderIndex: 2, isBlocking: true, requiresNote: false, dependsOn: null, itemId: 'i12', checked: true, checkedBy: 'Nikola Simic', checkedAt: '2026-04-23T10:30:00Z', note: null },
      { id: 'i13', text: 'Remove asset tag and inventory label', orderIndex: 3, isBlocking: false, requiresNote: false, dependsOn: null, itemId: 'i13', checked: true, checkedBy: 'Nikola Simic', checkedAt: '2026-04-23T11:00:00Z', note: null },
      { id: 'i14', text: 'Package for disposal vendor pickup', orderIndex: 4, isBlocking: true, requiresNote: false, dependsOn: 'i11', itemId: 'i14', checked: true, checkedBy: 'Nikola Simic', checkedAt: '2026-04-23T14:00:00Z', note: null },
      { id: 'i15', text: 'Generate disposal certificate', orderIndex: 5, isBlocking: true, requiresNote: false, dependsOn: 'i14', itemId: 'i15', checked: true, checkedBy: 'Nikola Simic', checkedAt: '2026-04-23T15:00:00Z', note: null },
    ],
  },
  {
    id: 'c7', templateId: 't1', templateName: 'User Onboarding',
    trigger: 'asset_stock_to_assigned', status: 'confirmed',
    assetName: 'Dell OptiPlex 7090', assetInv: 'INV-2024-0155', assetType: 'Desktop', assetLocation: 'Zagreb HQ, Floor 1',
    triggeredBy: 'Ivan Horvat', createdAt: '2026-04-20T08:00:00Z',
    submittedBy: 'Ivan Horvat', submittedAt: '2026-04-20T14:00:00Z',
    confirmedBy: 'Ana Maric', confirmedAt: '2026-04-20T15:00:00Z',
    requiresConfirmation: false,
    pendingTransition: null,
    items: [
      { id: 'i1', text: 'Verify asset serial number matches inventory', orderIndex: 0, isBlocking: true, requiresNote: false, dependsOn: null, itemId: 'i1', checked: true, checkedBy: 'Ivan Horvat', checkedAt: '2026-04-20T08:15:00Z', note: null },
      { id: 'i2', text: 'Install standard software package', orderIndex: 1, isBlocking: true, requiresNote: false, dependsOn: 'i1', itemId: 'i2', checked: true, checkedBy: 'Ivan Horvat', checkedAt: '2026-04-20T09:30:00Z', note: null },
      { id: 'i3', text: 'Configure user account and email', orderIndex: 2, isBlocking: true, requiresNote: false, dependsOn: 'i2', itemId: 'i3', checked: true, checkedBy: 'Ivan Horvat', checkedAt: '2026-04-20T10:00:00Z', note: null },
      { id: 'i4', text: 'Test network connectivity', orderIndex: 3, isBlocking: false, requiresNote: false, dependsOn: null, itemId: 'i4', checked: true, checkedBy: 'Ivan Horvat', checkedAt: '2026-04-20T10:15:00Z', note: null },
      { id: 'i5', text: 'Hand over to employee and collect signature', orderIndex: 4, isBlocking: true, requiresNote: true, dependsOn: 'i3', itemId: 'i5', checked: true, checkedBy: 'Ivan Horvat', checkedAt: '2026-04-20T13:30:00Z', note: 'Handed to Petra Babic, signed' },
    ],
  },
  {
    id: 'c8', templateId: 't4', templateName: 'Preventive Maintenance',
    trigger: 'asset_to_service', status: 'confirmed',
    assetName: 'Cisco ASA 5506', assetInv: 'INV-2022-0078', assetType: 'Firewall', assetLocation: 'Zagreb HQ, Server Room',
    triggeredBy: 'Luka Juric', createdAt: '2026-04-18T10:00:00Z',
    submittedBy: 'Luka Juric', submittedAt: '2026-04-18T15:00:00Z',
    confirmedBy: null, confirmedAt: null,
    requiresConfirmation: false,
    pendingTransition: null,
    items: [
      { id: 'i16', text: 'Check firmware version and update if needed', orderIndex: 0, isBlocking: false, requiresNote: true, dependsOn: null, itemId: 'i16', checked: true, checkedBy: 'Luka Juric', checkedAt: '2026-04-18T11:00:00Z', note: 'Firmware 9.16.4 -> 9.18.2 updated' },
      { id: 'i17', text: 'Clean dust filters and fans', orderIndex: 1, isBlocking: false, requiresNote: false, dependsOn: null, itemId: 'i17', checked: true, checkedBy: 'Luka Juric', checkedAt: '2026-04-18T12:00:00Z', note: null },
      { id: 'i18', text: 'Run diagnostic tests and log results', orderIndex: 2, isBlocking: false, requiresNote: true, dependsOn: null, itemId: 'i18', checked: true, checkedBy: 'Luka Juric', checkedAt: '2026-04-18T14:30:00Z', note: 'All tests passed, throughput nominal' },
    ],
  },
];

// ── Helper Functions ────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function getTriggerBadge(triggerId: string) {
  const t = TRIGGER_MAP[triggerId];
  if (!t) return { label: triggerId, colorClass: 'bg-slate-100 text-slate-700' };
  return { label: t.label, colorClass: TRIGGER_COLOR_CLASSES[t.color] || 'bg-slate-100 text-slate-700' };
}

function getAssetIcon(type: string) {
  switch (type) {
    case 'Laptop': return Laptop;
    case 'Desktop': return Monitor;
    case 'Firewall': case 'Network Switch': return Server;
    case 'Printer': return FileText;
    default: return Smartphone;
  }
}

let _nextId = 100;
function genId(prefix: string) {
  return `${prefix}${_nextId++}`;
}

// ── Schedule Types & Mock Data ──────────────────────────────────────────────

type ScheduleInterval = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'biennial' | 'custom';

interface MaintenanceSchedule {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  assetTypeId: string | null;   // null = all asset types
  locationId: string | null;    // null = global (all locations)
  locationName: string | null;
  interval: ScheduleInterval;
  customDays: number | null;
  lastRun: string | null;
  nextRun: string;
  isActive: boolean;
  notes: string;
}

const SCHEDULE_INTERVALS: Record<ScheduleInterval, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly (3 mo)',
  semi_annual: 'Semi-Annual (6 mo)',
  annual: 'Annual (12 mo)',
  biennial: 'Biennial (24 mo)',
  custom: 'Custom interval',
};

const INITIAL_SCHEDULES: MaintenanceSchedule[] = [
  // ── Global schedules (location_id = null) ──
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
  // ── Location overrides ──
  {
    id: 'ms4', name: 'Split Ured → Server — Biennial',
    templateId: 't4', templateName: 'Preventive Maintenance',
    assetTypeId: 'server', locationId: 'loc-split', locationName: 'Split, Ured',
    interval: 'biennial', customDays: null,
    lastRun: '2025-06-20', nextRun: '2027-06-20',
    isActive: true, notes: 'Clean office, biennial is sufficient. Overrides quarterly global.',
  },
  {
    id: 'ms5', name: 'Skladište Jankomir → Server — Monthly',
    templateId: 't4', templateName: 'Preventive Maintenance',
    assetTypeId: 'server', locationId: 'loc-wh', locationName: 'Zagreb, Skladište Jankomir',
    interval: 'monthly', customDays: null,
    lastRun: '2026-03-28', nextRun: '2026-04-28',
    isActive: true, notes: 'Very dusty environment — monthly mandatory. Overrides quarterly global.',
  },
  {
    id: 'ms6', name: 'Skladište Jankomir → Laptop — Semi-Annual',
    templateId: 't4', templateName: 'Preventive Maintenance',
    assetTypeId: 'laptop', locationId: 'loc-wh', locationName: 'Zagreb, Skladište Jankomir',
    interval: 'semi_annual', customDays: null,
    lastRun: '2026-01-10', nextRun: '2026-07-10',
    isActive: true, notes: 'Dust affects laptops too. Overrides annual global.',
  },
];

// ── Templates Tab ───────────────────────────────────────────────────────────

function TemplateListPanel({
  templates,
  selectedId,
  onSelect,
  onCreate,
  searchQuery,
  onSearchChange,
  filterTrigger,
  onFilterTriggerChange,
  filterCategory,
  onFilterCategoryChange,
}: {
  templates: SopTemplate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterTrigger: string;
  onFilterTriggerChange: (t: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (c: string) => void;
}) {
  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterTrigger && !t.triggers.includes(filterTrigger)) return false;
      if (filterCategory && !t.assetCategories.includes(filterCategory)) return false;
      return true;
    });
  }, [templates, searchQuery, filterTrigger, filterCategory]);

  return (
    <div className="w-80 flex-shrink-0 border-r border-slate-200 flex flex-col h-full bg-white">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800">SOP Templates</h2>
          <button
            onClick={onCreate}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            New Template
          </button>
        </div>
        <div className="relative mb-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <select
            value={filterTrigger}
            onChange={e => onFilterTriggerChange(e.target.value)}
            className="flex-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Triggers</option>
            {TRIGGER_EVENTS.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={e => onFilterCategoryChange(e.target.value)}
            className="flex-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {ASSET_TYPE_TREE.map(cat => (
              <optgroup key={cat.category} label={cat.category}>
                {cat.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-4 text-center text-sm text-slate-400">No templates found</div>
        )}
        {filtered.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors ${
              selectedId === t.id
                ? 'bg-blue-50 border-l-2 border-l-blue-600'
                : 'hover:bg-slate-50 border-l-2 border-l-transparent'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-800 truncate">{t.name}</span>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </div>
            <div className="flex items-center gap-1 flex-wrap mb-1">
              {t.triggers.map(tr => {
                const b = getTriggerBadge(tr);
                return (
                  <span key={tr} className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${b.colorClass}`}>
                    {b.label}
                  </span>
                );
              })}
            </div>
            <span className="text-xs text-slate-400">{t.items.length} items</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Template Editor ─────────────────────────────────────────────────────────

function TemplateEditor({
  template,
  onUpdate,
}: {
  template: SopTemplate;
  onUpdate: (updated: SopTemplate) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(template.name);
  const [showTriggerDropdown, setShowTriggerDropdown] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const newItemRef = React.useRef<HTMLInputElement>(null);

  // Sync name value when template changes
  useEffect(() => {
    setNameValue(template.name);
    setEditingName(false);
    setEditingItemId(null);
    setShowTriggerDropdown(false);
  }, [template.id]);

  // Auto-focus name input on new template
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const saveName = () => {
    if (nameValue.trim()) {
      onUpdate({ ...template, name: nameValue.trim() });
    } else {
      setNameValue(template.name);
    }
    setEditingName(false);
  };

  const unselectedTriggers = TRIGGER_EVENTS.filter(t => !template.triggers.includes(t.id));

  const addTrigger = (triggerId: string) => {
    onUpdate({ ...template, triggers: [...template.triggers, triggerId] });
    setShowTriggerDropdown(false);
  };

  const removeTrigger = (triggerId: string) => {
    onUpdate({ ...template, triggers: template.triggers.filter(t => t !== triggerId) });
  };

  const updateItem = (itemId: string, patch: Partial<ChecklistItemDef>) => {
    onUpdate({
      ...template,
      items: template.items.map(it => it.id === itemId ? { ...it, ...patch } : it),
    });
  };

  const deleteItem = (itemId: string) => {
    const newItems = template.items
      .filter(it => it.id !== itemId)
      .map((it, idx) => ({
        ...it,
        orderIndex: idx,
        dependsOn: it.dependsOn === itemId ? null : it.dependsOn,
      }));
    onUpdate({ ...template, items: newItems });
  };

  const moveItem = (itemId: string, direction: 'up' | 'down') => {
    const items = [...template.items].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = items.findIndex(i => i.id === itemId);
    if (direction === 'up' && idx > 0) {
      [items[idx], items[idx - 1]] = [items[idx - 1], items[idx]];
    } else if (direction === 'down' && idx < items.length - 1) {
      [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
    }
    onUpdate({ ...template, items: items.map((it, i) => ({ ...it, orderIndex: i })) });
  };

  const addItem = () => {
    const newId = genId('item_');
    const newItem: ChecklistItemDef = {
      id: newId,
      text: '',
      orderIndex: template.items.length,
      isBlocking: false,
      requiresNote: false,
      dependsOn: null,
    };
    onUpdate({ ...template, items: [...template.items, newItem] });
    setEditingItemId(newId);
    setEditingItemText('');
    setTimeout(() => newItemRef.current?.focus(), 50);
  };

  const saveItemText = (itemId: string) => {
    if (editingItemText.trim()) {
      updateItem(itemId, { text: editingItemText.trim() });
    }
    setEditingItemId(null);
  };

  const sortedItems = [...template.items].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header: Name + Active toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameValue(template.name); setEditingName(false); } }}
              onBlur={saveName}
              className="text-xl font-semibold text-slate-800 border-b-2 border-blue-500 focus:outline-none bg-transparent"
            />
          ) : (
            <button
              onClick={() => { setEditingName(true); setNameValue(template.name); }}
              className="text-xl font-semibold text-slate-800 hover:text-blue-600 flex items-center gap-2 group"
            >
              {template.name}
              <Edit2 size={14} className="text-slate-400 group-hover:text-blue-500" />
            </button>
          )}
        </div>
        <button
          onClick={() => onUpdate({ ...template, isActive: !template.isActive })}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            template.isActive
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {template.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          {template.isActive ? 'Active' : 'Inactive'}
        </button>
      </div>

      {/* Trigger Events */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">Trigger Events</label>
        <div className="flex items-center gap-2 flex-wrap">
          {template.triggers.map(tr => {
            const b = getTriggerBadge(tr);
            return (
              <span key={tr} className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${b.colorClass}`}>
                {b.label}
                <button onClick={() => removeTrigger(tr)} className="hover:opacity-70">
                  <X size={12} />
                </button>
              </span>
            );
          })}
          <div className="relative">
            <button
              onClick={() => setShowTriggerDropdown(!showTriggerDropdown)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
            >
              <Plus size={12} />
              Add trigger
            </button>
            {showTriggerDropdown && unselectedTriggers.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 min-w-[180px]">
                {unselectedTriggers.map(t => {
                  const cc = TRIGGER_COLOR_CLASSES[t.color] || '';
                  return (
                    <button
                      key={t.id}
                      onClick={() => addTrigger(t.id)}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <span className={`w-2 h-2 rounded-full ${cc.split(' ')[0]}`} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Asset Types (multiselect tree) */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Applies to Asset Types
          {template.assetCategories.length === 0
            ? <span className="ml-2 text-xs text-slate-400 font-normal">All types</span>
            : <span className="ml-2 text-xs text-slate-400 font-normal">{template.assetCategories.length} selected</span>
          }
        </label>
        {/* Selected chips */}
        {template.assetCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {template.assetCategories.map(id => {
              const t = ALL_ASSET_TYPES.find(at => at.id === id);
              return t ? (
                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                  {t.name}
                  <button onClick={() => onUpdate({ ...template, assetCategories: template.assetCategories.filter(c => c !== id) })}
                    className="hover:text-blue-900">×</button>
                </span>
              ) : null;
            })}
            <button
              onClick={() => onUpdate({ ...template, assetCategories: [] })}
              className="text-xs text-slate-400 hover:text-slate-600 px-1"
            >Clear all</button>
          </div>
        )}
        {/* Tree picker */}
        <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
          {ASSET_TYPE_TREE.map(cat => {
            const catTypeIds = cat.types.map(t => t.id);
            const allSelected = catTypeIds.every(id => template.assetCategories.includes(id));
            const someSelected = !allSelected && catTypeIds.some(id => template.assetCategories.includes(id));
            return (
              <div key={cat.category}>
                <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={() => {
                      if (allSelected) {
                        onUpdate({ ...template, assetCategories: template.assetCategories.filter(id => !catTypeIds.includes(id)) });
                      } else {
                        const merged = new Set([...template.assetCategories, ...catTypeIds]);
                        onUpdate({ ...template, assetCategories: [...merged] });
                      }
                    }}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{cat.category}</span>
                </label>
                {cat.types.map(type => (
                  <label key={type.id} className="flex items-center gap-2 px-3 py-1.5 pl-8 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={template.assetCategories.includes(type.id)}
                      onChange={() => {
                        const has = template.assetCategories.includes(type.id);
                        onUpdate({
                          ...template,
                          assetCategories: has
                            ? template.assetCategories.filter(id => id !== type.id)
                            : [...template.assetCategories, type.id],
                        });
                      }}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-sm text-slate-700">{type.name}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Frequency */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">Frequency</label>
        <div className="flex gap-4">
          {(Object.entries(FREQUENCY_LABELS) as [Frequency, string][]).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`freq-${template.id}`}
                checked={template.frequency === val}
                onChange={() => onUpdate({ ...template, frequency: val })}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Flags */}
      <div className="mb-6 flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            onClick={() => onUpdate({ ...template, isRequired: !template.isRequired })}
            className={`relative w-9 h-5 rounded-full transition-colors ${template.isRequired ? 'bg-blue-600' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${template.isRequired ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
          <span className="text-sm text-slate-700">Required</span>
          <span className="text-xs text-slate-400">(blocks transition)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            onClick={() => onUpdate({ ...template, requiresConfirmation: !template.requiresConfirmation })}
            className={`relative w-9 h-5 rounded-full transition-colors ${template.requiresConfirmation ? 'bg-blue-600' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${template.requiresConfirmation ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
          <span className="text-sm text-slate-700">Requires 4-Eyes Confirmation</span>
        </label>
      </div>

      {/* Confirmation Group — only shown when 4-eyes is enabled */}
      {template.requiresConfirmation && (
        <div className="mb-6 ml-11">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Confirmation Group</label>
          <select
            value={template.confirmationGroupId || ''}
            onChange={e => onUpdate({ ...template, confirmationGroupId: e.target.value || null })}
            className="w-64 text-sm border border-slate-200 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Any user with confirm permission</option>
            {USER_GROUPS.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Only members of this group can perform the second sign-off.</p>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-slate-200 my-6" />

      {/* Checklist Items */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          Checklist Items <span className="text-slate-400 font-normal">({sortedItems.length})</span>
        </h3>
      </div>

      <div className="space-y-2 mb-4">
        {sortedItems.map((item, idx) => {
          const isEditing = editingItemId === item.id;
          const previousItems = sortedItems.filter(it => it.orderIndex < item.orderIndex);
          return (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 group"
            >
              <GripVertical size={16} className="text-slate-300 flex-shrink-0 cursor-grab" />
              <span className="text-xs font-medium text-slate-400 w-5 flex-shrink-0">{idx + 1}.</span>

              {isEditing ? (
                <input
                  ref={item.text === '' ? newItemRef : undefined}
                  value={editingItemText}
                  onChange={e => setEditingItemText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveItemText(item.id); if (e.key === 'Escape') setEditingItemId(null); }}
                  onBlur={() => saveItemText(item.id)}
                  placeholder="Enter item text..."
                  className="flex-1 text-sm text-slate-800 bg-white border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              ) : (
                <button
                  onClick={() => { setEditingItemId(item.id); setEditingItemText(item.text); }}
                  className="flex-1 text-left text-sm text-slate-800 hover:text-blue-600 truncate"
                >
                  {item.text || <span className="text-slate-400 italic">Click to edit...</span>}
                </button>
              )}

              {/* Blocking toggle */}
              <button
                onClick={() => updateItem(item.id, { isBlocking: !item.isBlocking })}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors flex-shrink-0 ${
                  item.isBlocking ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'
                }`}
                title="Blocking"
              >
                <Lock size={11} />
                Blocking
              </button>

              {/* Note Required toggle */}
              <button
                onClick={() => updateItem(item.id, { requiresNote: !item.requiresNote })}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors flex-shrink-0 ${
                  item.requiresNote ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'
                }`}
                title="Note Required"
              >
                <FileText size={11} />
                Note
              </button>

              {/* Dependency dropdown */}
              <select
                value={item.dependsOn || ''}
                onChange={e => updateItem(item.id, { dependsOn: e.target.value || null })}
                className="text-xs border border-slate-200 rounded px-1.5 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[120px] flex-shrink-0"
                title="Depends on"
              >
                <option value="">None</option>
                {previousItems.map(pi => (
                  <option key={pi.id} value={pi.id}>
                    {pi.orderIndex + 1}. {pi.text.slice(0, 20)}{pi.text.length > 20 ? '...' : ''}
                  </option>
                ))}
              </select>

              {/* Move buttons */}
              <button
                onClick={() => moveItem(item.id, 'up')}
                disabled={idx === 0}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 flex-shrink-0"
                title="Move up"
              >
                <ArrowUp size={14} />
              </button>
              <button
                onClick={() => moveItem(item.id, 'down')}
                disabled={idx === sortedItems.length - 1}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 flex-shrink-0"
                title="Move down"
              >
                <ArrowDown size={14} />
              </button>

              {/* Delete */}
              <button
                onClick={() => deleteItem(item.id)}
                className="p-1 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                title="Delete item"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={addItem}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
      >
        <Plus size={14} />
        Add Item
      </button>
    </div>
  );
}

// ── Active Checklists Tab ───────────────────────────────────────────────────

function ActiveChecklistsTab({
  completions,
  onUpdateCompletions,
}: {
  completions: ChecklistCompletion[];
  onUpdateCompletions: (updated: ChecklistCompletion[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  // Escape closes detail
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

    // If requires_note and about to check, require note
    if (!item.checked && item.requiresNote) {
      const note = noteInputs[itemId];
      if (!note?.trim()) return; // Must fill note first
    }

    const updatedItems = comp.items.map(i =>
      i.id === itemId
        ? {
            ...i,
            checked: !i.checked,
            checkedBy: !i.checked ? CURRENT_USER : null,
            checkedAt: !i.checked ? '2026-04-28T16:00:00Z' : null,
            note: !i.checked && i.requiresNote ? (noteInputs[itemId] || null) : i.note,
          }
        : i
    );

    onUpdateCompletions(
      completions.map(c => c.id === completionId ? { ...c, items: updatedItems } : c)
    );

    // Clear note input on check
    if (!item.checked) {
      setNoteInputs(prev => { const n = { ...prev }; delete n[itemId]; return n; });
    }
  };

  const submitCompletion = (completionId: string) => {
    onUpdateCompletions(
      completions.map(c =>
        c.id === completionId
          ? { ...c, status: 'submitted' as CompletionStatus, submittedBy: CURRENT_USER, submittedAt: '2026-04-28T16:00:00Z' }
          : c
      )
    );
  };

  const confirmCompletion = (completionId: string) => {
    onUpdateCompletions(
      completions.map(c =>
        c.id === completionId
          ? { ...c, status: 'confirmed' as CompletionStatus, confirmedBy: CURRENT_USER, confirmedAt: '2026-04-28T16:00:00Z' }
          : c
      )
    );
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
      {/* Table area */}
      <div className={`flex-1 flex flex-col min-w-0 ${selected ? 'border-r border-slate-200' : ''}`}>
        {/* Filters */}
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

        {/* Table */}
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

      {/* Completion Detail Panel */}
      {selected && (
        <CompletionDetailPanel
          completion={selected}
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

function CompletionDetailPanel({
  completion,
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
        {/* Close button */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Checklist Detail</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X size={16} />
          </button>
        </div>

        {/* Asset card */}
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

        {/* SOP info */}
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

        {/* Pending transition */}
        {completion.pendingTransition && completion.status !== 'confirmed' && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4 text-sm text-amber-800">
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Pending transition</div>
              <div className="text-xs mt-0.5">When completed: {completion.pendingTransition}</div>
            </div>
          </div>
        )}

        {/* Progress bar */}
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

        {/* Checklist items */}
        <div className="space-y-1 mb-4">
          {sortedItems.map(item => {
            const blocked = isItemBlocked(item);
            const isOpen = completion.status === 'open';
            const disabled = !isOpen || blocked;
            const needsNoteBefore = isOpen && !item.checked && item.requiresNote;

            return (
              <div key={item.id} className={`rounded-lg border p-3 ${blocked ? 'border-slate-200 bg-slate-50' : item.checked ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start gap-2.5">
                  {/* Checkbox */}
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

                    {/* Checked info */}
                    {item.checked && item.checkedBy && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        <Check size={10} className="inline text-emerald-500 mr-1" />
                        {item.checkedBy}, {item.checkedAt ? formatDateTime(item.checkedAt) : ''}
                      </div>
                    )}

                    {/* Note display */}
                    {item.checked && item.note && (
                      <div className="mt-1.5 text-xs text-slate-500 bg-slate-50 rounded px-2 py-1.5 border border-slate-200">
                        <FileText size={10} className="inline text-slate-400 mr-1" />
                        {item.note}
                      </div>
                    )}

                    {/* Blocked reason */}
                    {blocked && item.dependsOn && (
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Lock size={10} />
                        Complete &ldquo;{getParentText(item.dependsOn).slice(0, 40)}{getParentText(item.dependsOn).length > 40 ? '...' : ''}&rdquo; first
                      </div>
                    )}

                    {/* Note input when checking an item that requires a note */}
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

        {/* 4-eyes info */}
        {completion.requiresConfirmation && (() => {
          const tpl = INITIAL_TEMPLATES.find(t => t.id === completion.templateId);
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

        {/* Action buttons */}
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

// ── Schedules Tab ───────────────────────────────────────────────────────────

function SchedulesTab({
  schedules,
  onUpdate,
}: {
  schedules: MaintenanceSchedule[];
  onUpdate: (schedules: MaintenanceSchedule[]) => void;
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
  }

  function createSchedule(isGlobal: boolean) {
    const id = `ms-${Date.now()}`;
    const newSched: MaintenanceSchedule = {
      id, name: isGlobal ? 'New Global Schedule' : 'New Location Override',
      templateId: '', templateName: '',
      assetTypeId: null,
      locationId: isGlobal ? null : '', locationName: isGlobal ? null : '',
      interval: 'quarterly', customDays: null,
      lastRun: null, nextRun: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      isActive: true, notes: '',
    };
    onUpdate([...schedules, newSched]);
    setSelectedId(id);
    setShowNewMenu(false);
  }

  function deleteSchedule(id: string) {
    onUpdate(schedules.filter(s => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function isOverdue(nextRun: string) {
    return new Date(nextRun) < new Date();
  }

  // Find if a location override shadows a global schedule
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
      {/* Left: grouped schedule list */}
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
          {/* Global schedules */}
          <div className="mb-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-1.5">Global Schedules</div>
            {globals.length > 0 ? globals.map(s => <ScheduleRow key={s.id} s={s} />) : (
              <p className="text-xs text-slate-300 px-3 py-2">No global schedules</p>
            )}
          </div>
          {/* Location overrides */}
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-1.5">Location Overrides</div>
            {overrides.length > 0 ? overrides.map(s => <ScheduleRow key={s.id} s={s} />) : (
              <p className="text-xs text-slate-300 px-3 py-2">No location overrides</p>
            )}
          </div>
        </div>
      </div>

      {/* Right: schedule editor */}
      <div className="w-[clamp(640px,50%,800px)] shrink-0 overflow-y-auto">
        {selected ? (() => {
          const isGlobal = selected.locationId === null;
          const overriddenGlobal = getOverriddenGlobal(selected);
          const typeName = selected.assetTypeId ? (ALL_ASSET_TYPES.find(t => t.id === selected.assetTypeId)?.name ?? '') : '';

          return (
          <div className="p-6">
            {/* Scope badge */}
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium mb-4 ${
              isGlobal ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {isGlobal ? <><MapPin size={12} /> Global (all locations)</> : <><MapPin size={12} /> Location Override</>}
            </div>

            {/* Name + controls */}
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

            {/* SOP Template */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">SOP Template</label>
              <select
                value={selected.templateId}
                onChange={e => {
                  const tpl = INITIAL_TEMPLATES.find(t => t.id === e.target.value);
                  updateSchedule(selected.id, { templateId: e.target.value, templateName: tpl?.name || '' });
                }}
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a template...</option>
                {INITIAL_TEMPLATES.filter(t => t.isActive).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {/* Template checklist preview */}
              {selected.templateId && (() => {
                const tpl = INITIAL_TEMPLATES.find(t => t.id === selected.templateId);
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

            {/* Asset Type (single select) */}
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

            {/* Location (only for overrides) */}
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

            {/* Interval */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Interval</label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(SCHEDULE_INTERVALS) as [ScheduleInterval, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => updateSchedule(selected.id, { interval: val, customDays: val === 'custom' ? 90 : null })}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      selected.interval === val
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {selected.interval === 'custom' && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-slate-600">Every</span>
                  <input
                    type="number" min={1} max={1095}
                    value={selected.customDays ?? 90}
                    onChange={e => updateSchedule(selected.id, { customDays: parseInt(e.target.value) || 90 })}
                    className="w-20 text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">days</span>
                </div>
              )}
            </div>

            {/* Timing info */}
            <div className="mb-5 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Last Run</label>
                <p className="text-sm text-slate-700">{selected.lastRun || '—'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Next Run</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selected.nextRun}
                    onChange={e => updateSchedule(selected.id, { nextRun: e.target.value })}
                    className="text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {isOverdue(selected.nextRun) && selected.isActive && (
                    <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                      <AlertTriangle size={12} /> Overdue
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
              <textarea
                value={selected.notes}
                onChange={e => updateSchedule(selected.id, { notes: e.target.value })}
                placeholder="Additional notes about this schedule..."
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
              />
            </div>

            {/* Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-700 mb-1">Summary</p>
              <p>
                {isGlobal
                  ? <>Run <strong>{selected.templateName || '(no template)'}</strong> on <strong>{typeName || 'all asset types'}</strong> everywhere every <strong>{selected.interval === 'custom' ? `${selected.customDays} days` : SCHEDULE_INTERVALS[selected.interval].toLowerCase()}</strong>.</>
                  : <>Run <strong>{selected.templateName || '(no template)'}</strong> on <strong>{typeName || 'all asset types'}</strong> at <strong>{selected.locationName || '(no location)'}</strong> every <strong>{selected.interval === 'custom' ? `${selected.customDays} days` : SCHEDULE_INTERVALS[selected.interval].toLowerCase()}</strong>.</>
                }
                {!selected.isActive && <span className="text-amber-600 font-medium"> (Paused)</span>}
              </p>
              {overriddenGlobal && (
                <p className="mt-2 text-xs text-amber-600">
                  Overrides global {SCHEDULE_INTERVALS[overriddenGlobal.interval].toLowerCase()} schedule for {typeName} at this location.
                </p>
              )}
            </div>
          </div>
          );
        })() : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Calendar size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">Select a schedule or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function ChecklistsView() {
  const [activeTab, setActiveTab] = useState<TabId>('templates');
  const [templates, setTemplates] = useState<SopTemplate[]>([]);
  const [completions, setCompletions] = useState<ChecklistCompletion[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);

  useEffect(() => {
    apiFetch<{ items: any[] }>('/checklists/templates?limit=100')
      .then(resp => {
        if (resp.items?.length > 0) {
          setTemplates(resp.items as SopTemplate[]);
        }
      })
      .catch(() => {});
    apiFetch<{ items: any[] }>('/checklists/completions?limit=100')
      .then(resp => {
        if (resp.items?.length > 0) {
          setCompletions(resp.items as ChecklistCompletion[]);
        }
      })
      .catch(() => {});
    apiFetch<{ items: any[] }>('/maintenance-schedules/?limit=100')
      .then(resp => {
        if (resp.items?.length > 0) {
          setSchedules(resp.items as MaintenanceSchedule[]);
        }
      })
      .catch(() => {});
  }, []);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [tplSearchQuery, setTplSearchQuery] = useState('');
  const [tplFilterTrigger, setTplFilterTrigger] = useState('');
  const [tplFilterCategory, setTplFilterCategory] = useState('');

  const selectedTemplate = selectedTemplateId ? templates.find(t => t.id === selectedTemplateId) || null : null;

  // Escape closes template selection when on templates tab
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeTab === 'templates' && selectedTemplateId) {
        e.stopPropagation();
        setSelectedTemplateId(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeTab, selectedTemplateId]);

  const handleUpdateTemplate = useCallback((updated: SopTemplate) => {
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
  }, []);

  const handleCreateTemplate = useCallback(() => {
    const newId = genId('tpl_');
    const newTemplate: SopTemplate = {
      id: newId,
      name: 'New Template',
      triggers: [],
      assetCategories: [],
      frequency: 'per_event',
      isRequired: false,
      requiresConfirmation: false,
      confirmationGroupId: null,
      isActive: true,
      items: [],
    };
    setTemplates(prev => [newTemplate, ...prev]);
    setSelectedTemplateId(newId);
  }, []);

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'templates', label: 'Templates', icon: <ClipboardCheck size={16} /> },
    { id: 'active', label: 'Active Checklists', icon: <CheckCircle2 size={16} /> },
    { id: 'schedules', label: 'Schedules', icon: <Calendar size={16} /> },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Checklists & SOPs</h1>
            <p className="text-sm text-slate-500">Standard operating procedures and compliance checklists</p>
          </div>
        </div>
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'templates' && (
          <div className="flex h-full">
            <TemplateListPanel
              templates={templates}
              selectedId={selectedTemplateId}
              onSelect={setSelectedTemplateId}
              onCreate={handleCreateTemplate}
              searchQuery={tplSearchQuery}
              onSearchChange={setTplSearchQuery}
              filterTrigger={tplFilterTrigger}
              onFilterTriggerChange={setTplFilterTrigger}
              filterCategory={tplFilterCategory}
              onFilterCategoryChange={setTplFilterCategory}
            />
            <div className="flex-1 overflow-hidden">
              {selectedTemplate ? (
                <TemplateEditor
                  key={selectedTemplate.id}
                  template={selectedTemplate}
                  onUpdate={handleUpdateTemplate}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <ClipboardCheck size={40} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-sm text-slate-400">Select a template or create a new one</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'active' && (
          <ActiveChecklistsTab
            completions={completions}
            onUpdateCompletions={setCompletions}
          />
        )}

        {activeTab === 'schedules' && (
          <SchedulesTab
            schedules={schedules}
            onUpdate={setSchedules}
          />
        )}
      </div>
    </div>
  );
}

export default ChecklistsView;
