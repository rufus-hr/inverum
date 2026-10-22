import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Box } from 'lucide-react';
import type { Asset, ActivePanel } from '../types';
import type { CursorPagedResponse, AssetResponse } from '../types/api';
import { mockAuditLog } from '../lib/mockData';
import { useApiQuery, useApiMutation } from '../hooks/useApi';
import { useAssetFilters, applyFilters, getAvailableCustomFields } from '../hooks/useAssetFilters';
import { useAssetSelection } from '../hooks/useAssetSelection';
import { AssetFilters } from '../components/assets/AssetFilters';
import { AssetTable } from '../components/assets/AssetTable';
import { AssetDetailPanel } from '../components/assets/AssetDetailPanel';
import { useAppContext } from '../contexts/AppContext';

function mapApiAsset(a: AssetResponse): Asset {
  return {
    id: a.id,
    inventoryNumber: a.inventory_number ?? a.id.slice(0, 8),
    type: 'asset',
    name: a.name ?? 'Unnamed',
    assignee: '—',
    status: (a.status as Asset['status']) ?? 'in_stock',
    orgId: a.organization_id,
    locId: a.location_id ?? '',
    mobility_type: a.mobility_type ?? 'personal',
    custom_fields: a.custom_fields as Record<string, string> | undefined,
    serial_number: a.serial_number ?? undefined,
    vendor_id: a.vendor_id ?? undefined,
    purchase_date: a.purchase_date ?? undefined,
    purchase_cost: a.purchase_cost?.toString() ?? undefined,
  };
}

export interface AssetsViewHandle {
  filterByType: (type: string) => void;
  selectAsset: (id: string) => void;
  applyPreset: (presetId: string) => void;
  getAssets: () => Asset[];
  getViewPresets: () => { id: string; name: string; columns: string[] }[];
}

interface AssetsViewProps {
  assets?: Asset[];
  onAssetsChange?: (assets: Asset[]) => void;
  orgFilterIds?: Set<string>;
  locFilterIds?: Set<string>;
}

const AssetsView = forwardRef<AssetsViewHandle, AssetsViewProps>(function AssetsView(
  { assets: initialAssets, onAssetsChange, orgFilterIds, locFilterIds },
  ref
) {
  const { assetCategories } = useAppContext();
  const filters = useAssetFilters();
  const selection = useAssetSelection();

  // API data (skipped if initialAssets provided)
  const { data: apiData, isLoading } = useApiQuery<CursorPagedResponse<AssetResponse>>(
    '/assets/?limit=200',
    { skip: !!initialAssets }
  );

  const apiAssets = useMemo(
    () => (apiData?.items ?? []).map(mapApiAsset),
    [apiData]
  );

  const [localAssets, setLocalAssets] = useState<Asset[]>(initialAssets ?? []);
  const assets = initialAssets ? localAssets : apiAssets;

  const setAssets = (newAssets: Asset[]) => {
    if (initialAssets) {
      setLocalAssets(newAssets);
      onAssetsChange?.(newAssets);
    }
    // For API mode, changes go through mutations
  };

  // Mutations
  const createMutation = useApiMutation<Record<string, any>, AssetResponse>('/assets/', 'POST');
  const updateMutation = useApiMutation<Record<string, any>, AssetResponse>('/assets/', 'PUT');
  const deleteMutation = useApiMutation<void, void>('/assets/', 'DELETE');

  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState('default');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['type', 'assignee', 'location']));

  const displayedAssets = useMemo(
    () => applyFilters(assets, filters, orgFilterIds, locFilterIds),
    [assets, filters, orgFilterIds, locFilterIds]
  );

  const availableCustomFields = useMemo(() => getAvailableCustomFields(assets), [assets]);

  const applyPreset = (presetId: string) => {
    setActivePreset(presetId);
    if (presetId === 'default') setVisibleColumns(new Set(['type', 'assignee', 'location']));
    else if (presetId === 'it-infra') setVisibleColumns(new Set(['type', 'location', 'IP Address', 'MAC Address', 'OS', 'Rack Unit']));
    else if (presetId === 'mobile-fleet') setVisibleColumns(new Set(['assignee', 'Storage', 'IMEI', 'Warranty Expiry', 'Phone Number']));
    else if (presetId === 'vehicles') setVisibleColumns(new Set(['assignee', 'License Plate', 'VIN', 'Next Service']));
  };

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      next.has(col) ? next.delete(col) : next.add(col);
      return next;
    });
    setActivePreset('custom');
  };

  const handleSaveEdit = async (updated: Asset) => {
    try {
      const payload = {
        name: updated.name,
        serial_number: updated.serial_number || undefined,
        status: updated.status,
        custom_fields: updated.custom_fields || undefined,
      };
      await updateMutation.mutate(payload, `/assets/${updated.id}`);
      // For now, optimistic update on local state
      setAssets(assets.map(a => a.id === updated.id ? updated : a));
      setActivePanel('details');
    } catch {
      // Error handled by mutation state
    }
  };

  const closePanel = () => {
    setExpandedAssetId(null);
    setActivePanel(null);
  };

  useImperativeHandle(ref, () => ({
    filterByType: (type: string) => filters.setSelectedTypes(new Set([type])),
    selectAsset: (id: string) => selection.toggle(id),
    applyPreset,
    getAssets: () => assets,
    getViewPresets: () => [
      { id: 'default', name: 'default_view', columns: ['type', 'assignee', 'location'] },
      { id: 'it-infra', name: 'it_infrastructure', columns: ['type', 'location', 'IP Address', 'MAC Address', 'OS', 'Rack Unit'] },
      { id: 'mobile-fleet', name: 'mobile_fleet', columns: ['assignee', 'Storage', 'IMEI', 'Warranty Expiry', 'Phone Number'] },
    ],
  }));

  const expandedAsset = expandedAssetId ? assets.find(a => a.id === expandedAssetId) ?? null : null;

  if (isLoading && !initialAssets) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden relative">
      <div className="flex-1 flex flex-col overflow-auto transition-all duration-300 ease-in-out">
        <div className="p-8 min-w-max md:min-w-0">
          <div className="mb-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 shadow-sm">
                  <Box size={24} />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Assets</h1>
                <span className="text-sm text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full font-medium">
                  {displayedAssets.length}
                </span>
              </div>
            </div>
            <AssetFilters
              filters={filters}
              availableCustomFields={availableCustomFields}
              assetCategories={assetCategories}
            />
          </div>
          <AssetTable
            assets={displayedAssets}
            selection={selection}
            expandedAssetId={expandedAssetId}
            draggingAssetId={draggingAssetId}
            onExpand={setExpandedAssetId}
            onPanelChange={setActivePanel}
            onDragStart={setDraggingAssetId}
            onDragEnd={() => setDraggingAssetId(null)}
            onClearFilters={filters.clearAll}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
            activePreset={activePreset}
            onApplyPreset={applyPreset}
            viewMode={filters.viewMode}
            assetCategories={assetCategories}
          />
        </div>
      </div>
      <AssetDetailPanel
        asset={expandedAsset}
        activePanel={activePanel}
        onClose={closePanel}
        onSaveEdit={handleSaveEdit}
        onPanelChange={setActivePanel}
        mockAuditLog={mockAuditLog}
      />
    </div>
  );
});

export default AssetsView;
