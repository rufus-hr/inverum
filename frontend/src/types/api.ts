// ─── Backend response types ───────────────────────────────────────────────────

export interface CursorPagedResponse<T> {
  items: T[];
  next_cursor: string | null;
  limit: number;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Asset ─────────────────────────────────────────────────────────────────────

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

export interface AssetResponse {
  id: string;
  tenant_id: string;
  organization_id: string;
  name: string | null;
  inventory_number: string | null;
  serial_number: string | null;
  status: AssetStatus;
  mobility_type: string;
  legal_entity_id: string | null;
  location_id: string | null;
  category_id: string | null;
  configuration_id: string | null;
  vendor_id: string | null;
  classification_level_id: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  purchase_currency: string | null;
  notes: string | null;
  custom_fields: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AssetCreatePayload {
  organization_id: string;
  name?: string;
  serial_number?: string;
  status?: string;
  mobility_type?: string;
  legal_entity_id?: string;
  location_id?: string;
  category_id?: string;
  vendor_id?: string;
  purchase_date?: string;
  purchase_cost?: number;
  purchase_currency?: string;
  notes?: string;
  custom_fields?: Record<string, any>;
}

export interface AssetUpdatePayload extends Partial<AssetCreatePayload> {}

// ─── Organization ──────────────────────────────────────────────────────────────

export interface OrganizationResponse {
  id: string;
  tenant_id: string;
  name: string;
  legal_entity_id: string | null;
  parent_id: string | null;
  location_count?: number;
  employee_count?: number;
  created_at: string;
}

// ─── Location ──────────────────────────────────────────────────────────────────

export interface LocationResponse {
  id: string;
  tenant_id: string;
  organization_id: string | null;
  parent_id: string | null;
  name: string;
  created_at: string;
}

// ─── Employee ──────────────────────────────────────────────────────────────────

export interface EmployeeResponse {
  id: string;
  tenant_id: string;
  organization_id: string | null;
  department_id: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  department_name?: string;
  department?: string;
  created_at: string;
}

// ─── Asset Category ────────────────────────────────────────────────────────────

export interface AssetCategoryResponse {
  id: string;
  tenant_id: string;
  name: string;
  parent_id: string | null;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginPayload {
  tenant_slug: string;
  provider: string;
  provider_id: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ─── Tenant ────────────────────────────────────────────────────────────────────

export interface TenantModules {
  vendors: boolean;
  supplies: boolean;
  storage: boolean;
  maintenance: boolean;
  checklists: boolean;
  advanced_permissions: boolean;
}

export interface TenantSettings {
  currency: string;
  timezone: string;
  date_format: string;
  language: string;
}

export interface TenantConfig {
  tenant_id: string;
  name: string;
  slug: string;
  modules: TenantModules;
  settings: TenantSettings;
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_assets: number;
  assets_by_status: Record<string, number>;
  assets_by_type: Record<string, number>;
  recent_activity: Array<{
    id: string;
    action: string;
    actor_type?: string;
    entity_type: string;
    entity_id: string;
    created_at: string;
  }>;
}
