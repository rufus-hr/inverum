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
  storage_unit_id?: string | null;
  box_id?: string | null;
  security_level?: number;
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
  location_id?: string | null;
  storage_unit_id?: string | null;
  box_id?: string | null;
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

// ─── Employee & Assignment ───────────────────────────────────────────────────

export interface DepartmentResponse {
  id: string;
  tenant_id: string;
  organization_id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface EmployeeResponse {
  id: string;
  tenant_id: string;
  organization_id: string | null;
  legal_entity_id?: string | null;
  department_id: string | null;
  default_location_id?: string | null;
  first_name: string | null;
  last_name: string | null;
  name?: string | null;
  email: string | null;
  phone: string | null;
  employee_number?: string | null;
  job_title?: string | null;
  employment_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  pebcak_score?: number;
  internal_tags?: string[] | null;
  department_name?: string;
  department?: string;
  created_at: string;
  updated_at?: string;
}

export interface AssetAssignmentResponse {
  id: string;
  tenant_id: string;
  asset_id: string;
  assigned_to_type: 'employee' | 'user' | 'workplace' | 'location' | 'stock' | 'department' | string;
  assigned_to_id: string | null;
  assigned_by: string;
  assigned_at: string;
  returned_at: string | null;
  returned_by: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AssetAssignCreatePayload {
  asset_id: string;
  assigned_to_type: 'employee' | 'user' | 'workplace' | 'location' | 'stock' | 'department';
  assigned_to_id?: string | null;
  notes?: string | null;
}

// ─── Box & Storage Unit ──────────────────────────────────────────────────────

export interface BoxResponse {
  id: string;
  tenant_id: string;
  inventory_number: string;
  location_id: string | null;
  storage_unit_id: string | null;
  parent_box_id: string | null;
  status: 'open' | 'sealed' | 'in_transit';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoxCreatePayload {
  inventory_number: string;
  location_id?: string | null;
  storage_unit_id?: string | null;
  parent_box_id?: string | null;
  status?: string;
  notes?: string | null;
}

export interface BoxModifyPayload extends Partial<BoxCreatePayload> {}

export interface StorageUnitResponse {
  id: string;
  tenant_id: string;
  name: string;
  type: 'rack' | 'cabinet' | 'safe' | 'cage' | 'shelf' | 'drawer' | string;
  location_id: string;
  parent_storage_unit_id: string | null;
  is_lockable: boolean;
  security_level: number;
  capacity: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorageUnitCreatePayload {
  name: string;
  type: string;
  location_id: string;
  parent_storage_unit_id?: string | null;
  is_lockable?: boolean;
  security_level?: number;
  capacity?: number | null;
  notes?: string | null;
}

// ─── Supply & Stock ──────────────────────────────────────────────────────────

export interface SupplyResponse {
  id: string;
  tenant_id: string;
  name: string;
  supply_type: 'consumable' | 'stock_item' | 'accessory';
  part_number: string | null;
  category: string | null;
  unit: string;
  compatible_with: string | null;
  unit_price: number | string | null;
  currency: string | null;
  vendor_id: string | null;
  manufacturer_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplyCreatePayload {
  name: string;
  supply_type: 'consumable' | 'stock_item' | 'accessory';
  part_number?: string | null;
  category?: string | null;
  unit?: string;
  compatible_with?: string | null;
  unit_price?: number | null;
  currency?: string | null;
  vendor_id?: string | null;
  manufacturer_id?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface StockInstanceResponse {
  id: string;
  tenant_id: string;
  supply_id: string;
  entity_type: 'consumable' | 'stock_item' | 'accessory';
  location_id: string | null;
  storage_unit_id: string | null;
  box_id: string | null;
  quantity: number;
  minimum_quantity: number;
  notes: string | null;
  linked_asset_id: string | null;
  linked_user_id: string | null;
  is_active: boolean;
  below_minimum: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockInstanceCreatePayload {
  supply_id: string;
  entity_type: 'consumable' | 'stock_item' | 'accessory';
  location_id?: string | null;
  storage_unit_id?: string | null;
  box_id?: string | null;
  quantity: number;
  minimum_quantity?: number;
  notes?: string | null;
}

export interface StockMovementCreatePayload {
  supply_id: string;
  entity_type: 'consumable' | 'stock_item' | 'accessory';
  entity_id: string;
  location_id?: string | null;
  storage_unit_id?: string | null;
  box_id?: string | null;
  quantity: number;
  reason: 'purchase' | 'usage' | 'transfer' | 'adjustment' | 'wasted';
  external_ref?: string | null;
  notes?: string | null;
}

export interface StockMovementResponse extends StockMovementCreatePayload {
  id: string;
  tenant_id: string;
  actor_id: string | null;
  work_order_id: string | null;
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
