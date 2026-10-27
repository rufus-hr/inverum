import React, { useState, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { Box } from 'lucide-react';
import type { Asset, ActivePanel } from '../types';
import type { CursorPagedResponse, PagedResponse, AssetResponse, EmployeeResponse, LocationResponse } from '../types/api';
import { useApiQuery, useApiMutation } from '../hooks/useApi';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { useAssetFilters, applyFilters, getAvailableCustomFields } from '../hooks/useAssetFilters';
import { useAssetSelection } from '../hooks/useAssetSelection';
import { AssetFilters } from '../components/assets/AssetFilters';
import { AssetTable } from '../components/assets/AssetTable';
import { AssetDetailPanel } from '../components/assets/AssetDetailPanel';
import { AssetDragOverlay, AssetDropAction } from '../components/assets/AssetDragOverlay';
import { useAppContext } from '../contexts/AppContext';

function mapApiAsset(a: AssetResponse, locMap?: Map<string, string>): Asset {
  const cfStatus = (a.custom_fields as Record<string, string> | undefined)?.lifecycle_status;
  return {
    id: a.id,
    inventoryNumber: a.inventory_number ?? a.serial_number ?? a.id.slice(0, 8).toUpperCase(),
    type: (a.custom_fields as Record<string, string> | undefined)?.asset_type ?? 'Laptop',
    name: a.name ?? 'Unnamed',
    assignee: (a.custom_fields as Record<string, string> | undefined)?.assignee_name ?? '—',
    status: (cfStatus as Asset['status']) ?? (a.status as Asset['status']) ?? (a.is_active ? 'in_stock' : 'retired'),
    orgId: a.organization_id,
    locId: (a.location_id && locMap?.get(a.location_id)) || a.location_id || '—',
    mobility_type: a.mobility_type ?? 'personal',
    is_checklist_pending: Boolean(a.is_checklist_pending),
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
  const toast = useToast();
  const filters = useAssetFilters();
  const selection = useAssetSelection();

  // API data (skipped if initialAssets provided)
  const { data: apiData, isLoading, refetch: refetchAssets } = useApiQuery<CursorPagedResponse<AssetResponse>>(
    '/assets/?limit=200',
    { skip: !!initialAssets }
  );
  const { data: employeesResp } = useApiQuery<PagedResponse<EmployeeResponse>>('/employees/?limit=200');
  const { data: locationsResp } = useApiQuery<PagedResponse<LocationResponse>>('/locations/?limit=200');

  const employees = employeesResp?.items ?? [];
  const locations = locationsResp?.items ?? [];
  const locMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of locations) m.set(l.id, l.name);
    return m;
  }, [locations]);

  const apiAssets = useMemo(
    () => (apiData?.items ?? []).map(a => mapApiAsset(a, locMap)),
    [apiData, locMap]
  );

  const [localOverride, setLocalOverride] = useState<Asset[] | null>(null);
  const [localAssets, setLocalAssets] = useState<Asset[]>(initialAssets ?? []);
  const assets = initialAssets ? localAssets : (localOverride ?? apiAssets);

  const setAssets = (newAssets: Asset[]) => {
    if (initialAssets) {
      setLocalAssets(newAssets);
      onAssetsChange?.(newAssets);
    } else {
      setLocalOverride(newAssets);
    }
  };

  // Mutations
  const createMutation = useApiMutation<Record<string, any>, AssetResponse>('/assets/', 'POST');
  const updateMutation = useApiMutation<Record<string, any>, AssetResponse>('/assets/', 'PUT');
  const deleteMutation = useApiMutation<void, void>('/assets/', 'DELETE');

  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [dropContext, setDropContext] = useState<{ asset: Asset; action: AssetDropAction | null } | null>(null);
  const droppedOnTarget = useRef(false);
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

  const handleDragStart = (id: string) => {
    setDraggingAssetId(id);
    const found = assets.find(a => a.id === id);
    if (found) setDropContext({ asset: found, action: null });
  };

  const handleDragEnd = () => {
    setDraggingAssetId(null);
    if (!droppedOnTarget.current) {
      setDropContext(null);
    }
    droppedOnTarget.current = false;
  };

  const handleTargetDrop = async (action: AssetDropAction) => {
    droppedOnTarget.current = true;
    const targetAsset = dropContext?.asset;
    if (!targetAsset) return;

    if (action === 'assign' || action === 'move') {
      setDropContext({ asset: targetAsset, action });
      return;
    }

    const nextStatus = action === 'service' ? 'in_service' : 'retired';
    setDropContext(null);
    setAssets(assets.map(a => a.id === targetAsset.id ? {
      ...a,
      status: nextStatus,
      is_checklist_pending: true,
    } : a));

    try {
      await apiFetch(`/assets/${targetAsset.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: nextStatus,
          custom_fields: { ...(targetAsset.custom_fields || {}), lifecycle_status: nextStatus },
        }),
      });
      toast.success(
        action === 'service'
          ? `${targetAsset.inventoryNumber} poslan na servis (SOP checklista otvorena)`
          : `${targetAsset.inventoryNumber} u procesu rashoda (4-Eyes SOP checklista otvorena)`
      );
      refetchAssets();
      setLocalOverride(null);
    } catch {
      toast.error('Greška pri promjeni statusa uređaja');
    }
  };

  const handleAssignEmployee = async (emp: EmployeeResponse) => {
    const targetAsset = dropContext?.asset;
    if (!targetAsset) return;
    const empFullName = `${emp.first_name} ${emp.last_name}`;
    setDropContext(null);
    setAssets(assets.map(a => a.id === targetAsset.id ? {
      ...a,
      assignee: empFullName,
      status: 'active',
      is_checklist_pending: true,
    } : a));

    try {
      await apiFetch('/asset-assignments', {
        method: 'POST',
        body: JSON.stringify({
          asset_id: targetAsset.id,
          assigned_to_type: 'user',
          assigned_to_id: emp.id,
          notes: `Assigned to ${empFullName} via Drag & Drop`,
        }),
      });
      await apiFetch(`/assets/${targetAsset.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'active',
          custom_fields: {
            ...(targetAsset.custom_fields || {}),
            lifecycle_status: 'active',
            assignee_name: empFullName,
          },
        }),
      });
      toast.success(`${targetAsset.inventoryNumber} zadužen na ${empFullName} (SOP checklista otvorena)`);
      refetchAssets();
      setLocalOverride(null);
    } catch {
      toast.error('Greška pri zaduživanju opreme');
    }
  };

  const handleMoveLocation = async (loc: LocationResponse) => {
    const targetAsset = dropContext?.asset;
    if (!targetAsset) return;
    setDropContext(null);
    setAssets(assets.map(a => a.id === targetAsset.id ? {
      ...a,
      locId: loc.name,
      status: 'in_stock',
    } : a));

    try {
      await apiFetch(`/assets/${targetAsset.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          location_id: loc.id,
          status: 'in_stock',
          custom_fields: {
            ...(targetAsset.custom_fields || {}),
            lifecycle_status: 'in_stock',
          },
        }),
      });
      toast.success(`${targetAsset.inventoryNumber} premješten na ${loc.name}`);
      refetchAssets();
      setLocalOverride(null);
    } catch {
      toast.error('Greška pri premještanju opreme');
    }
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
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
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
      />
      {dropContext && (
        <AssetDragOverlay
          asset={dropContext.asset}
          activeAction={dropContext.action}
          employees={employees}
          locations={locations}
          onTargetDrop={handleTargetDrop}
          onAssignEmployee={handleAssignEmployee}
          onMoveLocation={handleMoveLocation}
          onClose={() => setDropContext(null)}
        />
      )}
    </div>
  );
});

export default AssetsView;
