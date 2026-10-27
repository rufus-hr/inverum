import React, { useState, useEffect, useContext } from 'react';
import {
  Plus, Trash2, Check, X, Link2, ChevronRight, RotateCcw,
  UserCheck, ArrowDownToLine, CheckCircle2, RefreshCw,
  Shuffle, UserX, Lock, KeyRound, Server, Globe,
} from 'lucide-react';
import {
  SettingsContext, TenantConfigData, apiFetch,
  SectionHeader, SettingRow, OrgSettingRow, Toggle,
  Input, Select, Badge, SaveBar, LogoUpload,
} from './SettingsShared';
import { useApiQuery } from '../../hooks/useApi';
import type { PagedResponse } from '../../types/api';

// ---------------------------------------------------------------------------
// General Org Tab
// ---------------------------------------------------------------------------

export function GeneralOrgTab() {
  const { selectedOrg, tenantConfig, refreshOrgs } = useContext(SettingsContext);
  const [friendlyName, setFriendlyName] = useState(selectedOrg.name);
  const [orgType, setOrgType] = useState('Legal entity');
  const [parent, setParent] = useState(tenantConfig?.name || '— none —');
  const [contact, setContact] = useState('');
  const [description, setDescription] = useState(selectedOrg.description || '');

  useEffect(() => {
    setFriendlyName(selectedOrg.name);
    setDescription(selectedOrg.description || '');
    if (tenantConfig?.name) setParent(tenantConfig.name);
  }, [selectedOrg, tenantConfig?.name]);

  return (
    <div className="max-w-2xl">
      <SectionHeader title="Organization Identity" description="Branding and display settings for this organization" />
      <SettingRow label="Friendly Name" description="Short display name used in the UI. Different from legal name.">
        <Input value={friendlyName} onChange={setFriendlyName} className="w-56" />
      </SettingRow>
      <SettingRow label="Logo (rectangular)" description="SVG or high-res PNG, min 600px wide for 300dpi print quality.">
        <LogoUpload aspect="rect" />
      </SettingRow>
      <SettingRow label="Logo (square)" description="Used as org icon in lists and selectors. 64×64px, SVG preferred.">
        <LogoUpload aspect="square" />
      </SettingRow>
      <div className="mt-8"><SectionHeader title="Organization Details" /></div>
      <SettingRow label="Organization Type">
        <Select value={orgType} onChange={setOrgType} options={['Legal entity', 'Division', 'Branch', 'Department', 'Subsidiary']} className="w-44" />
      </SettingRow>
      <SettingRow label="Parent Organization" description="Leave empty if top-level">
        <Select value={parent} onChange={setParent} options={['— none —', ...(tenantConfig?.name ? [tenantConfig.name] : [])]} className="w-52" />
      </SettingRow>
      <SettingRow label="Primary Contact / Manager">
        <Input value={contact} onChange={setContact} className="w-44" />
      </SettingRow>
      <SettingRow label="Description" description="Internal note, not shown to end users">
        <Input value={description} onChange={setDescription} className="w-56" />
      </SettingRow>
      <SaveBar onSave={() => {
        if (selectedOrg.isTenant) return;
        apiFetch(`/organizations/${selectedOrg.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: friendlyName.trim() || selectedOrg.name,
            description: description.trim() || null,
          }),
        }).then(() => refreshOrgs()).catch(() => {});
      }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// General Tab
// ---------------------------------------------------------------------------

interface SystemLicenseStatus {
  is_licensed: boolean;
  has_license_key: boolean;
  signature_valid: boolean;
  is_expired: boolean;
  tier: string;
  customer: string;
  license_id: string | null;
  active_employees_count: number;
  max_employees: number;
  utilization_pct: number;
  issued_at: string | null;
  expires_at: string | null;
  banner_required: boolean;
  banner_reason: string | null;
}

export function GeneralTab() {
  const { tenantConfig, setTenantConfig, refreshOrgs } = useContext(SettingsContext);
  const s = tenantConfig?.settings;
  const [tenantName, setTenantName] = useState('');
  const [country, setCountry] = useState('Croatia');
  const [currency, setCurrency] = useState('EUR — Euro');
  const [timezone, setTimezone] = useState('Europe/Zagreb');
  const [language, setLanguage] = useState('English');
  const [dateFormat, setDateFormat] = useState('DD.MM.YYYY');
  const [decimal, setDecimal] = useState(', (comma)');
  const [csvSeparator, setCsvSeparator] = useState('; (semicolon)');

  const [licenseStatus, setLicenseStatus] = useState<SystemLicenseStatus | null>(null);
  const [licenseInput, setLicenseInput] = useState('');
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseSuccess, setLicenseSuccess] = useState<string | null>(null);
  const [savingLicense, setSavingLicense] = useState(false);

  useEffect(() => {
    apiFetch<SystemLicenseStatus>('/system/license-status')
      .then(setLicenseStatus)
      .catch(() => {});
  }, []);

  const handleActivateLicense = async () => {
    setLicenseError(null);
    setLicenseSuccess(null);
    setSavingLicense(true);
    try {
      const updated = await apiFetch<SystemLicenseStatus>('/system/license', {
        method: 'PUT',
        body: JSON.stringify({ license_key: licenseInput.trim() }),
      });
      setLicenseStatus(updated);
      setLicenseInput('');
      setLicenseSuccess(updated.has_license_key ? 'Ed25519 offline license verified and activated.' : 'Reverted to Community Free Tier.');
      window.dispatchEvent(new Event('inverum-license-updated'));
    } catch (err) {
      setLicenseError(err instanceof Error ? err.message : 'Cryptographic Ed25519 signature verification failed.');
    } finally {
      setSavingLicense(false);
    }
  };

  useEffect(() => {
    if (!tenantConfig) return;
    setTenantName(tenantConfig.name);
    if (s?.country) setCountry(s.country);
    if (s?.currency) setCurrency(s.currency === 'EUR' ? 'EUR — Euro' : s.currency === 'USD' ? 'USD — Dollar' : s.currency === 'GBP' ? 'GBP — Pound' : s.currency);
    if (s?.timezone) setTimezone(s.timezone);
    if (s?.language) setLanguage(s.language === 'hr' ? 'Hrvatski' : s.language === 'de' ? 'Deutsch' : s.language === 'sl' ? 'Slovenščina' : 'English');
    if (s?.date_format) setDateFormat(s.date_format);
    if (s?.decimal_separator) setDecimal(s.decimal_separator);
    if (s?.csv_separator) setCsvSeparator(s.csv_separator);
  }, [tenantConfig, s]);

  return (
    <div className="max-w-2xl">
      <SectionHeader title="Branding" description="How your organization appears in the system" />
      <SettingRow label="Tenant Name" description="Displayed in the top navigation bar">
        <Input value={tenantName} onChange={setTenantName} className="w-56" />
      </SettingRow>
      <SettingRow label="Logo (rectangular)" description="SVG or high-res PNG, min 600px wide for 300dpi print quality.">
        <LogoUpload aspect="rect" />
      </SettingRow>
      <SettingRow label="Logo (square)" description="Favicon, mobile icon, org selector. 64×64px, SVG preferred.">
        <LogoUpload aspect="square" />
      </SettingRow>
      <div className="mt-8 mb-6"><SectionHeader title="Regional" description="Affects all date, number and currency displays" /></div>
      <SettingRow label="Country"><Select value={country} onChange={setCountry} options={['Croatia', 'Germany', 'Austria', 'Slovenia', 'Serbia']} className="w-40" /></SettingRow>
      <SettingRow label="Currency"><Select value={currency} onChange={setCurrency} options={['EUR — Euro', 'USD — Dollar', 'HRK — Kuna (legacy)', 'GBP — Pound']} className="w-44" /></SettingRow>
      <SettingRow label="Timezone"><Select value={timezone} onChange={setTimezone} options={['Europe/Zagreb', 'Europe/Berlin', 'UTC', 'America/New_York']} className="w-44" /></SettingRow>
      <SettingRow label="Language" description="Default UI language for new users"><Select value={language} onChange={setLanguage} options={['English', 'Hrvatski', 'Deutsch', 'Slovenščina']} className="w-40" /></SettingRow>
      <SettingRow label="Date Format"><Select value={dateFormat} onChange={setDateFormat} options={['DD.MM.YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']} className="w-40" /></SettingRow>
      <SettingRow label="Decimal Separator"><Select value={decimal} onChange={setDecimal} options={[', (comma)', '. (dot)']} className="w-36" /></SettingRow>
      <SettingRow label="CSV Separator" description="Used in all CSV exports and expected on import"><Select value={csvSeparator} onChange={setCsvSeparator} options={['; (semicolon)', ', (comma)', '\t (tab)']} className="w-40" /></SettingRow>

      {/* Offline Enterprise License (Ed25519) */}
      <div className="mt-8 mb-6">
        <SectionHeader
          title="Fair-Use Offline Enterprise License (Ed25519)"
          description="100% air-gapped Ed25519 RFC 8032 signature verification across all active employee seats. Zero telemetry, zero feature lockouts."
        />
      </div>
      {licenseStatus && (
        <div className="mb-6 p-4 rounded-lg border border-theme-border bg-theme-surface space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound size={15} className="text-theme-primary" />
              <span className="text-theme-sm font-semibold text-theme-text">{licenseStatus.customer}</span>
              <Badge color={licenseStatus.banner_required ? 'amber' : 'green'}>
                {licenseStatus.tier.toUpperCase()}
              </Badge>
              {licenseStatus.signature_valid && (
                <Badge color="blue">Ed25519 Verified</Badge>
              )}
            </div>
            <span className="text-theme-xs font-mono text-theme-text-muted">
              Active Seats: <strong className="text-theme-text">{licenseStatus.active_employees_count}</strong> / {licenseStatus.max_employees} ({licenseStatus.utilization_pct}%)
            </span>
          </div>

          <div className="w-full h-1.5 bg-theme-bg rounded-full overflow-hidden border border-theme-border">
            <div
              className={`h-full transition-all ${licenseStatus.banner_required ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(licenseStatus.utilization_pct, 100)}%` }}
            />
          </div>

          {licenseStatus.expires_at && (
            <div className="flex items-center justify-between text-[11px] text-theme-text-subtle">
              <span>License ID: <span className="font-mono">{licenseStatus.license_id}</span></span>
              <span>Valid until: <span className="font-mono">{licenseStatus.expires_at.slice(0, 10)}</span></span>
            </div>
          )}

          {licenseStatus.banner_reason && (
            <p className="text-theme-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-1.5">
              {licenseStatus.banner_reason}
            </p>
          )}

          <div className="pt-2 border-t border-theme-border space-y-2">
            <label className="block text-theme-xs text-theme-text-muted">
              Paste Offline License Key (<code className="font-mono text-[11px]">INV-ENT-...</code>)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={licenseInput}
                onChange={e => setLicenseInput(e.target.value)}
                placeholder="INV-ENT-eyJjdXN0b21lciI6..."
                className="flex-1 text-theme-xs font-mono bg-theme-bg border border-theme-border rounded px-3 py-1.5 text-theme-text focus:outline-none focus:border-theme-primary"
              />
              <button
                type="button"
                onClick={handleActivateLicense}
                disabled={savingLicense}
                className="px-3 py-1.5 text-theme-xs font-medium bg-theme-primary text-theme-primary-fg rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {savingLicense ? 'Verifying…' : licenseInput.trim() ? 'Verify & Activate' : 'Reset to Community'}
              </button>
            </div>
            {licenseError && <p className="text-theme-xs text-red-400">{licenseError}</p>}
            {licenseSuccess && <p className="text-theme-xs text-emerald-400">{licenseSuccess}</p>}
          </div>
        </div>
      )}

      <SaveBar onSave={() => {
        const langMap: Record<string, string> = { 'English': 'en', 'Hrvatski': 'hr', 'Deutsch': 'de', 'Slovenščina': 'sl' };
        const curMap: Record<string, string> = { 'EUR — Euro': 'EUR', 'USD — Dollar': 'USD', 'HRK — Kuna (legacy)': 'HRK', 'GBP — Pound': 'GBP' };
        apiFetch<TenantConfigData>('/tenants/config/settings', {
          method: 'PATCH',
          body: JSON.stringify({
            tenant_name: tenantName.trim() || undefined,
            country,
            currency: curMap[currency] ?? currency,
            timezone,
            date_format: dateFormat,
            language: langMap[language] ?? language,
            decimal_separator: decimal,
            csv_separator: csvSeparator,
          }),
        }).then((cfg) => {
          setTenantConfig(cfg);
          refreshOrgs();
        }).catch(() => {});
      }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legal Tab — identifiers fully editable & wired to /legal-entities/
// ---------------------------------------------------------------------------

interface LegalId { id: string; label: string; value: string; }

interface ApiLegalEntity {
  id: string;
  legal_name: string;
  country_code?: string | null;
  identifiers?: Record<string, string>;
  address?: string | null;
  iban?: string | null;
  responsible_person?: string | null;
  contact_email?: string | null;
}

export function LegalTab() {
  const { tenantConfig } = useContext(SettingsContext);
  const { data: legalData, refetch: refetchLegal } = useApiQuery<PagedResponse<ApiLegalEntity> | ApiLegalEntity[]>('/legal-entities/?limit=50');
  const [entityId, setEntityId] = useState<string | null>(null);
  const [legalName, setLegalName] = useState(tenantConfig?.name || '');
  const [country, setCountry] = useState('Croatia (HR)');
  const [address, setAddress] = useState('');
  const [iban, setIban] = useState('');
  const [responsible, setResponsible] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [identifiers, setIdentifiers] = useState<LegalId[]>([
    { id: '1', label: 'OIB', value: '' },
    { id: '2', label: 'VAT Number', value: '' },
  ]);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    const list = Array.isArray(legalData) ? legalData : legalData?.items;
    const first = list?.[0];
    if (!first) {
      if (tenantConfig?.name && !legalName) setLegalName(tenantConfig.name);
      return;
    }
    setEntityId(first.id);
    if (first.legal_name) setLegalName(first.legal_name);
    if (first.address) setAddress(first.address);
    if (first.iban) setIban(first.iban);
    if (first.responsible_person) setResponsible(first.responsible_person);
    if (first.contact_email) setContactEmail(first.contact_email);
    if (first.identifiers && Object.keys(first.identifiers).length > 0) {
      setIdentifiers(Object.entries(first.identifiers).map(([k, v], idx) => ({
        id: String(idx + 1),
        label: k,
        value: String(v),
      })));
    }
  }, [legalData, tenantConfig?.name, legalName]);

  const addId = () => {
    if (!newLabel.trim()) return;
    setIdentifiers(p => [...p, { id: Date.now().toString(), label: newLabel.trim(), value: newValue.trim() }]);
    setNewLabel(''); setNewValue(''); setAdding(false);
  };

  const updateId = (id: string, field: 'label' | 'value', val: string) =>
    setIdentifiers(p => p.map(i => i.id === id ? { ...i, [field]: val } : i));

  const removeId = (id: string) => setIdentifiers(p => p.filter(i => i.id !== id));

  return (
    <div className="max-w-2xl">
      <SectionHeader title="Legal Entity" description="Used on shipping labels, PDF exports, and official documents" />
      <SettingRow label="Legal Name"><Input value={legalName} onChange={setLegalName} className="w-64" /></SettingRow>
      <SettingRow label="Country of Incorporation">
        <Select value={country} onChange={setCountry} options={['Croatia (HR)', 'Germany (DE)', 'Austria (AT)']} className="w-44" />
      </SettingRow>

      <div className="mt-6 mb-2">
        <p className="text-theme-sm font-medium text-theme-text mb-1">Legal Identifiers</p>
        <p className="text-theme-xs text-theme-text-muted mb-4">Country-specific registration numbers and tax IDs</p>
        <div className="space-y-2">
          {identifiers.map((id) => (
            <div key={id.id} className="flex items-center gap-2">
              <Input value={id.label} onChange={(v) => updateId(id.id, 'label', v)} className="w-32" placeholder="Label" />
              <Input value={id.value} onChange={(v) => updateId(id.id, 'value', v)} className="w-44" placeholder="Value" />
              <button onClick={() => removeId(id.id)} className="p-1.5 text-theme-text-subtle hover:text-theme-danger transition-colors"><Trash2 size={13} /></button>
            </div>
          ))}
          {adding ? (
            <div className="flex items-center gap-2">
              <Input value={newLabel} onChange={setNewLabel} className="w-32" placeholder="Label" onKeyDown={(e) => { if (e.key === 'Enter') addId(); if (e.key === 'Escape') { setAdding(false); setNewLabel(''); setNewValue(''); } }} />
              <Input value={newValue} onChange={setNewValue} className="w-44" placeholder="Value" onKeyDown={(e) => { if (e.key === 'Enter') addId(); if (e.key === 'Escape') { setAdding(false); setNewLabel(''); setNewValue(''); } }} />
              <button onClick={addId} className="p-1.5 text-emerald-600 hover:text-emerald-700 transition-colors"><Check size={13} /></button>
              <button onClick={() => { setAdding(false); setNewLabel(''); setNewValue(''); }} className="p-1.5 text-theme-text-subtle hover:text-theme-text transition-colors"><X size={13} /></button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-theme-xs text-theme-primary hover:text-theme-primary-hover mt-1 transition-colors">
              <Plus size={12} /> Add identifier
            </button>
          )}
        </div>
      </div>

      <div className="mt-8"><SectionHeader title="Contact & Banking" /></div>
      <SettingRow label="Registered Address"><Input value={address} onChange={setAddress} className="w-64" /></SettingRow>
      <SettingRow label="Primary IBAN"><Input value={iban} onChange={setIban} className="w-56" /></SettingRow>
      <SettingRow label="Responsible Person" description="Printed on official documents"><Input value={responsible} onChange={setResponsible} className="w-44" /></SettingRow>
      <SettingRow label="Contact Email"><Input value={contactEmail} onChange={setContactEmail} className="w-52" /></SettingRow>
      <SaveBar onSave={async () => {
        const idMap: Record<string, string> = {};
        for (const item of identifiers) idMap[item.label] = item.value;
        try {
          if (entityId) {
            await apiFetch(`/legal-entities/${entityId}`, {
              method: 'PUT',
              body: JSON.stringify({
                legal_name: legalName,
                identifiers: idMap,
                address,
                iban,
              }),
            });
          } else {
            await apiFetch('/legal-entities/', {
              method: 'POST',
              body: JSON.stringify({
                legal_name: legalName,
                identifiers: idMap,
                address,
                iban,
              }),
            });
          }
          refetchLegal();
        } catch {
          // Keep local state if offline
        }
      }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Security Tab
// ---------------------------------------------------------------------------

export function SecurityTab() {
  const { isOrg, tenantConfig, setTenantConfig } = useContext(SettingsContext);
  const Row = isOrg ? OrgSettingRow : SettingRow;
  const sec = tenantConfig?.settings?.security as Record<string, unknown> | undefined;

  const [enforce2fa, setEnforce2fa] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('8 hours');
  const [localAuth, setLocalAuth] = useState(true);
  const [ldapAuth, setLdapAuth] = useState(true);
  const [m365Auth, setM365Auth] = useState(false);
  const [googleAuth, setGoogleAuth] = useState(false);
  const [samlAuth, setSamlAuth] = useState(false);
  const [minLength, setMinLength] = useState('12');
  const [pwUppercase, setPwUppercase] = useState(true);
  const [pwNumber, setPwNumber] = useState(true);
  const [pwSpecial, setPwSpecial] = useState(true);
  const [pwExpiry, setPwExpiry] = useState('90 days');
  const [mismatch, setMismatch] = useState<'allow' | 'warn' | 'block'>('warn');
  const [fourEyes, setFourEyes] = useState(false);
  const [requireReason, setRequireReason] = useState(true);

  useEffect(() => {
    if (!sec) return;
    if (typeof sec.enforce2fa === 'boolean') setEnforce2fa(sec.enforce2fa);
    if (typeof sec.sessionTimeout === 'string') setSessionTimeout(sec.sessionTimeout);
    if (typeof sec.localAuth === 'boolean') setLocalAuth(sec.localAuth);
    if (typeof sec.ldapAuth === 'boolean') setLdapAuth(sec.ldapAuth);
    if (typeof sec.m365Auth === 'boolean') setM365Auth(sec.m365Auth);
    if (typeof sec.googleAuth === 'boolean') setGoogleAuth(sec.googleAuth);
    if (typeof sec.samlAuth === 'boolean') setSamlAuth(sec.samlAuth);
    if (typeof sec.minLength === 'string') setMinLength(sec.minLength);
    if (typeof sec.pwUppercase === 'boolean') setPwUppercase(sec.pwUppercase);
    if (typeof sec.pwNumber === 'boolean') setPwNumber(sec.pwNumber);
    if (typeof sec.pwSpecial === 'boolean') setPwSpecial(sec.pwSpecial);
    if (typeof sec.pwExpiry === 'string') setPwExpiry(sec.pwExpiry);
    if (sec.mismatch === 'allow' || sec.mismatch === 'warn' || sec.mismatch === 'block') setMismatch(sec.mismatch);
    if (typeof sec.fourEyes === 'boolean') setFourEyes(sec.fourEyes);
    if (typeof sec.requireReason === 'boolean') setRequireReason(sec.requireReason);
  }, [sec]);

  return (
    <div className="max-w-2xl">
      {isOrg && (
        <div className="flex items-start gap-2 mb-6 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
          <Link2 size={14} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-theme-xs text-theme-text-muted">Settings inherited from tenant by default. Click <span className="text-theme-primary font-medium">Override</span> to configure per-organization.</p>
        </div>
      )}
      <SectionHeader title="Authentication" />
      <Row label="Enforce 2FA" description="All users must configure two-factor authentication" tenantValue="Enabled">
        <Toggle value={enforce2fa} onChange={setEnforce2fa} />
      </Row>
      <Row label="Session Timeout" description="Auto logout after inactivity" tenantValue="8 hours">
        <Select value={sessionTimeout} onChange={setSessionTimeout} options={['30 minutes', '1 hour', '4 hours', '8 hours', '24 hours', 'Never']} className="w-36" />
      </Row>
      <Row label="Allowed Auth Methods" tenantValue="Local, LDAP">
        <div className="flex flex-col gap-2">
          {([['Local password', localAuth, setLocalAuth], ['LDAP / Active Directory', ldapAuth, setLdapAuth], ['Microsoft 365', m365Auth, setM365Auth], ['Google Workspace', googleAuth, setGoogleAuth], ['SAML 2.0', samlAuth, setSamlAuth]] as const).map(([label, val, setter]) => (
            <label key={label as string} className="flex items-center gap-2 cursor-pointer">
              <Toggle value={val as boolean} onChange={setter as (v: boolean) => void} />
              <span className="text-theme-sm text-theme-text">{label as string}</span>
            </label>
          ))}
        </div>
      </Row>
      <div className="mt-8 mb-2"><SectionHeader title="Password Policy" description="Applies to local password authentication only" /></div>
      <Row label="Minimum Length" tenantValue="12 characters">
        <Input value={minLength} onChange={setMinLength} className="w-20" />
      </Row>
      <Row label="Require Uppercase" tenantValue="Enabled"><Toggle value={pwUppercase} onChange={setPwUppercase} /></Row>
      <Row label="Require Number" tenantValue="Enabled"><Toggle value={pwNumber} onChange={setPwNumber} /></Row>
      <Row label="Require Special Character" tenantValue="Enabled"><Toggle value={pwSpecial} onChange={setPwSpecial} /></Row>
      <Row label="Password Expiry" tenantValue="90 days">
        <Select value={pwExpiry} onChange={setPwExpiry} options={['Never', '30 days', '60 days', '90 days', '180 days', '1 year']} className="w-36" />
      </Row>
      <div className="mt-8"><SectionHeader title="Classification Security" description="Behaviour when a user accesses an asset above their clearance" /></div>
      <Row label="Clearance Mismatch Action" tenantValue="Warn">
        <div className="flex gap-2 flex-wrap">
          {(['allow', 'warn', 'block'] as const).map((v) => (
            <button key={v} onClick={() => setMismatch(v)} className={`px-3 py-1 rounded text-theme-xs font-medium capitalize transition-colors ${mismatch === v ? v === 'block' ? 'bg-red-50 text-red-600 border border-red-200' : v === 'warn' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-theme-bg text-theme-text-muted border border-theme-border hover:border-theme-border-strong'}`}>{v}</button>
          ))}
        </div>
      </Row>
      <Row label="4-Eyes Principle" description="Sensitive actions require approval from a second user" tenantValue="Disabled"><Toggle value={fourEyes} onChange={setFourEyes} /></Row>
      <div className="mt-8"><SectionHeader title="Asset Security" /></div>
      <Row label="Require Reason on Decommission" description="User must enter a reason when decommissioning an asset" tenantValue="Enabled"><Toggle value={requireReason} onChange={setRequireReason} /></Row>
      <SaveBar onSave={() => {
        apiFetch<TenantConfigData>('/tenants/config/settings', {
          method: 'PATCH',
          body: JSON.stringify({
            security: {
              enforce2fa,
              sessionTimeout,
              localAuth,
              ldapAuth,
              m365Auth,
              googleAuth,
              samlAuth,
              minLength,
              pwUppercase,
              pwNumber,
              pwSpecial,
              pwExpiry,
              mismatch,
              fourEyes,
              requireReason,
            },
          }),
        }).then(setTenantConfig).catch(() => {});
      }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SSO Tab — master-detail layout
// ---------------------------------------------------------------------------

interface GroupMapping { id: string; adGroup: string; role: string; scope: 'direct' | 'nested'; }
interface AttrMapping { id: string; adAttr: string; field: string; }

function LdapBasicPanel({ getField, setField, onSave }: { getField: (l: string) => string; setField: (l: string, v: string) => void; onSave: () => void }) {
  return (
    <div className="space-y-3">
      {[
        { label: 'LDAP URL', placeholder: 'ldaps://ad.example.com:636' },
        { label: 'Bind DN', placeholder: 'CN=svc-inverum,OU=Service,DC=example,DC=com' },
        { label: 'Base DN', placeholder: 'DC=example,DC=com' },
        { label: 'User Filter', placeholder: '(sAMAccountName={username})' },
      ].map((f) => (
        <div key={f.label} className="flex items-center gap-3">
          <label className="text-theme-xs text-theme-text-muted w-28 shrink-0">{f.label}</label>
          <Input value={getField(f.label)} onChange={(v) => setField(f.label, v)} placeholder={f.placeholder} className="flex-1 font-mono text-theme-xs" />
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button className="px-3 py-1.5 text-theme-xs bg-theme-bg hover:bg-theme-surface-hover text-theme-text rounded border border-theme-border transition-colors">
          Test Connection
        </button>
        <button onClick={onSave} className="px-3 py-1.5 text-theme-xs bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded transition-colors">
          Save
        </button>
      </div>
    </div>
  );
}

function LdapAdvancedPanel({ isEnterprise }: { isEnterprise: boolean }) {
  const [groupMappings, setGroupMappings] = useState<GroupMapping[]>([
    { id: '1', adGroup: 'CN=IT Admins,OU=Groups,DC=posta,DC=hr', role: 'IT Technician', scope: 'direct' },
    { id: '2', adGroup: 'CN=All Users,OU=Groups,DC=posta,DC=hr', role: 'Viewer', scope: 'nested' },
  ]);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState('');
  const [newRole, setNewRole] = useState('Viewer');
  const [newScope, setNewScope] = useState<'direct' | 'nested'>('direct');

  const [syncEnabled, setSyncEnabled] = useState(true);
  const [syncSchedule, setSyncSchedule] = useState('daily');
  const [syncBaseDN, setSyncBaseDN] = useState('OU=Users,DC=posta,DC=hr');
  const [lastSync] = useState('2026-04-11 03:00 — 312 users synced');

  const [deactivateOnGroupRemoval, setDeactivateOnGroupRemoval] = useState(true);
  const [deactivateOnAdDisable, setDeactivateOnAdDisable]       = useState(true);

  const [attrMappings, setAttrMappings] = useState<AttrMapping[]>([
    { id: '1', adAttr: 'displayName', field: 'Full Name' },
    { id: '2', adAttr: 'mail', field: 'Email' },
    { id: '3', adAttr: 'department', field: 'Department' },
    { id: '4', adAttr: 'telephoneNumber', field: 'Phone' },
    { id: '5', adAttr: 'title', field: 'Job Title' },
  ]);
  const [addingAttr, setAddingAttr] = useState(false);
  const [newAdAttr, setNewAdAttr] = useState('');
  const [newField, setNewField] = useState('');

  const addGroupMapping = () => {
    if (!newGroup.trim()) return;
    setGroupMappings(m => [...m, { id: Date.now().toString(), adGroup: newGroup.trim(), role: newRole, scope: newScope }]);
    setNewGroup(''); setAddingGroup(false);
  };
  const removeGroupMapping = (id: string) => setGroupMappings(m => m.filter(x => x.id !== id));

  const addAttrMapping = () => {
    if (!newAdAttr.trim() || !newField.trim()) return;
    setAttrMappings(m => [...m, { id: Date.now().toString(), adAttr: newAdAttr.trim(), field: newField.trim() }]);
    setNewAdAttr(''); setNewField(''); setAddingAttr(false);
  };
  const removeAttrMapping = (id: string) => setAttrMappings(m => m.filter(x => x.id !== id));

  const content = (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <UserCheck size={14} className="text-theme-text-muted" />
          <p className="text-theme-sm font-semibold text-theme-text">Group Mappings</p>
          <span className="text-theme-xs text-theme-text-subtle">AD group → Inverum role</span>
        </div>
        <div className="border border-theme-border rounded-lg overflow-hidden">
          <table className="w-full text-theme-sm">
            <thead>
              <tr className="border-b border-theme-border bg-theme-bg">
                <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">AD Group DN</th>
                <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Role</th>
                <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Scope</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {groupMappings.map((m) => (
                <tr key={m.id} className="border-b border-theme-border last:border-0 hover:bg-theme-surface-hover">
                  <td className="px-4 py-2.5 font-mono text-theme-xs text-theme-text-muted max-w-[260px] truncate">{m.adGroup}</td>
                  <td className="px-4 py-2.5"><Badge color="blue">{m.role}</Badge></td>
                  <td className="px-4 py-2.5 text-theme-xs text-theme-text-subtle">{m.scope}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => removeGroupMapping(m.id)} className="p-1 text-theme-text-subtle hover:text-theme-danger transition-colors"><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
              {addingGroup && (
                <tr className="border-b border-theme-border bg-theme-bg">
                  <td className="px-4 py-2">
                    <Input value={newGroup} onChange={setNewGroup} placeholder="CN=Group,OU=Groups,DC=..." className="w-full font-mono text-theme-xs"
                      onKeyDown={(e) => { if (e.key === 'Enter') addGroupMapping(); if (e.key === 'Escape') { setAddingGroup(false); setNewGroup(''); } }} />
                  </td>
                  <td className="px-4 py-2">
                    <Select value={newRole} onChange={setNewRole} options={['Super Admin', 'Asset Manager', 'IT Technician', 'Warehouse', 'Viewer']} className="w-36" />
                  </td>
                  <td className="px-4 py-2">
                    <Select value={newScope} onChange={(v) => setNewScope(v as 'direct' | 'nested')} options={['direct', 'nested']} className="w-28" />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button onClick={addGroupMapping} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                      <button onClick={() => { setAddingGroup(false); setNewGroup(''); }} className="p-1 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!addingGroup && (
          <button onClick={() => setAddingGroup(true)} className="flex items-center gap-1.5 text-theme-xs text-theme-primary hover:text-theme-primary-hover mt-2 transition-colors">
            <Plus size={12} /> Add mapping
          </button>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <ArrowDownToLine size={14} className="text-theme-text-muted" />
          <p className="text-theme-sm font-semibold text-theme-text">Employee Sync</p>
          <span className="text-theme-xs text-theme-text-subtle">Import employees from AD</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-theme-border">
            <div>
              <p className="text-theme-sm text-theme-text">Auto-sync enabled</p>
              <p className="text-theme-xs text-theme-text-subtle mt-0.5">Automatically sync employees on schedule</p>
            </div>
            <Toggle value={syncEnabled} onChange={setSyncEnabled} />
          </div>
          {syncEnabled && (
            <>
              <div className="flex items-center gap-3">
                <label className="text-theme-xs text-theme-text-muted w-28 shrink-0">Schedule</label>
                <Select value={syncSchedule} onChange={setSyncSchedule} options={['manual', 'hourly', 'daily', 'weekly']} className="w-32" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-theme-xs text-theme-text-muted w-28 shrink-0">User Search Base</label>
                <Input value={syncBaseDN} onChange={setSyncBaseDN} placeholder="OU=Users,DC=example,DC=com" className="flex-1 font-mono text-theme-xs" />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <label className="text-theme-xs text-theme-text-muted w-28 shrink-0">Last sync</label>
                <span className="text-theme-xs text-theme-text-subtle flex items-center gap-1.5">
                  <CheckCircle2 size={11} className="text-emerald-500" /> {lastSync}
                </span>
              </div>
              <div className="pt-1">
                <button className="px-3 py-1.5 text-theme-xs bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded transition-colors flex items-center gap-1.5">
                  <RefreshCw size={11} /> Sync Now
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shuffle size={14} className="text-theme-text-muted" />
          <p className="text-theme-sm font-semibold text-theme-text">Attribute Mappings</p>
          <span className="text-theme-xs text-theme-text-subtle">AD attribute → Inverum field</span>
        </div>
        <div className="border border-theme-border rounded-lg overflow-hidden">
          <table className="w-full text-theme-sm">
            <thead>
              <tr className="border-b border-theme-border bg-theme-bg">
                <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">AD Attribute</th>
                <th className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">Inverum Field</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {attrMappings.map((m) => (
                <tr key={m.id} className="border-b border-theme-border last:border-0 hover:bg-theme-surface-hover">
                  <td className="px-4 py-2.5 font-mono text-theme-xs text-theme-primary">{m.adAttr}</td>
                  <td className="px-4 py-2.5 text-theme-xs text-theme-text">{m.field}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => removeAttrMapping(m.id)} className="p-1 text-theme-text-subtle hover:text-theme-danger transition-colors"><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
              {addingAttr && (
                <tr className="border-b border-theme-border bg-theme-bg">
                  <td className="px-4 py-2">
                    <Input value={newAdAttr} onChange={setNewAdAttr} placeholder="adAttribute" className="w-36 font-mono text-theme-xs"
                      onKeyDown={(e) => { if (e.key === 'Enter') addAttrMapping(); if (e.key === 'Escape') { setAddingAttr(false); setNewAdAttr(''); setNewField(''); } }} />
                  </td>
                  <td className="px-4 py-2">
                    <Input value={newField} onChange={setNewField} placeholder="Inverum field" className="w-36"
                      onKeyDown={(e) => { if (e.key === 'Enter') addAttrMapping(); if (e.key === 'Escape') { setAddingAttr(false); setNewAdAttr(''); setNewField(''); } }} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button onClick={addAttrMapping} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                      <button onClick={() => { setAddingAttr(false); setNewAdAttr(''); setNewField(''); }} className="p-1 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!addingAttr && (
          <button onClick={() => setAddingAttr(true)} className="flex items-center gap-1.5 text-theme-xs text-theme-primary hover:text-theme-primary-hover mt-2 transition-colors">
            <Plus size={12} /> Add mapping
          </button>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <UserX size={14} className="text-theme-text-muted" />
          <p className="text-theme-sm font-semibold text-theme-text">User Lifecycle</p>
          <span className="text-theme-xs text-theme-text-subtle">Auto-deprovisioning rules</span>
        </div>
        <div className="space-y-0 border border-theme-border rounded-lg overflow-hidden">
          <div className="flex items-start justify-between gap-4 px-4 py-3 border-b border-theme-border">
            <div>
              <p className="text-theme-sm text-theme-text">Deactivate when removed from all mapped groups</p>
              <p className="text-theme-xs text-theme-text-subtle mt-0.5">
                If a user no longer belongs to any group mapped to an Inverum role, their account is automatically deactivated on the next sync.
              </p>
            </div>
            <Toggle value={deactivateOnGroupRemoval} onChange={setDeactivateOnGroupRemoval} />
          </div>
          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <div>
              <p className="text-theme-sm text-theme-text">Deactivate when account is disabled in AD</p>
              <p className="text-theme-xs text-theme-text-subtle mt-0.5">
                Reads <span className="font-mono">userAccountControl</span> — if the <span className="font-mono">ACCOUNTDISABLE</span> flag is set, the Inverum account is deactivated on the next sync.
              </p>
            </div>
            <Toggle value={deactivateOnAdDisable} onChange={setDeactivateOnAdDisable} />
          </div>
        </div>
        <p className="text-theme-xs text-theme-text-subtle mt-2">
          Deactivated accounts lose access immediately but are not deleted — audit history and asset assignments are preserved.
        </p>
      </div>
    </div>
  );

  if (!isEnterprise) {
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-theme-surface/80 backdrop-blur-[1px] rounded-lg z-10 flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-2 px-4 py-3 bg-theme-surface border border-theme-border rounded-lg shadow-sm">
            <Lock size={15} className="text-theme-text-muted" />
            <div>
              <p className="text-theme-sm font-medium text-theme-text">Enterprise feature</p>
              <p className="text-theme-xs text-theme-text-subtle">Group mapping and employee sync require an Enterprise plan.</p>
            </div>
            <button className="ml-4 px-3 py-1.5 text-theme-xs bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded transition-colors whitespace-nowrap">
              Upgrade
            </button>
          </div>
        </div>
        <div className="opacity-30 pointer-events-none select-none">{content}</div>
      </div>
    );
  }

  return content;
}

export function SSOTab() {
  const { isOrg, tenantConfig, setTenantConfig } = useContext(SettingsContext);
  const ssoCfg = tenantConfig?.settings?.sso as Record<string, unknown> | undefined;
  const [selected, setSelected] = useState<string>('ldap');
  const [orgOverrides, setOrgOverrides] = useState<Record<string, boolean>>({});
  const [isEnterprise] = useState(true);
  const [ldapSection, setLdapSection] = useState<'basic' | 'advanced'>('basic');
  const [ldapFields, setLdapFields] = useState<Record<string, string>>({
    'LDAP URL': 'ldaps://ad.example.com:636',
    'Bind DN': 'CN=svc-inverum,OU=Service,DC=example,DC=com',
    'Base DN': 'DC=example,DC=com',
    'User Filter': '(sAMAccountName={username})',
  });
  const [oauthFields, setOauthFields] = useState<Record<string, string>>({});
  const getOAuth = (id: string, f: string) => oauthFields[`${id}-${f}`] ?? '';
  const setOAuth = (id: string, f: string, v: string) => setOauthFields(p => ({ ...p, [`${id}-${f}`]: v }));
  const [m365DeactivateOnDisable, setM365DeactivateOnDisable] = useState(true);

  useEffect(() => {
    if (!ssoCfg) return;
    if (ssoCfg.ldapFields && typeof ssoCfg.ldapFields === 'object') {
      setLdapFields(prev => ({ ...prev, ...(ssoCfg.ldapFields as Record<string, string>) }));
    }
    if (ssoCfg.oauthFields && typeof ssoCfg.oauthFields === 'object') {
      setOauthFields(ssoCfg.oauthFields as Record<string, string>);
    }
    if (typeof ssoCfg.m365DeactivateOnDisable === 'boolean') {
      setM365DeactivateOnDisable(ssoCfg.m365DeactivateOnDisable);
    }
  }, [ssoCfg]);

  const saveSso = () => {
    apiFetch<TenantConfigData>('/tenants/config/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        sso: {
          ldapFields,
          oauthFields,
          m365DeactivateOnDisable,
        },
      }),
    }).then(setTenantConfig).catch(() => {});
  };

  type Provider = { id: string; name: string; icon: React.ReactNode; tier: 'opensource' | 'enterprise'; status: 'active' | 'connected' | 'disabled'; fields?: string[]; };
  const providers: Provider[] = [
    { id: 'local',  name: 'Local',                    icon: <KeyRound size={15} />, tier: 'opensource', status: 'active' },
    { id: 'ldap',   name: 'LDAP / Active Directory',  icon: <Server size={15} />,   tier: 'enterprise', status: 'connected' },
    { id: 'm365',   name: 'Microsoft 365 / Entra ID', icon: <Globe size={15} />,    tier: 'enterprise', status: 'disabled', fields: ['Tenant ID', 'Client ID', 'Client Secret'] },
    { id: 'google', name: 'Google Workspace',         icon: <Globe size={15} />,    tier: 'enterprise', status: 'disabled', fields: ['Client ID', 'Client Secret', 'Domain'] },
    { id: 'saml',   name: 'SAML 2.0',                 icon: <KeyRound size={15} />, tier: 'enterprise', status: 'disabled', fields: ['IdP Metadata URL', 'SP Entity ID', 'ACS URL'] },
  ];

  const cur = providers.find(p => p.id === selected)!;
  const isOverridden = !isOrg || !!orgOverrides[selected];

  const statusDot = (s: Provider['status']) => {
    if (s === 'active' || s === 'connected') return <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />;
    return <span className="w-1.5 h-1.5 rounded-full bg-theme-border-strong shrink-0" />;
  };

  const renderRight = () => {
    const inheritBanner = isOrg && !isOverridden && (
      <div className="flex items-center justify-between mb-4 px-3 py-2.5 bg-theme-bg border border-theme-border rounded-lg">
        <span className="flex items-center gap-2 text-theme-xs text-theme-text-muted">
          <Link2 size={13} className="text-theme-text-subtle" /> Inheriting from tenant settings
        </span>
        <button onClick={() => setOrgOverrides(s => ({ ...s, [selected]: true }))} className="flex items-center gap-1 text-theme-xs text-theme-primary hover:text-theme-primary-hover transition-colors">
          Override <ChevronRight size={11} />
        </button>
      </div>
    );

    const resetBtn = isOrg && isOverridden && (
      <button onClick={() => setOrgOverrides(s => ({ ...s, [selected]: false }))} className="flex items-center gap-1.5 text-theme-xs text-theme-text-subtle hover:text-amber-600 transition-colors">
        <RotateCcw size={11} /> Reset to tenant default
      </button>
    );

    if (cur.id === 'local') {
      return (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-theme-base font-semibold text-theme-text">Local Authentication</p>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Open Source</span>
            <Badge color="green"><CheckCircle2 size={10} /> Always active</Badge>
          </div>
          <p className="text-theme-xs text-theme-text-muted mb-6">Username and password authentication. Cannot be fully disabled — always available as fallback.</p>
          <div className="p-4 bg-theme-bg border border-theme-border rounded-lg text-theme-sm text-theme-text-muted space-y-1.5">
            <p>Allowed authentication methods (including enabling/disabling local login on the login page) → <strong className="text-theme-text">Security</strong> tab.</p>
            <p>Password complexity, lockout policy, and session settings → <strong className="text-theme-text">Security</strong> tab.</p>
          </div>
        </div>
      );
    }

    if (cur.id === 'ldap') {
      return (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <p className="text-theme-base font-semibold text-theme-text">LDAP / Active Directory</p>
              <Badge color="green"><CheckCircle2 size={10} /> Connected</Badge>
            </div>
            {resetBtn}
          </div>
          <p className="text-theme-xs text-theme-text-muted mb-4">Authenticate users against your directory. Enterprise plan required for group mappings and employee sync.</p>
          {inheritBanner}
          {(!isOrg || isOverridden) && (
            <>
              <div className="flex border-b border-theme-border mb-4">
                {(['basic', 'advanced'] as const).map((s) => (
                  <button key={s} onClick={() => setLdapSection(s)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-theme-sm font-medium border-b-2 -mb-px transition-colors ${ldapSection === s ? 'border-theme-primary text-theme-primary' : 'border-transparent text-theme-text-subtle hover:text-theme-text'}`}
                  >
                    {s === 'advanced' && !isEnterprise && <Lock size={10} />}
                    {s === 'basic' ? 'Connection' : 'Advanced'}
                    {s === 'advanced' && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${isEnterprise ? 'bg-amber-50 text-amber-700' : 'bg-theme-bg text-theme-text-subtle border border-theme-border'}`}>Enterprise</span>
                    )}
                  </button>
                ))}
              </div>
              {ldapSection === 'basic'
                ? <LdapBasicPanel getField={(l) => ldapFields[l] ?? ''} setField={(l, v) => setLdapFields(p => ({ ...p, [l]: v }))} onSave={saveSso} />
                : <LdapAdvancedPanel isEnterprise={isEnterprise} />
              }
            </>
          )}
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <p className="text-theme-base font-semibold text-theme-text">{cur.name}</p>
            <Badge color="slate">Disabled</Badge>
          </div>
          {resetBtn}
        </div>
        <p className="text-theme-xs text-theme-text-muted mb-4">OAuth 2.0 / OIDC single sign-on via {cur.name}.</p>
        {inheritBanner}
        {(!isOrg || isOverridden) && (
          <div className="space-y-3">
            {(cur.fields ?? []).map((f) => (
              <div key={f} className="flex items-center gap-3">
                <label className="text-theme-xs text-theme-text-muted w-32 shrink-0">{f}</label>
                <Input value={getOAuth(cur.id, f)} onChange={(v) => setOAuth(cur.id, f, v)} placeholder={`Enter ${f.toLowerCase()}`} className="flex-1" />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button className="px-3 py-1.5 text-theme-xs bg-theme-bg hover:bg-theme-surface-hover text-theme-text rounded border border-theme-border transition-colors">Test Connection</button>
              <button onClick={saveSso} className="px-3 py-1.5 text-theme-xs bg-theme-primary hover:bg-theme-primary-hover text-theme-primary-fg rounded transition-colors">Save</button>
            </div>
            {cur.id === 'm365' && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <UserX size={14} className="text-theme-text-muted" />
                  <p className="text-theme-sm font-semibold text-theme-text">User Lifecycle</p>
                </div>
                <div className="border border-theme-border rounded-lg overflow-hidden">
                  <div className="flex items-start justify-between gap-4 px-4 py-3">
                    <div>
                      <p className="text-theme-sm text-theme-text">Deactivate when account is disabled in Entra ID</p>
                      <p className="text-theme-xs text-theme-text-subtle mt-0.5">
                        If <span className="font-mono">accountEnabled</span> is <span className="font-mono">false</span> in Microsoft Entra ID, the Inverum account is deactivated on next sign-in or sync.
                      </p>
                    </div>
                    <Toggle value={m365DeactivateOnDisable} onChange={setM365DeactivateOnDisable} />
                  </div>
                </div>
                <p className="text-theme-xs text-theme-text-subtle mt-2">
                  Deactivated accounts lose access immediately but are not deleted — audit history and asset assignments are preserved.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-full">
      <div className="w-56 shrink-0 border-r border-theme-border pt-2 pb-4">
        <p className="px-4 py-2 text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider">Providers</p>
        {providers.map((p) => {
          const active = selected === p.id;
          const overridden = !isOrg || !!orgOverrides[p.id];
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${active ? 'bg-theme-surface-hover text-theme-text' : 'text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text'}`}
            >
              <span className={active ? 'text-theme-primary' : 'text-theme-text-subtle'}>{p.icon}</span>
              <span className="text-theme-sm flex-1 truncate">{p.name}</span>
              {isOrg && !overridden
                ? <span className="text-theme-text-subtle shrink-0"><Link2 size={10} /></span>
                : statusDot(p.status)
              }
            </button>
          );
        })}
      </div>

      <div className="flex-1 px-8 py-6 overflow-auto">
        {isOrg && (
          <div className="flex items-center gap-1.5 mb-5 text-theme-xs text-theme-text-subtle">
            <Link2 size={11} />
            <span>Organization-level overrides — changes here apply only to this org.</span>
          </div>
        )}
        {renderRight()}
      </div>
    </div>
  );
}
