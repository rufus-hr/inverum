import React, { useState } from 'react';
import {
  ShoppingBag, AlertTriangle, CalendarClock, Building2, Download,
  FileSpreadsheet, ShieldCheck, RefreshCw, Search, Layers, PackageCheck,
} from 'lucide-react';
import { useApiQuery } from '../hooks/useApi';
import { getAccessToken } from '../lib/api';

interface TenantSummaryItem {
  id: string;
  name: string;
  slug: string;
  asset_count: number;
  contract_count: number;
  supply_count: number;
}

interface TenantShortageBreakdown {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  supply_id: string;
  locations: string;
  current_qty: number;
  min_qty: number;
  deficit_qty: number;
  reorder_qty: number;
  estimated_cost: number;
}

interface ConsolidatedShortageItem {
  sku_key: string;
  part_number: string;
  supply_name: string;
  supply_type: string;
  category: string;
  manufacturer_name: string;
  vendor_name: string;
  unit: string;
  unit_price: number;
  currency: string;
  total_current_qty: number;
  total_min_qty: number;
  total_deficit_qty: number;
  total_reorder_qty: number;
  estimated_order_cost: number;
  tenant_breakdown: TenantShortageBreakdown[];
}

interface ShortagesResponse {
  consolidated_shortages: ConsolidatedShortageItem[];
  summary: {
    total_skus_short: number;
    total_units_to_order: number;
    total_estimated_cost: number;
    tenants_affected_count: number;
  };
}

interface ExpiringItem {
  id: string;
  item_type: 'warranty' | 'contract' | 'asset_eol';
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  title: string;
  reference_code: string;
  vendor_name: string;
  support_level: string;
  expires_at: string;
  days_remaining: number;
  auto_renew: boolean;
  estimated_value: number;
  currency: string;
}

interface ExpiringVendorGroup {
  vendor_name: string;
  item_type: string;
  total_count: number;
  tenants_affected: string[];
  tenants_count: number;
  total_estimated_value: number;
  currency: string;
}

interface ExpiringResponse {
  items: ExpiringItem[];
  by_vendor: ExpiringVendorGroup[];
  summary: {
    total_items: number;
    warranties_count: number;
    contracts_count: number;
    eol_assets_count: number;
    total_estimated_value: number;
    tenants_affected: number;
  };
}

export function MspProcurementView() {
  const [activeTab, setActiveTab] = useState<'shortages' | 'expiring'>('shortages');
  const [daysHorizon, setDaysHorizon] = useState<number>(90);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [vendorFilter, setVendorFilter] = useState<string>('');
  const [includeAllSkus, setIncludeAllSkus] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<'pdf' | 'csv' | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const { data: tenantsData } = useApiQuery<{ items: TenantSummaryItem[]; total: number }>(
    '/platform/tenants',
  );

  const shortagesParams: Record<string, string | number | boolean | undefined> = {
    include_all: includeAllSkus,
  };
  if (selectedTenantId) shortagesParams.tenant_id = selectedTenantId;
  if (vendorFilter.trim()) shortagesParams.vendor = vendorFilter.trim();

  const {
    data: shortagesData,
    isLoading: loadingShortages,
    refetch: refetchShortages,
  } = useApiQuery<ShortagesResponse>('/platform/procurement/shortages', shortagesParams);

  const expiringParams: Record<string, string | number | boolean | undefined> = {
    days: daysHorizon,
  };
  if (selectedTenantId) expiringParams.tenant_id = selectedTenantId;
  if (vendorFilter.trim()) expiringParams.vendor = vendorFilter.trim();

  const {
    data: expiringData,
    isLoading: loadingExpiring,
    refetch: refetchExpiring,
  } = useApiQuery<ExpiringResponse>('/platform/procurement/expiring', expiringParams);

  const handleExportOrder = async (format: 'pdf' | 'csv') => {
    setIsExporting(format);
    setExportStatus(null);
    try {
      const token = getAccessToken();
      const response = await fetch('/api/v1/platform/procurement/export-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          format,
          days: daysHorizon,
          tenant_id: selectedTenantId || null,
          vendor_filter: vendorFilter.trim() || null,
          include_shortages: true,
          include_expiring: true,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download =
        format === 'csv'
          ? `MSP-Konsolidirana-Narudzbenica-${dateStr}.csv`
          : `MSP-Konsolidirana-Narudzbenica-${dateStr}-PAdES-LTA.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      const sha = response.headers.get('X-Document-SHA256');
      setExportStatus(
        format === 'pdf'
          ? `PAdES-B-LTA potpisana narudžbenica preuzeta${sha ? ` (SHA-256: ${sha.slice(0, 12)}…)` : ''}`
          : 'CSV skupna narudžbenica uspješno preuzeta.',
      );
    } catch (err) {
      setExportStatus(
        `Greška pri eksportu: ${err instanceof Error ? err.message : 'Nepoznata greška'}`,
      );
    } finally {
      setIsExporting(null);
    }
  };

  const shortages = shortagesData?.consolidated_shortages ?? [];
  const shortagesSummary = shortagesData?.summary ?? {
    total_skus_short: 0,
    total_units_to_order: 0,
    total_estimated_cost: 0,
    tenants_affected_count: 0,
  };

  const expiringItems = expiringData?.items ?? [];
  const expiringByVendor = expiringData?.by_vendor ?? [];
  const expiringSummary = expiringData?.summary ?? {
    total_items: 0,
    warranties_count: 0,
    contracts_count: 0,
    eol_assets_count: 0,
    total_estimated_value: 0,
    tenants_affected: 0,
  };

  const tenants = tenantsData?.items ?? [];

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 p-6 space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <ShoppingBag size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">
                  MSP Skupna Nabava i Plan Obnove (Cross-Tenant Procurement)
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                  Platform Scope
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Konsolidirani pregled manjkova na zalihama (po Part-Numberu) te ugovora, garancija i EoL opreme pred istekom kroz sve klijente
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              refetchShortages();
              refetchExpiring();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw size={14} /> Osvježi
          </button>

          <button
            onClick={() => handleExportOrder('csv')}
            disabled={isExporting !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            {isExporting === 'csv' ? 'Generiranje CSV-a...' : 'Eksportiraj CSV'}
          </button>

          <button
            onClick={() => handleExportOrder('pdf')}
            disabled={isExporting !== null}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <Download size={15} />
            {isExporting === 'pdf'
              ? 'Potpisivanje PDF-a...'
              : 'PAdES-LTA Skupna Narudžbenica (PDF)'}
          </button>
        </div>
      </div>

      {exportStatus && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            <span>{exportStatus}</span>
          </div>
          <button
            onClick={() => setExportStatus(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>SKU Artikli ispod minimuma</span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {shortagesSummary.total_skus_short}
            </span>
            <span className="text-xs text-slate-500">
              ({shortagesSummary.total_units_to_order} kom za naručiti)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Kroz {shortagesSummary.tenants_affected_count || tenants.length} klijenta (tenanta)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Vrijednost skupne nabave zaliha</span>
            <PackageCheck size={16} className="text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-700">
            {shortagesSummary.total_estimated_cost.toLocaleString('hr-HR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            EUR
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Konsolidirano po proizvođaču i distributeru
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Istek garancija, ugovora i EoL ({daysHorizon}d)</span>
            <CalendarClock size={16} className="text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {expiringSummary.total_items}
            </span>
            <span className="text-xs text-slate-500">
              ({expiringSummary.warranties_count} gar. · {expiringSummary.contracts_count} ug. ·{' '}
              {expiringSummary.eol_assets_count} EoL)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Obuhvaća {expiringSummary.tenants_affected} klijenata
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>CAPEX / OPEX procjena obnove</span>
            <Building2 size={16} className="text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">
            {expiringSummary.total_estimated_value.toLocaleString('hr-HR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            EUR
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Ukupna vrijednost ugovora i zamjene opreme
          </div>
        </div>
      </div>

      {/* Filter Bar & Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('shortages')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'shortages'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers size={14} />
            Manjkovi Zaliha po SKU ({shortages.length})
          </button>
          <button
            onClick={() => setActiveTab('expiring')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'expiring'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CalendarClock size={14} />
            Garancije, Ugovori i EoL ({expiringItems.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tenant selector */}
          <select
            value={selectedTenantId}
            onChange={e => setSelectedTenantId(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Svi klijenti / tenanti ({tenants.length})</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.slug})
              </option>
            ))}
          </select>

          {/* Vendor search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              placeholder="Filtriraj dobavljača / OEM..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {activeTab === 'shortages' ? (
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none px-2 py-1 rounded hover:bg-slate-100">
              <input
                type="checkbox"
                checked={includeAllSkus}
                onChange={e => setIncludeAllSkus(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Prikaži i popunjene SKU stavke
            </label>
          ) : (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {[30, 90, 180, 365].map(d => (
                <button
                  key={d}
                  onClick={() => setDaysHorizon(d)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    daysHorizon === d
                      ? 'bg-white text-indigo-600 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'shortages' ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Konsolidirana lista za nabavu po Part-Numberu (SKU)
              </h2>
              <p className="text-xs text-slate-500">
                Grupirano po katalogu i distributeru za slanje jedinstvene narudžbenice
              </p>
            </div>
          </div>

          {loadingShortages ? (
            <div className="p-10 text-center text-xs text-slate-400">
              Učitavanje konsolidiranih zaliha kroz sve tenante...
            </div>
          ) : shortages.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <div className="text-sm font-semibold text-slate-700">
                Nema artikala ispod minimalne zalihe
              </div>
              <p className="text-xs text-slate-500">
                Uključi opciju &ldquo;Prikaži i popunjene SKU stavke&rdquo; za prikaz cijelog kataloga kroz klijente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Part Number (SKU)</th>
                    <th className="py-3 px-4">Naziv i tip artikla</th>
                    <th className="py-3 px-4">Proizvođač / Distributer</th>
                    <th className="py-3 px-4">Raspodjela po klijentima (Tenantima)</th>
                    <th className="py-3 px-4 text-right">Na stanju</th>
                    <th className="py-3 px-4 text-right">Minimum</th>
                    <th className="py-3 px-4 text-right">Za naručiti</th>
                    <th className="py-3 px-4 text-right">Jed. cijena</th>
                    <th className="py-3 px-4 text-right">Ukupno (EUR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {shortages.map(s => (
                    <tr key={s.sku_key} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                        {s.part_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{s.supply_name}</div>
                        <div className="text-[11px] text-slate-400 uppercase">
                          {s.supply_type} · {s.category}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{s.manufacturer_name}</div>
                        <div className="text-[11px] text-slate-500">{s.vendor_name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {s.tenant_breakdown.map(tb => (
                            <span
                              key={`${tb.tenant_id}-${tb.supply_id}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] text-slate-700"
                              title={`Lokacije: ${tb.locations}`}
                            >
                              <strong className="text-slate-900">{tb.tenant_name}:</strong>
                              <span>
                                {tb.current_qty}/{tb.min_qty} {s.unit}
                              </span>
                              {tb.reorder_qty > 0 && (
                                <span className="text-rose-600 font-bold">
                                  (+{tb.reorder_qty})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {s.total_current_qty} {s.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {s.total_min_qty} {s.unit}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-mono font-bold ${
                            s.total_reorder_qty > 0
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {s.total_reorder_qty} {s.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {s.unit_price.toFixed(2)} {s.currency}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {s.estimated_order_cost.toFixed(2)} {s.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Grouped by vendor cards */}
          {expiringByVendor.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {expiringByVendor.slice(0, 6).map(vg => (
                <div
                  key={`${vg.vendor_name}-${vg.item_type}`}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{vg.vendor_name}</div>
                    <div className="text-[11px] text-slate-500 uppercase mt-0.5">
                      {vg.item_type} · {vg.total_count} stavki ({vg.tenants_count} klijenta)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-indigo-700 font-mono">
                      {vg.total_estimated_value.toLocaleString('hr-HR', {
                        minimumFractionDigits: 2,
                      })}{' '}
                      {vg.currency}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Expiring line items table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/60">
              <h2 className="text-sm font-bold text-slate-800">
                Stavke pred istekom u idućih {daysHorizon} dana
              </h2>
            </div>

            {loadingExpiring ? (
              <div className="p-10 text-center text-xs text-slate-400">
                Učitavanje garancija, ugovora i EoL opreme...
              </div>
            ) : expiringItems.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                Nema stavki koje istječu u odabranom periodu ({daysHorizon} dana).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Klijent (Tenant)</th>
                      <th className="py-3 px-4">Vrsta</th>
                      <th className="py-3 px-4">Naziv / Stavka</th>
                      <th className="py-3 px-4">Referenca / S/N</th>
                      <th className="py-3 px-4">Dobavljač (Vendor)</th>
                      <th className="py-3 px-4">Datum isteka</th>
                      <th className="py-3 px-4 text-right">Status roka</th>
                      <th className="py-3 px-4 text-right">Procjena obnove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {expiringItems.map(item => {
                      const badgeColor =
                        item.days_remaining < 0
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : item.days_remaining <= 30
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-blue-50 text-blue-700 border-blue-200';
                      return (
                        <tr
                          key={`${item.item_type}-${item.id}`}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {item.tenant_name}
                          </td>
                          <td className="py-3 px-4">
                            <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {item.item_type}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900">{item.title}</div>
                            <div className="text-[11px] text-slate-400">{item.support_level}</div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {item.reference_code}
                          </td>
                          <td className="py-3 px-4 text-slate-700">{item.vendor_name}</td>
                          <td className="py-3 px-4 font-mono text-slate-700">{item.expires_at}</td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded border text-[11px] font-bold ${badgeColor}`}
                            >
                              {item.days_remaining < 0
                                ? `Isteklo prije ${Math.abs(item.days_remaining)}d`
                                : `Za ${item.days_remaining}d`}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {item.estimated_value.toFixed(2)} {item.currency}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MspProcurementView;
