// ─── UI types (used by mock components) ────────────────────────────────────────

export type AssetStatus =
  | 'active'
  | 'in_stock'
  | 'in_service'
  | 'pending'
  | 'retired'
  | 'scrapped'
  | 'stolen'
  | 'lost'
  | 'loaned'
  | 'Active'
  | 'Storage'
  | 'Pending Checklist'
  | 'In Repair'
  | 'Retired';

export interface Asset {
  id: string;
  inventoryNumber: string;
  type: string;
  name: string;
  assignee: string;
  status: AssetStatus;
  orgId: string;
  locId: string;
  mobility_type: string;
  pending_sop?: string;
  sop_description?: string;
  sop_assignee?: string;
  imageUrl?: string;
  custom_fields?: Record<string, string>;
  serial_number?: string;
  vendor_id?: string;
  purchase_date?: string;
  purchase_cost?: string;
}

export interface TreeNodeData {
  id: string;
  label: string;
  children?: TreeNodeData[];
  assignedTo?: string;
  isOpenSpace?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  department: string;
  email: string;
  phone: string;
  pebcak_score: number;
  internal_tags: string[];
}

export interface AuditLogEntry {
  id: string;
  date: string;
  action: string;
  user: string;
  details: string;
}

export type ActivePanel = 'edit' | 'history' | 'details' | null;

// ─── Re-export API types ───────────────────────────────────────────────────────

export type {
  CursorPagedResponse,
  PagedResponse,
  AssetResponse,
  AssetCreatePayload,
  AssetUpdatePayload,
  OrganizationResponse,
  LocationResponse,
  EmployeeResponse,
  AssetCategoryResponse,
  LoginPayload,
  TokenResponse,
  TenantModules,
  TenantSettings,
  TenantConfig,
  DashboardStats,
} from './api';
