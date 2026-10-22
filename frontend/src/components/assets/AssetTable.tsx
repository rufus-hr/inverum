import React, { useRef } from 'react';
import { Columns, AlignJustify, Server, Smartphone, Car } from 'lucide-react';
import type { Asset, ActivePanel } from '../../types';
import type { UseAssetSelectionReturn } from '../../hooks/useAssetSelection';
import { AssetEmptyState } from './AssetEmptyState';
import { AssetTableRow } from './AssetTableRow';
import { AssetColumnChooser } from './AssetColumnChooser';
import { createDragGhost } from './AssetDragOverlay';

interface ViewPreset {
  id: string;
  name: string;
  icon: React.ReactNode;
  types: string[];
  columns: string[];
}

interface AssetTableProps {
  assets: Asset[];
  selection: UseAssetSelectionReturn;
  expandedAssetId: string | null;
  draggingAssetId: string | null;
  onExpand: (id: string | null) => void;
  onPanelChange: (panel: ActivePanel) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onClearFilters: () => void;
  visibleColumns: Set<string>;
  onToggleColumn: (col: string) => void;
  activePreset: string;
  onApplyPreset: (presetId: string) => void;
  viewMode: 'touch' | 'standard' | 'compact';
  assetCategories: { id: string; label: string; icon: React.ReactNode; types: string[] }[];
}

const VIEW_PRESETS: ViewPreset[] = [
  { id: 'default', name: 'default_view', icon: <AlignJustify size={14} />, types: [], columns: ['type', 'assignee', 'location'] },
  { id: 'it-infra', name: 'it_infrastructure', icon: <Server size={14} />, types: ['Server', 'Router', 'Switch', 'Firewall', 'Access Point'], columns: ['type', 'location', 'IP Address', 'MAC Address', 'OS', 'Rack Unit'] },
  { id: 'mobile-fleet', name: 'mobile_fleet', icon: <Smartphone size={14} />, types: ['Laptop', 'Mobile Phone', 'Tablet'], columns: ['assignee', 'Storage', 'IMEI', 'Warranty Expiry', 'Phone Number'] },
  { id: 'vehicles', name: 'vehicles', icon: <Car size={14} />, types: ['Vehicle'], columns: ['assignee', 'License Plate', 'VIN', 'Next Service'] },
];

export function AssetTable({
  assets, selection, expandedAssetId, draggingAssetId,
  onExpand, onPanelChange, onDragStart, onDragEnd, onClearFilters,
  visibleColumns, onToggleColumn, activePreset, onApplyPreset,
  viewMode, assetCategories,
}: AssetTableProps) {
  const [showColumnMenu, setShowColumnMenu] = React.useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    createDragGhost(e, asset);
    setTimeout(() => onDragStart(asset.id), 0);
  };

  const handleActionClick = (assetId: string, panel: ActivePanel) => {
    if (expandedAssetId === assetId) {
      onExpand(null);
    } else {
      onExpand(assetId);
      onPanelChange(panel);
    }
  };

  // Compute available custom field columns from all assets
  const availableCustomFields = React.useMemo(() => {
    const fields = new Set<string>();
    assets.forEach(a => {
      if (a.custom_fields) Object.keys(a.custom_fields).forEach(k => fields.add(k));
    });
    return Array.from(fields).sort();
  }, [assets]);

  const colSpan = visibleColumns.size + 6;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/50">
            <th className="px-4 py-3 text-left w-12">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                checked={selection.count === assets.length && assets.length > 0}
                onChange={() => selection.count === assets.length ? selection.clear() : selection.selectAll(assets.map(a => a.id))}
              />
            </th>
            <th className="px-4 py-3 text-left w-16" />
            <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-left w-40 whitespace-nowrap">Inventory #</th>
            <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-left">Name / Type</th>
            {visibleColumns.has('type') && <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-left w-32 whitespace-nowrap">Type</th>}
            {visibleColumns.has('assignee') && <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-left w-36 whitespace-nowrap">Assignee</th>}
            {visibleColumns.has('location') && <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-left whitespace-nowrap">Location</th>}
            {availableCustomFields.filter(col => visibleColumns.has(col)).map(col => (
              <th key={col} className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-left whitespace-nowrap">{col}</th>
            ))}
            <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-left w-32 whitespace-nowrap">
              <div className="relative">
                Status
                {/* Quick status filter — placeholder, could extend */}
              </div>
            </th>
            <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-left w-32 whitespace-nowrap">
              <div className="relative flex items-center gap-2">
                Actions
                <div className="relative" ref={columnMenuRef}>
                  <button onClick={() => setShowColumnMenu(!showColumnMenu)} className="p-0.5 hover:bg-slate-200 rounded transition-colors">
                    <Columns size={12} className="text-slate-400" />
                  </button>
                  <AssetColumnChooser
                    visibleColumns={visibleColumns}
                    onToggleColumn={onToggleColumn}
                    activePreset={activePreset}
                    onApplyPreset={onApplyPreset}
                    availableCustomFields={availableCustomFields}
                    show={showColumnMenu}
                    onClose={() => setShowColumnMenu(false)}
                    viewPresets={VIEW_PRESETS}
                  />
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assets.length === 0 ? (
            <AssetEmptyState onClear={onClearFilters} />
          ) : (
            assets.map(asset => (
              <AssetTableRow
                key={asset.id}
                asset={asset}
                isExpanded={expandedAssetId === asset.id}
                isSelected={selection.isSelected(asset.id)}
                isDragging={draggingAssetId === asset.id}
                viewMode={viewMode}
                visibleColumns={visibleColumns}
                onToggleSelect={selection.toggle}
                onExpand={onExpand}
                onAction={(panel) => handleActionClick(asset.id, panel)}
                onDragStart={handleDragStart}
                onDragEnd={onDragEnd}
                onMouseEnter={() => {}}
                onMouseLeave={() => {}}
                assetCategories={assetCategories}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
