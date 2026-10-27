const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _onUnauthorized: (() => void) | null = null;

export function setTokens(access: string, refresh: string) {
  _accessToken = access;
  _refreshToken = refresh;
  localStorage.setItem('refresh_token', refresh);
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  localStorage.removeItem('refresh_token');
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem('refresh_token');
}

export function saveLastTenantSlug(slug: string) {
  localStorage.setItem('last_tenant_slug', slug);
}

export function getLastTenantSlug(): string {
  return localStorage.getItem('last_tenant_slug') ?? (import.meta.env.VITE_TENANT_SLUG as string);
}

export function onUnauthorized(cb: () => void) {
  _onUnauthorized = cb;
}

async function refreshAccessToken(): Promise<boolean> {
  const rt = _refreshToken ?? getStoredRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const ok = await refreshAccessToken();
    if (ok) return apiFetch<T>(path, options, false);
    clearTokens();
    _onUnauthorized?.();
    throw new ApiError(401, 'Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.detail ?? 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

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

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.detail ?? 'Login failed');
  }
  return res.json();
}

export async function uploadFile<T = any>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (res.status === 401) {
    const ok = await refreshAccessToken();
    if (ok) return uploadFile<T>(path, file);
    clearTokens();
    _onUnauthorized?.();
    throw new ApiError(401, 'Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.detail ?? 'Upload failed');
  }

  return res.json() as Promise<T>;
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
  clearTokens();
}

// ---------------------------------------------------------------------------
// Tenant config
// ---------------------------------------------------------------------------

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

export async function fetchTenantConfig(): Promise<TenantConfig> {
  return apiFetch<TenantConfig>('/tenants/config');
}

export async function updateTenantModules(
  patch: Partial<TenantModules>
): Promise<TenantConfig> {
  return apiFetch<TenantConfig>('/tenants/config/modules', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}
