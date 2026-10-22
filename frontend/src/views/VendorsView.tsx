import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import {
  Building2, Search, Plus, X, Check, ChevronDown, ChevronRight,
  Star, Phone, Globe, MapPin, Mail, FileText, ExternalLink,
  MoreHorizontal, Edit2, Archive, Trash2, Users, Package,
  BarChart3, TrendingUp, AlertTriangle, Clock, DollarSign,
  Shield, Wrench, Filter, ArrowUpDown, Eye, Calendar,
} from 'lucide-react';

// ── Types & Constants ───────────────────────────────────────────────────────

type VendorType = 'reseller' | 'service' | 'distributor' | 'manufacturer' | 'carrier';
type ListMode = 'list' | 'matrix';
type ViewMode = 'list' | 'detail';
type DetailTab = 'overview' | 'contacts' | 'contracts' | 'assets' | 'reliability' | 'financials';
type ContractType = 'support' | 'warranty_ext' | 'maintenance' | 'framework' | 'purchase';
type ContractStatus = 'active' | 'expiring' | 'expired' | 'draft';

interface VendorContact {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  phone: string | null;
  notes: string | null;
  isPrimary: boolean;
}

interface VendorContract {
  id: string;
  name: string;
  type: ContractType;
  validFrom: string;
  validTo: string;
  value: number;
  currency: string;
  autoRenew: boolean;
  status: ContractStatus;
  notes: string | null;
  linkedAssets: number;
}

interface VendorAsset {
  id: string;
  tag: string;
  model: string;
  status: string;
  assignedTo: string | null;
  purchasedAt: string;
}

interface ServiceRecord {
  id: string;
  date: string;
  woNumber: string;
  assetTag: string;
  issue: string;
  durationDays: number;
}

interface ActivityEntry {
  id: string;
  date: string;
  description: string;
}

interface Vendor {
  id: string;
  name: string;
  types: VendorType[];
  oib: string;
  phone: string;
  website: string;
  address: string;
  assetCount: number;
  spend: number;
  openWO: number;
  reliability: number | null;
  failureRate: number | null;
  mttr: number | null;
  repeatFailure: number | null;
  warrantyHonored: number | null;
  isArchived: boolean;
  contacts: VendorContact[];
  contracts: VendorContract[];
  assets: VendorAsset[];
  serviceRecords: ServiceRecord[];
  activity: ActivityEntry[];
}

const VENDOR_TYPE_COLORS: Record<VendorType, string> = {
  reseller: 'bg-blue-100 text-blue-700',
  service: 'bg-emerald-100 text-emerald-700',
  distributor: 'bg-purple-100 text-purple-700',
  manufacturer: 'bg-slate-100 text-slate-700',
  carrier: 'bg-amber-100 text-amber-700',
};

const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  reseller: 'Reseller',
  service: 'Service',
  distributor: 'Distributor',
  manufacturer: 'Manufacturer',
  carrier: 'Carrier',
};

const ALL_VENDOR_TYPES: VendorType[] = ['reseller', 'service', 'distributor', 'manufacturer', 'carrier'];

const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  support: 'Support',
  warranty_ext: 'Warranty Ext',
  maintenance: 'Maintenance',
  framework: 'Framework',
  purchase: 'Purchase',
};

const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  active: 'bg-emerald-500',
  expiring: 'bg-amber-500',
  expired: 'bg-red-500',
  draft: 'bg-slate-400',
};

const INDUSTRY_AVG = {
  failureRate: 4.5,
  mttr: 5.1,
  repeatFailure: 8,
  warrantyHonored: 92,
};

// ── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_CONTACTS: Record<string, VendorContact[]> = {
  v1: [
    { id: 'c1', firstName: 'Marko', lastName: 'Marković', position: 'Account Manager', email: 'marko@recro.hr', phone: '+385 91 234 5678', notes: 'Primary point of contact for new orders', isPrimary: true },
    { id: 'c2', firstName: 'Petra', lastName: 'Petrović', position: 'Service Lead', email: 'petra@recro.hr', phone: '+385 91 234 5679', notes: 'Escalation for service issues', isPrimary: false },
    { id: 'c3', firstName: 'Ivo', lastName: 'Ivić', position: 'Sales', email: 'ivo@recro.hr', phone: null, notes: null, isPrimary: false },
  ],
  v2: [
    { id: 'c4', firstName: 'Ana', lastName: 'Anić', position: 'Key Account Manager', email: 'ana.anic@king-ict.hr', phone: '+385 91 345 6789', notes: 'Main contact for all orders', isPrimary: true },
    { id: 'c5', firstName: 'Tomislav', lastName: 'Tomić', position: 'Technical Lead', email: 'tomislav@king-ict.hr', phone: '+385 91 345 6790', notes: null, isPrimary: false },
  ],
  v3: [
    { id: 'c6', firstName: 'Maja', lastName: 'Majić', position: 'Sales Director', email: 'maja@span.hr', phone: '+385 91 456 7890', notes: 'Decision maker for framework agreements', isPrimary: true },
    { id: 'c7', firstName: 'Luka', lastName: 'Lukić', position: 'Support Engineer', email: 'luka@span.hr', phone: '+385 91 456 7891', notes: 'First-line support contact', isPrimary: false },
    { id: 'c8', firstName: 'Ivan', lastName: 'Horvat', position: 'Project Manager', email: 'ivan.horvat@span.hr', phone: null, notes: null, isPrimary: false },
    { id: 'c9', firstName: 'Katarina', lastName: 'Katić', position: 'Finance', email: 'katarina@span.hr', phone: '+385 91 456 7892', notes: 'Invoice and payment queries', isPrimary: false },
  ],
  v4: [
    { id: 'c10', firstName: 'Robert', lastName: 'Schmidt', position: 'Channel Manager', email: 'robert.schmidt@lenovo.com', phone: '+385 91 567 8901', notes: null, isPrimary: true },
    { id: 'c11', firstName: 'Jelena', lastName: 'Jelić', position: 'RMA Coordinator', email: 'jelena.jelic@lenovo.com', phone: '+385 91 567 8902', notes: 'Warranty and RMA claims', isPrimary: false },
  ],
  v5: [
    { id: 'c12', firstName: 'Damir', lastName: 'Damić', position: 'Operations Manager', email: 'damir@gls-croatia.com', phone: '+385 91 678 9012', notes: null, isPrimary: true },
  ],
  v6: [
    { id: 'c13', firstName: 'Nina', lastName: 'Ninić', position: 'Sales Representative', email: 'nina@datanet.hr', phone: '+385 91 789 0123', notes: null, isPrimary: true },
    { id: 'c14', firstName: 'Goran', lastName: 'Gorić', position: 'Technical Support', email: 'goran@datanet.hr', phone: '+385 91 789 0124', notes: 'Hardware support and troubleshooting', isPrimary: false },
  ],
  v7: [
    { id: 'c15', firstName: 'Martin', lastName: 'Kowalski', position: 'Enterprise Sales', email: 'martin.kowalski@hp.com', phone: '+385 91 890 1234', notes: null, isPrimary: true },
    { id: 'c16', firstName: 'Sara', lastName: 'Sarić', position: 'Support Specialist', email: 'sara.saric@hp.com', phone: '+385 91 890 1235', notes: 'ProBook and EliteBook warranty', isPrimary: false },
    { id: 'c17', firstName: 'Petar', lastName: 'Petar', position: 'Logistics', email: 'petar.p@hp.com', phone: null, notes: null, isPrimary: false },
  ],
  v8: [
    { id: 'c18', firstName: 'Domagoj', lastName: 'Domić', position: 'CEO', email: 'domagoj@combis.hr', phone: '+385 91 901 2345', notes: 'Strategic decisions only', isPrimary: false },
    { id: 'c19', firstName: 'Ivana', lastName: 'Ivanović', position: 'Account Manager', email: 'ivana@combis.hr', phone: '+385 91 901 2346', notes: 'Day-to-day contact', isPrimary: true },
    { id: 'c20', firstName: 'Hrvoje', lastName: 'Hrvojić', position: 'Service Desk Lead', email: 'hrvoje@combis.hr', phone: '+385 91 901 2347', notes: null, isPrimary: false },
  ],
};

const MOCK_CONTRACTS: Record<string, VendorContract[]> = {
  v1: [
    { id: 'ct1', name: 'Service SLA 2026', type: 'support', validFrom: '2026-01-01', validTo: '2026-12-31', value: 18000, currency: 'EUR', autoRenew: true, status: 'active', notes: 'Annual support agreement covering all purchased hardware', linkedAssets: 142 },
    { id: 'ct2', name: 'Framework Q2 2025', type: 'framework', validFrom: '2025-04-01', validTo: '2027-03-31', value: 450000, currency: 'EUR', autoRenew: false, status: 'active', notes: 'Multi-year framework for laptop and server procurement', linkedAssets: 89 },
    { id: 'ct3', name: 'Warranty Ext Lat5540', type: 'warranty_ext', validFrom: '2024-06-01', validTo: '2026-05-31', value: 4200, currency: 'EUR', autoRenew: false, status: 'expiring', notes: null, linkedAssets: 24 },
  ],
  v2: [
    { id: 'ct4', name: 'Annual Support 2026', type: 'support', validFrom: '2026-01-01', validTo: '2026-12-31', value: 12000, currency: 'EUR', autoRenew: true, status: 'active', notes: null, linkedAssets: 89 },
  ],
  v3: [
    { id: 'ct5', name: 'Maintenance HW 2025-2026', type: 'maintenance', validFrom: '2025-01-01', validTo: '2026-06-30', value: 8500, currency: 'EUR', autoRenew: false, status: 'expiring', notes: 'Covers all Span-sourced networking gear', linkedAssets: 34 },
    { id: 'ct6', name: 'Purchase Agreement 2026', type: 'purchase', validFrom: '2026-01-01', validTo: '2026-12-31', value: 95000, currency: 'EUR', autoRenew: false, status: 'active', notes: null, linkedAssets: 0 },
  ],
  v4: [
    { id: 'ct7', name: 'Extended Warranty ThinkPad', type: 'warranty_ext', validFrom: '2024-01-01', validTo: '2026-12-31', value: 6800, currency: 'EUR', autoRenew: false, status: 'active', notes: 'Covers T14s Gen 4 batch', linkedAssets: 42 },
  ],
  v5: [],
  v6: [
    { id: 'ct8', name: 'Distribution Agreement 2026', type: 'framework', validFrom: '2026-01-01', validTo: '2026-12-31', value: 22000, currency: 'EUR', autoRenew: true, status: 'active', notes: null, linkedAssets: 12 },
  ],
  v7: [
    { id: 'ct9', name: 'HP Care Pack Enterprise', type: 'support', validFrom: '2025-06-01', validTo: '2028-05-31', value: 15000, currency: 'EUR', autoRenew: false, status: 'active', notes: 'Enterprise support for all HP hardware', linkedAssets: 0 },
    { id: 'ct10', name: 'Maintenance 2024', type: 'maintenance', validFrom: '2024-01-01', validTo: '2024-12-31', value: 7500, currency: 'EUR', autoRenew: false, status: 'expired', notes: null, linkedAssets: 0 },
  ],
  v8: [
    { id: 'ct11', name: 'Managed Services 2026', type: 'support', validFrom: '2026-01-01', validTo: '2026-12-31', value: 24000, currency: 'EUR', autoRenew: true, status: 'active', notes: 'Full managed services including monitoring', linkedAssets: 34 },
    { id: 'ct12', name: 'HW Procurement Draft', type: 'purchase', validFrom: '2026-06-01', validTo: '2027-05-31', value: 120000, currency: 'EUR', autoRenew: false, status: 'draft', notes: 'Pending approval from finance', linkedAssets: 0 },
  ],
};

const MOCK_ASSETS: Record<string, VendorAsset[]> = {
  v1: [
    { id: 'a1', tag: 'IT-LAP-300013', model: 'Dell Latitude 5540', status: 'assigned', assignedTo: 'Ana Anić', purchasedAt: '2024-03-15' },
    { id: 'a2', tag: 'IT-LAP-300014', model: 'Dell Latitude 5540', status: 'assigned', assignedTo: 'Ivo Ivić', purchasedAt: '2024-03-15' },
    { id: 'a3', tag: 'IT-SRV-00012', model: 'Dell PowerEdge R750', status: 'in_service', assignedTo: 'DC Zagreb', purchasedAt: '2023-09-22' },
    { id: 'a4', tag: 'IT-LAP-300089', model: 'Dell Latitude 5540', status: 'assigned', assignedTo: 'Marko Horvat', purchasedAt: '2024-06-10' },
    { id: 'a5', tag: 'IT-MON-00045', model: 'Dell U2723QE', status: 'assigned', assignedTo: 'Ana Anić', purchasedAt: '2024-03-15' },
  ],
  v2: [
    { id: 'a6', tag: 'IT-LAP-300020', model: 'Lenovo ThinkPad T14s', status: 'assigned', assignedTo: 'Petra Petrović', purchasedAt: '2024-01-20' },
    { id: 'a7', tag: 'IT-LAP-300021', model: 'Lenovo ThinkPad T14s', status: 'assigned', assignedTo: 'Tomislav Tomić', purchasedAt: '2024-01-20' },
    { id: 'a8', tag: 'IT-NET-00008', model: 'Cisco Catalyst 9200', status: 'deployed', assignedTo: 'Server Room A', purchasedAt: '2023-11-15' },
  ],
  v3: [
    { id: 'a9', tag: 'IT-NET-00010', model: 'Cisco Meraki MR46', status: 'deployed', assignedTo: 'Floor 3', purchasedAt: '2024-02-28' },
    { id: 'a10', tag: 'IT-NET-00011', model: 'Cisco Meraki MR46', status: 'deployed', assignedTo: 'Floor 4', purchasedAt: '2024-02-28' },
    { id: 'a11', tag: 'IT-PRN-00003', model: 'HP LaserJet Pro', status: 'assigned', assignedTo: 'Reception', purchasedAt: '2023-08-10' },
  ],
  v4: [],
  v5: [],
  v6: [
    { id: 'a12', tag: 'IT-ACC-00100', model: 'Logitech MX Keys', status: 'assigned', assignedTo: 'Ivan Horvat', purchasedAt: '2025-01-15' },
    { id: 'a13', tag: 'IT-ACC-00101', model: 'Logitech MX Master 3S', status: 'in_stock', assignedTo: null, purchasedAt: '2025-01-15' },
  ],
  v7: [],
  v8: [
    { id: 'a14', tag: 'IT-LAP-300050', model: 'HP EliteBook 840 G10', status: 'assigned', assignedTo: 'Maja Majić', purchasedAt: '2024-09-01' },
    { id: 'a15', tag: 'IT-LAP-300051', model: 'HP EliteBook 840 G10', status: 'assigned', assignedTo: 'Luka Lukić', purchasedAt: '2024-09-01' },
    { id: 'a16', tag: 'IT-SRV-00015', model: 'HP ProLiant DL380', status: 'deployed', assignedTo: 'DC Zagreb', purchasedAt: '2024-07-20' },
  ],
};

const MOCK_SERVICE_RECORDS: Record<string, ServiceRecord[]> = {
  v1: [
    { id: 'sr1', date: '2026-04-28', woNumber: 'WO-2026-047', assetTag: 'IT-LAP-300013', issue: 'Battery replacement', durationDays: 3 },
    { id: 'sr2', date: '2026-04-12', woNumber: 'WO-2026-039', assetTag: 'IT-LAP-300089', issue: 'Screen replacement', durationDays: 5 },
    { id: 'sr3', date: '2026-03-22', woNumber: 'WO-2026-031', assetTag: 'IT-SRV-00012', issue: 'PSU failure', durationDays: 2 },
    { id: 'sr4', date: '2026-02-15', woNumber: 'WO-2026-018', assetTag: 'IT-LAP-300014', issue: 'Keyboard malfunction', durationDays: 4 },
    { id: 'sr5', date: '2026-01-08', woNumber: 'WO-2026-005', assetTag: 'IT-MON-00045', issue: 'Dead pixels warranty', durationDays: 7 },
  ],
  v2: [
    { id: 'sr6', date: '2026-04-20', woNumber: 'WO-2026-043', assetTag: 'IT-LAP-300020', issue: 'Docking station failure', durationDays: 2 },
    { id: 'sr7', date: '2026-03-10', woNumber: 'WO-2026-027', assetTag: 'IT-NET-00008', issue: 'Firmware update issue', durationDays: 1 },
    { id: 'sr8', date: '2026-02-05', woNumber: 'WO-2026-012', assetTag: 'IT-LAP-300021', issue: 'Trackpad replacement', durationDays: 4 },
    { id: 'sr9', date: '2025-12-18', woNumber: 'WO-2025-098', assetTag: 'IT-LAP-300020', issue: 'RAM upgrade', durationDays: 1 },
  ],
  v3: [
    { id: 'sr10', date: '2026-04-05', woNumber: 'WO-2026-034', assetTag: 'IT-NET-00010', issue: 'AP configuration reset', durationDays: 1 },
    { id: 'sr11', date: '2026-02-20', woNumber: 'WO-2026-020', assetTag: 'IT-NET-00011', issue: 'Firmware rollback', durationDays: 1 },
    { id: 'sr12', date: '2025-11-15', woNumber: 'WO-2025-088', assetTag: 'IT-PRN-00003', issue: 'Fuser unit replacement', durationDays: 3 },
    { id: 'sr13', date: '2025-09-30', woNumber: 'WO-2025-072', assetTag: 'IT-NET-00010', issue: 'PoE port failure', durationDays: 2 },
  ],
  v4: [
    { id: 'sr14', date: '2026-04-25', woNumber: 'WO-2026-045', assetTag: 'IT-LAP-300020', issue: 'Motherboard failure (warranty)', durationDays: 8 },
    { id: 'sr15', date: '2026-03-18', woNumber: 'WO-2026-029', assetTag: 'IT-LAP-300021', issue: 'Battery swelling', durationDays: 5 },
    { id: 'sr16', date: '2026-01-22', woNumber: 'WO-2026-009', assetTag: 'IT-LAP-300020', issue: 'Fan noise', durationDays: 3 },
    { id: 'sr17', date: '2025-10-10', woNumber: 'WO-2025-080', assetTag: 'IT-LAP-300021', issue: 'Hinge repair', durationDays: 10 },
    { id: 'sr18', date: '2025-08-05', woNumber: 'WO-2025-061', assetTag: 'IT-LAP-300020', issue: 'Display flicker', durationDays: 6 },
  ],
  v5: [],
  v6: [
    { id: 'sr19', date: '2026-03-15', woNumber: 'WO-2026-025', assetTag: 'IT-ACC-00100', issue: 'Key switch failure', durationDays: 5 },
    { id: 'sr20', date: '2026-01-10', woNumber: 'WO-2026-007', assetTag: 'IT-ACC-00100', issue: 'Bluetooth connectivity', durationDays: 8 },
    { id: 'sr21', date: '2025-11-20', woNumber: 'WO-2025-090', assetTag: 'IT-ACC-00101', issue: 'Scroll wheel defect', durationDays: 6 },
    { id: 'sr22', date: '2025-09-15', woNumber: 'WO-2025-070', assetTag: 'IT-ACC-00100', issue: 'USB receiver replacement', durationDays: 10 },
  ],
  v7: [
    { id: 'sr23', date: '2026-04-18', woNumber: 'WO-2026-041', assetTag: 'IT-LAP-300050', issue: 'BIOS update failure', durationDays: 4 },
    { id: 'sr24', date: '2026-03-05', woNumber: 'WO-2026-023', assetTag: 'IT-LAP-300051', issue: 'Touchpad driver issue', durationDays: 3 },
    { id: 'sr25', date: '2026-01-15', woNumber: 'WO-2026-010', assetTag: 'IT-SRV-00015', issue: 'RAID controller replacement', durationDays: 7 },
    { id: 'sr26', date: '2025-10-28', woNumber: 'WO-2025-083', assetTag: 'IT-LAP-300050', issue: 'Screen bezel crack', durationDays: 6 },
    { id: 'sr27', date: '2025-08-12', woNumber: 'WO-2025-063', assetTag: 'IT-LAP-300051', issue: 'Power adapter recall', durationDays: 5 },
  ],
  v8: [
    { id: 'sr28', date: '2026-04-22', woNumber: 'WO-2026-044', assetTag: 'IT-LAP-300050', issue: 'OS deployment issue', durationDays: 2 },
    { id: 'sr29', date: '2026-03-12', woNumber: 'WO-2026-026', assetTag: 'IT-SRV-00015', issue: 'Network card replacement', durationDays: 4 },
    { id: 'sr30', date: '2026-01-28', woNumber: 'WO-2026-011', assetTag: 'IT-LAP-300051', issue: 'Docking station config', durationDays: 1 },
    { id: 'sr31', date: '2025-11-08', woNumber: 'WO-2025-086', assetTag: 'IT-LAP-300050', issue: 'Memory module upgrade', durationDays: 2 },
    { id: 'sr32', date: '2025-09-22', woNumber: 'WO-2025-071', assetTag: 'IT-SRV-00015', issue: 'Disk array expansion', durationDays: 6 },
  ],
};

const MOCK_ACTIVITY: Record<string, ActivityEntry[]> = {
  v1: [
    { id: 'act1', date: '2026-04-28', description: 'WO-2026-047 closed — Battery replacement' },
    { id: 'act2', date: '2026-04-15', description: 'Contract "Service SLA 2026" amended' },
    { id: 'act3', date: '2026-03-22', description: '12 new assets purchased (Latitude 5540)' },
    { id: 'act4', date: '2026-02-10', description: 'Contact "Petra Petrović" added' },
    { id: 'act5', date: '2026-01-05', description: 'Vendor details updated — new phone number' },
  ],
  v2: [
    { id: 'act6', date: '2026-04-20', description: 'WO-2026-043 opened — Docking station failure' },
    { id: 'act7', date: '2026-03-15', description: 'Contract "Annual Support 2026" created' },
    { id: 'act8', date: '2026-02-01', description: '5 new assets purchased (ThinkPad T14s)' },
    { id: 'act9', date: '2025-12-18', description: 'WO-2025-098 closed — RAM upgrade' },
  ],
  v3: [
    { id: 'act10', date: '2026-04-05', description: 'WO-2026-034 closed — AP configuration reset' },
    { id: 'act11', date: '2026-03-01', description: 'Contract "Purchase Agreement 2026" created' },
    { id: 'act12', date: '2026-02-20', description: 'WO-2026-020 closed — Firmware rollback' },
    { id: 'act13', date: '2025-11-15', description: 'WO-2025-088 closed — Fuser unit replacement' },
    { id: 'act14', date: '2025-10-01', description: 'Contact "Katarina Katić" added' },
    { id: 'act15', date: '2025-09-30', description: 'WO-2025-072 closed — PoE port failure' },
  ],
  v4: [
    { id: 'act16', date: '2026-04-25', description: 'WO-2026-045 opened — Motherboard failure' },
    { id: 'act17', date: '2026-03-18', description: 'WO-2026-029 closed — Battery swelling' },
    { id: 'act18', date: '2026-01-22', description: 'WO-2026-009 closed — Fan noise' },
    { id: 'act19', date: '2025-10-10', description: 'WO-2025-080 closed — Hinge repair (10 day MTTR)' },
  ],
  v5: [
    { id: 'act20', date: '2026-03-01', description: 'Vendor created' },
    { id: 'act21', date: '2026-03-01', description: 'Contact "Damir Damić" added' },
    { id: 'act22', date: '2026-02-15', description: 'Shipping label generated for asset transfer' },
    { id: 'act23', date: '2026-01-10', description: 'Vendor details updated' },
  ],
  v6: [
    { id: 'act24', date: '2026-03-15', description: 'WO-2026-025 opened — Key switch failure' },
    { id: 'act25', date: '2026-01-15', description: '24 accessories purchased' },
    { id: 'act26', date: '2025-11-20', description: 'WO-2025-090 closed — Scroll wheel defect' },
    { id: 'act27', date: '2025-09-15', description: 'WO-2025-070 closed — USB receiver replacement' },
  ],
  v7: [
    { id: 'act28', date: '2026-04-18', description: 'WO-2026-041 opened — BIOS update failure' },
    { id: 'act29', date: '2026-03-05', description: 'WO-2026-023 closed — Touchpad driver issue' },
    { id: 'act30', date: '2026-01-15', description: 'WO-2026-010 opened — RAID controller' },
    { id: 'act31', date: '2025-10-28', description: 'WO-2025-083 closed — Screen bezel crack' },
  ],
  v8: [
    { id: 'act32', date: '2026-04-22', description: 'WO-2026-044 closed — OS deployment issue' },
    { id: 'act33', date: '2026-03-12', description: 'WO-2026-026 opened — Network card replacement' },
    { id: 'act34', date: '2026-01-28', description: 'WO-2026-011 closed — Docking station config' },
    { id: 'act35', date: '2026-01-01', description: 'Contract "Managed Services 2026" activated' },
    { id: 'act36', date: '2025-12-15', description: 'Contract "HW Procurement Draft" created' },
    { id: 'act37', date: '2025-11-08', description: 'WO-2025-086 closed — Memory module upgrade' },
  ],
};

const MOCK_VENDORS: Vendor[] = [
  { id: 'v1', name: 'Recro d.o.o.', types: ['reseller', 'service'], oib: '12345678901', phone: '+385 1 234 5678', website: 'www.recro.hr', address: 'Avenija Dubrovnik 15, Zagreb, HR', assetCount: 142, spend: 185200, openWO: 3, reliability: 87, failureRate: 3.1, mttr: 4.2, repeatFailure: 12, warrantyHonored: 96, isArchived: false, contacts: MOCK_CONTACTS.v1, contracts: MOCK_CONTRACTS.v1, assets: MOCK_ASSETS.v1, serviceRecords: MOCK_SERVICE_RECORDS.v1, activity: MOCK_ACTIVITY.v1 },
  { id: 'v2', name: 'King ICT d.o.o.', types: ['reseller'], oib: '23456789012', phone: '+385 1 345 6789', website: 'www.king-ict.hr', address: 'Buzinski prilaz 10, Zagreb, HR', assetCount: 89, spend: 98400, openWO: 1, reliability: 91, failureRate: 2.4, mttr: 3.8, repeatFailure: 7, warrantyHonored: 98, isArchived: false, contacts: MOCK_CONTACTS.v2, contracts: MOCK_CONTRACTS.v2, assets: MOCK_ASSETS.v2, serviceRecords: MOCK_SERVICE_RECORDS.v2, activity: MOCK_ACTIVITY.v2 },
  { id: 'v3', name: 'Span d.d.', types: ['reseller', 'service'], oib: '34567890123', phone: '+385 1 456 7890', website: 'www.span.hr', address: 'Koturaška 47, Zagreb, HR', assetCount: 67, spend: 71300, openWO: 0, reliability: 94, failureRate: 1.2, mttr: 2.1, repeatFailure: 4, warrantyHonored: 99, isArchived: false, contacts: MOCK_CONTACTS.v3, contracts: MOCK_CONTRACTS.v3, assets: MOCK_ASSETS.v3, serviceRecords: MOCK_SERVICE_RECORDS.v3, activity: MOCK_ACTIVITY.v3 },
  { id: 'v4', name: 'Lenovo HR d.o.o.', types: ['manufacturer', 'reseller'], oib: '45678901234', phone: '+385 1 567 8901', website: 'www.lenovo.hr', address: 'Radnička cesta 37, Zagreb, HR', assetCount: 0, spend: 0, openWO: 5, reliability: 78, failureRate: 5.4, mttr: 6.5, repeatFailure: 15, warrantyHonored: 89, isArchived: false, contacts: MOCK_CONTACTS.v4, contracts: MOCK_CONTRACTS.v4, assets: MOCK_ASSETS.v4, serviceRecords: MOCK_SERVICE_RECORDS.v4, activity: MOCK_ACTIVITY.v4 },
  { id: 'v5', name: 'GLS Croatia d.o.o.', types: ['carrier'], oib: '56789012345', phone: '+385 1 678 9012', website: 'www.gls-croatia.com', address: 'Jankomir 33, Zagreb, HR', assetCount: 0, spend: 4200, openWO: 0, reliability: null, failureRate: null, mttr: null, repeatFailure: null, warrantyHonored: null, isArchived: false, contacts: MOCK_CONTACTS.v5, contracts: MOCK_CONTRACTS.v5, assets: MOCK_ASSETS.v5, serviceRecords: MOCK_SERVICE_RECORDS.v5, activity: MOCK_ACTIVITY.v5 },
  { id: 'v6', name: 'DataNet d.o.o.', types: ['distributor'], oib: '67890123456', phone: '+385 1 789 0123', website: 'www.datanet.hr', address: 'Samoborska 145, Zagreb, HR', assetCount: 12, spend: 18500, openWO: 0, reliability: 76, failureRate: 5.9, mttr: 7.1, repeatFailure: 18, warrantyHonored: 85, isArchived: false, contacts: MOCK_CONTACTS.v6, contracts: MOCK_CONTRACTS.v6, assets: MOCK_ASSETS.v6, serviceRecords: MOCK_SERVICE_RECORDS.v6, activity: MOCK_ACTIVITY.v6 },
  { id: 'v7', name: 'HP Inc. Croatia', types: ['manufacturer'], oib: '78901234567', phone: '+385 1 890 1234', website: 'www.hp.com/hr', address: 'Radnička cesta 80, Zagreb, HR', assetCount: 0, spend: 0, openWO: 2, reliability: 82, failureRate: 4.1, mttr: 5.3, repeatFailure: 10, warrantyHonored: 93, isArchived: false, contacts: MOCK_CONTACTS.v7, contracts: MOCK_CONTRACTS.v7, assets: MOCK_ASSETS.v7, serviceRecords: MOCK_SERVICE_RECORDS.v7, activity: MOCK_ACTIVITY.v7 },
  { id: 'v8', name: 'Combis d.o.o.', types: ['reseller', 'service', 'distributor'], oib: '89012345678', phone: '+385 1 901 2345', website: 'www.combis.hr', address: 'Savska opatovina 36, Zagreb, HR', assetCount: 34, spend: 42100, openWO: 1, reliability: 88, failureRate: 2.8, mttr: 3.5, repeatFailure: 9, warrantyHonored: 95, isArchived: false, contacts: MOCK_CONTACTS.v8, contracts: MOCK_CONTRACTS.v8, assets: MOCK_ASSETS.v8, serviceRecords: MOCK_SERVICE_RECORDS.v8, activity: MOCK_ACTIVITY.v8 },
];

// ── Helper Components ───────────────────────────────────────────────────────

function ReliabilityBar({ score, size = 'md' }: { score: number | null; size?: 'sm' | 'md' | 'lg' }) {
  if (score === null) return <span className="text-slate-400 text-sm">—</span>;

  const color = score >= 90 ? 'bg-emerald-500' : score >= 80 ? 'bg-blue-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = score >= 90 ? 'text-emerald-700' : score >= 80 ? 'text-blue-700' : score >= 60 ? 'text-amber-700' : 'text-red-700';
  const h = size === 'lg' ? 'h-4' : size === 'md' ? 'h-2.5' : 'h-2';
  const w = size === 'lg' ? 'w-32' : size === 'md' ? 'w-24' : 'w-16';

  return (
    <div className="flex items-center gap-2">
      <div className={`${w} ${h} bg-slate-200 rounded-full overflow-hidden`}>
        <div className={`${h} ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-sm font-medium ${textColor}`}>{score}</span>
    </div>
  );
}

function TypeChip({ type }: { type: VendorType }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${VENDOR_TYPE_COLORS[type]}`}>
      {VENDOR_TYPE_LABELS[type]}
    </span>
  );
}

function TypeChips({ types, max = 2 }: { types: VendorType[]; max?: number }) {
  const shown = types.slice(0, max);
  const remaining = types.length - max;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {shown.map(t => <TypeChip key={t} type={t} />)}
      {remaining > 0 && (
        <span className="text-xs text-slate-500">+{remaining}</span>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: ContractStatus }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${CONTRACT_STATUS_COLORS[status]}`} />;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function ComparisonIndicator({ value, avg, lowerIsBetter = false }: { value: number; avg: number; lowerIsBetter?: boolean }) {
  const isBetter = lowerIsBetter ? value < avg : value > avg;
  return (
    <span className={`text-xs font-medium ${isBetter ? 'text-emerald-600' : 'text-red-600'}`}>
      {isBetter ? '+ better' : '- worse'}
    </span>
  );
}

// ── New Vendor Modal ────────────────────────────────────────────────────────

function NewVendorModal({ onClose, onCreate }: { onClose: () => void; onCreate: (vendor: Vendor) => void }) {
  const [name, setName] = useState('');
  const [types, setTypes] = useState<VendorType[]>([]);
  const [oib, setOib] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const toggleType = (t: VendorType) => {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleCreate = () => {
    if (!name.trim() || types.length === 0) return;
    const newVendor: Vendor = {
      id: `v${Date.now()}`,
      name: name.trim(),
      types,
      oib: oib.trim(),
      phone: phone.trim(),
      website: website.trim(),
      address: address.trim(),
      assetCount: 0,
      spend: 0,
      openWO: 0,
      reliability: null,
      failureRate: null,
      mttr: null,
      repeatFailure: null,
      warrantyHonored: null,
      isArchived: false,
      contacts: [],
      contracts: [],
      assets: [],
      serviceRecords: [],
      activity: [{ id: `act-${Date.now()}`, date: new Date().toISOString().split('T')[0], description: 'Vendor created' }],
    };
    onCreate(newVendor);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={modalRef} className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">New Vendor</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Company name"
              autoFocus
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Types *</label>
            <button
              onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {types.length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {types.map(t => <TypeChip key={t} type={t} />)}
                </div>
              ) : (
                <span className="text-slate-400">Select types...</span>
              )}
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            {typeDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg py-1">
                {ALL_VENDOR_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>{VENDOR_TYPE_LABELS[t]}</span>
                    {types.includes(t) && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">OIB / VAT ID</label>
            <input
              type="text"
              value={oib}
              onChange={e => setOib(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="12345678901"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+385 1 234 5678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
              <input
                type="text"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="www.example.hr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Street, City, Country"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || types.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Vendor
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Contract Detail Modal ───────────────────────────────────────────────────

function ContractDetailModal({ contract, onClose }: { contract: VendorContract; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const remaining = daysUntil(contract.validTo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">{contract.name}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase">Type</span>
              <p className="text-sm text-slate-900 mt-0.5">{CONTRACT_TYPE_LABELS[contract.type]}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase">Status</span>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusDot status={contract.status} />
                <span className="text-sm text-slate-900 capitalize">{contract.status}</span>
                {contract.status === 'expiring' && remaining > 0 && (
                  <span className="text-xs text-amber-600 font-medium">{remaining}d left</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase">Valid From</span>
              <p className="text-sm text-slate-900 mt-0.5">{formatDate(contract.validFrom)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase">Valid To</span>
              <p className="text-sm text-slate-900 mt-0.5">{formatDate(contract.validTo)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase">Value</span>
              <p className="text-sm text-slate-900 mt-0.5">{formatCurrency(contract.value)}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase">Currency</span>
              <p className="text-sm text-slate-900 mt-0.5">{contract.currency}</p>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-500 uppercase">Auto-Renew</span>
            <p className="text-sm text-slate-900 mt-0.5">{contract.autoRenew ? 'Yes' : 'No'}</p>
          </div>

          <div>
            <span className="text-xs font-medium text-slate-500 uppercase">Linked Assets</span>
            <p className="text-sm text-slate-900 mt-0.5">{contract.linkedAssets} assets</p>
          </div>

          {contract.notes && (
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase">Notes</span>
              <p className="text-sm text-slate-700 mt-0.5">{contract.notes}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vendor List Screen ──────────────────────────────────────────────────────

function VendorListScreen({
  vendors,
  onSelectVendor,
  onNewVendor,
}: {
  vendors: Vendor[];
  onSelectVendor: (id: string) => void;
  onNewVendor: () => void;
}) {
  const [listMode, setListMode] = useState<ListMode>('list');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<VendorType[]>([]);
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [contractDropdownOpen, setContractDropdownOpen] = useState(false);
  const [sortField, setSortField] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && search) {
        e.stopPropagation();
        setSearch('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [search]);

  const toggleTypeFilter = (t: VendorType) => {
    setTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const filtered = useMemo(() => {
    let result = vendors.filter(v => !v.isArchived);

    if (typeFilter.length > 0) {
      result = result.filter(v => v.types.some(t => typeFilter.includes(t)));
    }

    if (contractFilter !== 'all') {
      if (contractFilter === 'active') {
        result = result.filter(v => v.contracts.some(c => c.status === 'active'));
      } else if (contractFilter === 'expiring') {
        result = result.filter(v => v.contracts.some(c => c.status === 'expiring'));
      } else if (contractFilter === 'expired') {
        result = result.filter(v => v.contracts.some(c => c.status === 'expired'));
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.oib.includes(q) ||
        v.contacts.some(c => c.email.toLowerCase().includes(q))
      );
    }

    return result;
  }, [vendors, typeFilter, contractFilter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'assets': cmp = a.assetCount - b.assetCount; break;
        case 'spend': cmp = a.spend - b.spend; break;
        case 'wo': cmp = a.openWO - b.openWO; break;
        case 'reliability': cmp = (a.reliability ?? -1) - (b.reliability ?? -1); break;
        default: cmp = a.name.localeCompare(b.name);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortField, sortDir]);

  const matrixVendors = useMemo(() => {
    return filtered
      .filter(v => v.reliability !== null && v.serviceRecords.length >= 3)
      .sort((a, b) => (b.reliability ?? 0) - (a.reliability ?? 0));
  }, [filtered]);

  const totalSpend = filtered.reduce((s, v) => s + v.spend, 0);
  const activeContracts = filtered.reduce((s, v) => s + v.contracts.filter(c => c.status === 'active' || c.status === 'expiring').length, 0);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ field, children, className = '' }: { field: string; children: React.ReactNode; className?: string }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <ArrowUpDown className="w-3 h-3" />
        )}
      </div>
    </th>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
          <button
            onClick={onNewVendor}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Vendor
          </button>
        </div>
        <p className="text-sm text-slate-500">
          {filtered.length} vendor{filtered.length !== 1 ? 's' : ''} &middot; {formatCurrency(totalSpend)} total spend &middot; {activeContracts} active contract{activeContracts !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters toolbar */}
      <div className="px-6 pb-4 flex items-center gap-3 flex-wrap">
        {/* Type filter */}
        <div className="relative">
          <button
            onClick={() => { setTypeDropdownOpen(!typeDropdownOpen); setContractDropdownOpen(false); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-700">
              {typeFilter.length > 0 ? `Type (${typeFilter.length})` : 'Type'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {typeDropdownOpen && (
            <div className="absolute z-20 mt-1 w-48 bg-white border border-slate-200 rounded-md shadow-lg py-1">
              {ALL_VENDOR_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => toggleTypeFilter(t)}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <TypeChip type={t} />
                  </div>
                  {typeFilter.includes(t) && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
              {typeFilter.length > 0 && (
                <>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    onClick={() => { setTypeFilter([]); setTypeDropdownOpen(false); }}
                    className="w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50"
                  >
                    Clear filter
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Contract status filter */}
        <div className="relative">
          <button
            onClick={() => { setContractDropdownOpen(!contractDropdownOpen); setTypeDropdownOpen(false); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <span className="text-slate-700">
              {contractFilter !== 'all' ? `Contracts: ${contractFilter}` : 'Contract status'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {contractDropdownOpen && (
            <div className="absolute z-20 mt-1 w-48 bg-white border border-slate-200 rounded-md shadow-lg py-1">
              {['all', 'active', 'expiring', 'expired'].map(s => (
                <button
                  key={s}
                  onClick={() => { setContractFilter(s); setContractDropdownOpen(false); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center justify-between"
                >
                  <span className="capitalize">{s === 'all' ? 'All' : s === 'expiring' ? 'Expiring 90d' : s}</span>
                  {contractFilter === s && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, OIB, email..."
            className="w-full pl-9 pr-8 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center border border-slate-300 rounded-md overflow-hidden ml-auto">
          <button
            onClick={() => setListMode('list')}
            className={`px-3 py-1.5 text-sm font-medium ${listMode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
            title="List view"
          >
            <span className="font-mono text-xs">&#8801;</span> List
          </button>
          <button
            onClick={() => setListMode('matrix')}
            className={`px-3 py-1.5 text-sm font-medium border-l border-slate-300 ${listMode === 'matrix' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Reliability Matrix"
          >
            <BarChart3 className="w-3.5 h-3.5 inline mr-1" /> Matrix
          </button>
        </div>
      </div>

      {/* Click-away for dropdowns */}
      {(typeDropdownOpen || contractDropdownOpen) && (
        <div className="fixed inset-0 z-10" onClick={() => { setTypeDropdownOpen(false); setContractDropdownOpen(false); }} />
      )}

      {/* Active filter chips */}
      {(typeFilter.length > 0 || contractFilter !== 'all') && (
        <div className="px-6 pb-3 flex items-center gap-2 flex-wrap">
          {typeFilter.map(t => (
            <button
              key={t}
              onClick={() => toggleTypeFilter(t)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
            >
              {VENDOR_TYPE_LABELS[t]}
              <X className="w-3 h-3" />
            </button>
          ))}
          {contractFilter !== 'all' && (
            <button
              onClick={() => setContractFilter('all')}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
            >
              Contracts: {contractFilter}
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => { setTypeFilter([]); setContractFilter('all'); }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mb-4" />
            {vendors.length === 0 ? (
              <>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Add your first vendor</h3>
                <p className="text-sm text-slate-500 mb-4 max-w-md">
                  Track your equipment suppliers, service partners, and carriers. Full vendor management requires the vendors module to be enabled.
                </p>
                <button
                  onClick={onNewVendor}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Vendor
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No vendors match these filters</h3>
                <p className="text-sm text-slate-500 mb-4">Try adjusting your filters or search terms.</p>
                <button
                  onClick={() => { setTypeFilter([]); setContractFilter('all'); setSearch(''); }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : listMode === 'list' ? (
          /* ── List View ── */
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <SortHeader field="name" className="w-[28%]">Name</SortHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Types</th>
                  <SortHeader field="assets">Assets</SortHeader>
                  <SortHeader field="spend">Spend</SortHeader>
                  <SortHeader field="wo">Open WO</SortHeader>
                  <SortHeader field="reliability">Reliability</SortHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map(v => (
                  <tr
                    key={v.id}
                    onClick={() => onSelectVendor(v.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{v.name}</span>
                        {v.types.includes('manufacturer') && <span className="text-slate-400" title="Manufacturer">&#9881;</span>}
                        {v.types.includes('carrier') && <span className="text-slate-400" title="Carrier">&#128230;</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TypeChips types={v.types} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {v.assetCount > 0 ? v.assetCount : <span className="text-slate-400">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {v.spend > 0 ? formatCurrency(v.spend) : <span className="text-slate-400">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {v.openWO > 0 ? (
                        <span className="font-medium text-blue-600">{v.openWO}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ReliabilityBar score={v.reliability} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── Reliability Matrix View ── */
          matrixVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BarChart3 className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No reliability data available</h3>
              <p className="text-sm text-slate-500 max-w-md">
                Vendors need at least 3 closed work orders to appear in the Reliability Matrix.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[35%]">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Failure Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Avg MTTR</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixVendors.map(v => (
                    <tr
                      key={v.id}
                      onClick={() => onSelectVendor(v.id)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{v.name}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{v.failureRate}%</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{v.mttr}d</td>
                      <td className="px-4 py-3">
                        <ReliabilityBar score={v.reliability} size="lg" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Vendor Detail Screen ────────────────────────────────────────────────────

function VendorDetailScreen({
  vendor,
  onBack,
}: {
  vendor: Vendor;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<VendorContract | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedContract) {
          setSelectedContract(null);
        } else {
          onBack();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onBack, selectedContract]);

  const primaryContact = vendor.contacts.find(c => c.isPrimary);
  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'contacts', label: 'Contacts' },
    { id: 'contracts', label: 'Contracts' },
    { id: 'assets', label: 'Assets' },
    { id: 'reliability', label: 'Reliability' },
    { id: 'financials', label: 'Financials' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Sticky header */}
      <div className="px-6 pt-4 pb-0 border-b border-slate-200 bg-white sticky top-0 z-10">
        {/* Breadcrumb row */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span>Vendors</span>
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-slate-900 font-medium">{vendor.name}</span>
          </button>

          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50">
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
            <div className="relative">
              <button
                onClick={() => setActionsOpen(!actionsOpen)}
                className="p-1.5 text-slate-500 border border-slate-300 rounded-md hover:bg-slate-50"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {actionsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-52 bg-white border border-slate-200 rounded-md shadow-lg py-1">
                    <button className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700">
                      <FileText className="w-4 h-4 text-slate-400" />
                      Add contract
                    </button>
                    <button className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700">
                      <Users className="w-4 h-4 text-slate-400" />
                      Add contact
                    </button>
                    <button className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700">
                      <Package className="w-4 h-4 text-slate-400" />
                      View assets in list
                    </button>
                    <button className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700">
                      <FileText className="w-4 h-4 text-slate-400" />
                      Generate vendor report (PDF)
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button className="w-full px-3 py-2 text-sm text-left hover:bg-red-50 flex items-center gap-2 text-red-600">
                      <Archive className="w-4 h-4" />
                      Archive vendor
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Vendor name + types */}
        <div className="mb-2">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-slate-900">{vendor.name}</h1>
            <TypeChips types={vendor.types} max={5} />
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
            {vendor.oib && (
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                OIB {vendor.oib}
              </span>
            )}
            {vendor.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {vendor.phone}
              </span>
            )}
            {vendor.website && (
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                {vendor.website}
              </span>
            )}
            {primaryContact && (
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {primaryContact.firstName} {primaryContact.lastName} &mdash; {primaryContact.email}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && <OverviewTab vendor={vendor} onTabChange={setActiveTab} />}
        {activeTab === 'contacts' && <ContactsTab vendor={vendor} />}
        {activeTab === 'contracts' && <ContractsTab vendor={vendor} onSelectContract={setSelectedContract} />}
        {activeTab === 'assets' && <AssetsTab vendor={vendor} />}
        {activeTab === 'reliability' && <ReliabilityTab vendor={vendor} />}
        {activeTab === 'financials' && <FinancialsTab vendor={vendor} />}
      </div>

      {/* Contract detail modal */}
      {selectedContract && (
        <ContractDetailModal contract={selectedContract} onClose={() => setSelectedContract(null)} />
      )}
    </div>
  );
}

// ── Tab: Overview ───────────────────────────────────────────────────────────

function OverviewTab({ vendor, onTabChange }: { vendor: Vendor; onTabChange: (tab: DetailTab) => void }) {
  const primaryContact = vendor.contacts.find(c => c.isPrimary);
  const activeContracts = vendor.contracts.filter(c => c.status === 'active' || c.status === 'expiring');
  const expiringContracts = vendor.contracts.filter(c => c.status === 'expiring');

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Assets KPI */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Assets</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-1">{vendor.assetCount}</p>
          <p className="text-sm text-slate-500">{formatCurrency(vendor.spend)} spend</p>
          <button onClick={() => onTabChange('assets')} className="text-xs font-medium text-blue-600 hover:text-blue-700 mt-3 inline-flex items-center gap-1">
            View list <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Active Contracts KPI */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Active Contracts</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-1">{activeContracts.length}</p>
          {expiringContracts.length > 0 ? (
            <p className="text-sm text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {expiringContracts.length} expiring soon
            </p>
          ) : (
            <p className="text-sm text-slate-500">All contracts active</p>
          )}
          <button onClick={() => onTabChange('contracts')} className="text-xs font-medium text-blue-600 hover:text-blue-700 mt-3 inline-flex items-center gap-1">
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Reliability KPI */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Reliability</span>
          </div>
          {vendor.reliability !== null ? (
            <>
              <div className="mb-2">
                <ReliabilityBar score={vendor.reliability} size="lg" />
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span>Failure {vendor.failureRate}%</span>
                <span>MTTR {vendor.mttr}d</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Not enough data</p>
          )}
          <button onClick={() => onTabChange('reliability')} className="text-xs font-medium text-blue-600 hover:text-blue-700 mt-3 inline-flex items-center gap-1">
            View details <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Company info + Primary contact */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">Company Info</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex">
              <dt className="w-24 text-slate-500 shrink-0">Legal name</dt>
              <dd className="text-slate-900">{vendor.name}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-slate-500 shrink-0">OIB</dt>
              <dd className="text-slate-900 font-mono">{vendor.oib}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-slate-500 shrink-0">Address</dt>
              <dd className="text-slate-900">{vendor.address}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-slate-500 shrink-0">Website</dt>
              <dd className="text-blue-600">{vendor.website}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-slate-500 shrink-0">Types</dt>
              <dd><TypeChips types={vendor.types} max={5} /></dd>
            </div>
          </dl>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">Primary Contact</h3>
          {primaryContact ? (
            <div className="space-y-3 text-sm">
              <p className="text-slate-900 font-medium text-base">
                {primaryContact.firstName} {primaryContact.lastName}
              </p>
              <p className="text-slate-500">{primaryContact.position}</p>
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {primaryContact.email}
              </div>
              {primaryContact.phone && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {primaryContact.phone}
                </div>
              )}
              <button onClick={() => onTabChange('contacts')} className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                View all contacts <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No primary contact set</p>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">Recent Activity</h3>
        {vendor.activity.length > 0 ? (
          <div className="space-y-3">
            {vendor.activity.slice(0, 5).map(act => (
              <div key={act.id} className="flex items-start gap-3 text-sm">
                <span className="text-slate-400 shrink-0 w-24 font-mono text-xs pt-0.5">{act.date}</span>
                <span className="text-slate-700">{act.description}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No recent activity</p>
        )}
      </div>
    </div>
  );
}

// ── Tab: Contacts ───────────────────────────────────────────────────────────

function ContactsTab({ vendor }: { vendor: Vendor }) {
  const sortedContacts = useMemo(() => {
    return [...vendor.contacts].sort((a, b) => {
      if (a.isPrimary) return -1;
      if (b.isPrimary) return 1;
      return a.lastName.localeCompare(b.lastName);
    });
  }, [vendor.contacts]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-700">
          Contacts ({vendor.contacts.length})
        </h3>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
          <Plus className="w-3.5 h-3.5" />
          Add contact
        </button>
      </div>

      {sortedContacts.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No contacts yet — add one or skip this if you don't need it.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedContacts.map(contact => (
            <div key={contact.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600 shrink-0">
                    {contact.firstName[0]}{contact.lastName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      {contact.isPrimary && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                      <span className="font-medium text-slate-900">
                        {contact.firstName} {contact.lastName}
                      </span>
                      <span className="text-sm text-slate-500">{contact.position}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {contact.email}
                      </span>
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {contact.phone}
                        </span>
                      )}
                    </div>
                    {contact.notes && (
                      <p className="text-xs text-slate-500 mt-2">{contact.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!contact.isPrimary && (
                    <button className="p-1.5 text-slate-400 hover:text-amber-500 rounded" title="Set as primary">
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded" title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 text-slate-400 hover:text-red-500 rounded" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Contracts ──────────────────────────────────────────────────────────

function ContractsTab({ vendor, onSelectContract }: { vendor: Vendor; onSelectContract: (c: VendorContract) => void }) {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = vendor.contracts;
    if (typeFilter !== 'all') {
      result = result.filter(c => c.type === typeFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q));
    }
    return result;
  }, [vendor.contracts, typeFilter, statusFilter, search]);

  return (
    <div>
      {/* Sub-toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All types</option>
          {(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map(t => (
            <option key={t} value={t}>{CONTRACT_TYPE_LABELS[t]}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="expiring">Expiring 90d</option>
          <option value="expired">Expired</option>
          <option value="draft">Draft</option>
        </select>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contracts..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
          <Plus className="w-3.5 h-3.5" />
          New Contract
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-1">
            {vendor.contracts.length === 0
              ? 'No contracts yet — add one to start tracking SLAs, support periods, and framework agreements.'
              : 'No contracts match these filters.'
            }
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Valid Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-10">Doc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => {
                const remaining = daysUntil(c.validTo);
                return (
                  <tr
                    key={c.id}
                    onClick={() => onSelectContract(c)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{CONTRACT_TYPE_LABELS[c.type]}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <div>{formatDate(c.validFrom)}</div>
                      <div className="text-slate-400">to {formatDate(c.validTo)}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatCurrency(c.value)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusDot status={c.status} />
                        <span className="text-sm capitalize text-slate-700">{c.status}</span>
                        {c.status === 'expiring' && remaining > 0 && (
                          <span className="text-xs font-medium text-amber-600">{remaining}d left</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <FileText className="w-4 h-4 text-slate-400 hover:text-blue-600" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Assets ─────────────────────────────────────────────────────────────

function AssetsTab({ vendor }: { vendor: Vendor }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-700">
          Assets purchased from {vendor.name} ({vendor.assets.length})
        </h3>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50">
          <ExternalLink className="w-3.5 h-3.5" />
          Open in Asset list
        </button>
      </div>

      {vendor.assets.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No assets linked to this vendor.</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tag</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Model</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Purchased</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendor.assets.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-slate-900">{a.tag}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{a.model}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      a.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                      a.status === 'deployed' ? 'bg-emerald-100 text-emerald-700' :
                      a.status === 'in_service' ? 'bg-amber-100 text-amber-700' :
                      a.status === 'in_stock' ? 'bg-slate-100 text-slate-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {a.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {a.assignedTo || <span className="text-slate-400">&mdash;</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(a.purchasedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Reliability ────────────────────────────────────────────────────────

function ReliabilityTab({ vendor }: { vendor: Vendor }) {
  const hasEnoughData = vendor.reliability !== null && vendor.serviceRecords.length >= 3;

  if (!hasEnoughData) {
    return (
      <div className="text-center py-16">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">Not enough service history</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          At least 3 closed work orders are needed to calculate a reliability score. This vendor currently has {vendor.serviceRecords.length} service record{vendor.serviceRecords.length !== 1 ? 's' : ''}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score breakdown */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">Reliability Score</h3>
        <div className="mb-6">
          <ReliabilityBar score={vendor.reliability} size="lg" />
          <span className="text-sm text-slate-500 ml-2">/ 100</span>
        </div>
        <div className="grid grid-cols-2 gap-y-4 gap-x-8">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-600">Failure rate</span>
              <span className="text-sm font-medium text-slate-900 ml-2">{vendor.failureRate}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">(avg {INDUSTRY_AVG.failureRate}%)</span>
              <ComparisonIndicator value={vendor.failureRate!} avg={INDUSTRY_AVG.failureRate} lowerIsBetter />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-600">Avg MTTR</span>
              <span className="text-sm font-medium text-slate-900 ml-2">{vendor.mttr}d</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">(avg {INDUSTRY_AVG.mttr}d)</span>
              <ComparisonIndicator value={vendor.mttr!} avg={INDUSTRY_AVG.mttr} lowerIsBetter />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-600">Repeat failures</span>
              <span className="text-sm font-medium text-slate-900 ml-2">{vendor.repeatFailure}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">(avg {INDUSTRY_AVG.repeatFailure}%)</span>
              <ComparisonIndicator value={vendor.repeatFailure!} avg={INDUSTRY_AVG.repeatFailure} lowerIsBetter />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-600">Warranty honored</span>
              <span className="text-sm font-medium text-slate-900 ml-2">{vendor.warrantyHonored}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">(avg {INDUSTRY_AVG.warrantyHonored}%)</span>
              <ComparisonIndicator value={vendor.warrantyHonored!} avg={INDUSTRY_AVG.warrantyHonored} />
            </div>
          </div>
        </div>
      </div>

      {/* Service history chart placeholder */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">Service History (Last 12 Months)</h3>
        <div className="h-48 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <div className="text-center">
            <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Line chart placeholder — WO opened vs. closed per month</p>
            <p className="text-xs text-slate-300 mt-1">Chart will render when Recharts is available</p>
          </div>
        </div>
      </div>

      {/* Recent service records */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">
          Recent Service Records ({vendor.serviceRecords.length})
        </h3>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">WO #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Asset</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Issue</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendor.serviceRecords.map(sr => (
                <tr key={sr.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(sr.date)}</td>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">{sr.woNumber}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-700">{sr.assetTag}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{sr.issue}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{sr.durationDays} day{sr.durationDays !== 1 ? 's' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Financials ─────────────────────────────────────────────────────────

function FinancialsTab({ vendor }: { vendor: Vendor }) {
  const activeContractsTotal = vendor.contracts
    .filter(c => c.status === 'active' || c.status === 'expiring')
    .reduce((s, c) => s + c.value, 0);

  const avgCostPerAsset = vendor.assetCount > 0 ? Math.round(vendor.spend / vendor.assetCount) : 0;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Total Spend</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(vendor.spend)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Active Contracts Value</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(activeContractsTotal)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Avg Cost per Asset</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {vendor.assetCount > 0 ? formatCurrency(avgCostPerAsset) : <span className="text-slate-400">&mdash;</span>}
          </p>
        </div>
      </div>

      {/* Annual spend chart placeholder */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">Annual Spend</h3>
        <div className="h-56 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <div className="text-center">
            <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Bar chart placeholder — Annual spend 2022-2026</p>
            <p className="text-xs text-slate-300 mt-1">Chart will render when Recharts is available</p>
          </div>
        </div>
      </div>

      {/* Spend by category chart placeholder */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">Spend by Category</h3>
        <div className="h-48 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <div className="text-center">
            <DollarSign className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Donut chart placeholder — Spend breakdown by asset category</p>
            <p className="text-xs text-slate-300 mt-1">Chart will render when Recharts is available</p>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            In production, this tab is only visible to users with <code className="bg-amber-100 px-1 rounded text-xs">asset_costs:read</code> permission. Users without this permission will not see the Financials tab.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function VendorsView() {
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    apiFetch<{ items: any[] }>('/vendors/?limit=100')
      .then(resp => {
        if (resp.items?.length > 0) {
          setVendors(resp.items.map((v: any) => ({
            id: v.id,
            name: v.name ?? '',
            types: v.types ?? [],
            oib: v.oib ?? '',
            phone: v.phone ?? '',
            website: v.website ?? '',
            address: v.address ?? '',
            assetCount: v.asset_count ?? 0,
            spend: v.spend ?? 0,
            openWO: v.open_wo ?? 0,
            reliability: v.reliability ?? null,
            failureRate: v.failure_rate ?? null,
            mttr: v.mttr ?? null,
            repeatFailure: v.repeat_failure ?? null,
            warrantyHonored: v.warranty_honored ?? null,
            isArchived: v.is_archived ?? false,
            contacts: v.contacts ?? [],
            contracts: v.contracts ?? [],
            assets: v.assets ?? [],
            serviceRecords: v.service_records ?? [],
            activity: v.activity ?? [],
          })));
        }
      })
      .catch(() => {});
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [showNewVendorModal, setShowNewVendorModal] = useState(false);

  const selectedVendor = useMemo(() => {
    return vendors.find(v => v.id === selectedVendorId) ?? null;
  }, [vendors, selectedVendorId]);

  const handleSelectVendor = useCallback((id: string) => {
    setSelectedVendorId(id);
    setViewMode('detail');
  }, []);

  const handleBackToList = useCallback(() => {
    setViewMode('list');
    setSelectedVendorId(null);
  }, []);

  const handleCreateVendor = useCallback((vendor: Vendor) => {
    setVendors(prev => [...prev, vendor]);
    setShowNewVendorModal(false);
    setSelectedVendorId(vendor.id);
    setViewMode('detail');
  }, []);

  if (viewMode === 'detail' && selectedVendor) {
    return (
      <VendorDetailScreen
        vendor={selectedVendor}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <>
      <VendorListScreen
        vendors={vendors}
        onSelectVendor={handleSelectVendor}
        onNewVendor={() => setShowNewVendorModal(true)}
      />
      {showNewVendorModal && (
        <NewVendorModal
          onClose={() => setShowNewVendorModal(false)}
          onCreate={handleCreateVendor}
        />
      )}
    </>
  );
}

export default VendorsView;
