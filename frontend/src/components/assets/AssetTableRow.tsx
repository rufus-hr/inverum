import React, { useRef } from 'react';
import { useNavigate } from 'react-router';
import type { Asset } from '../../types';
import { Laptop, Monitor, Smartphone, Server, Box as BoxIcon, Car, GripVertical, ClipboardCheck } from 'lucide-react';

const STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500',
  in_stock: 'bg-blue-500',
  in_service: 'bg-amber-500',
  pending: 'bg-yellow-500',
  retired: 'bg-slate-400',
};

function getAssetIcon(type: string, size: number) {
  const icons: Record<string, React.ReactNode> = {
    Laptop: <Laptop size={size} />,
    Monitor: <Monitor size={size} />,
    'Mobile Phone': <Smartphone size={size} />,
    Server: <Server size={size} />,
    Switch: <Server size={size} />,
    Vehicle: <Car size={size} />,
  };
  return icons[type] ?? <BoxIcon size={size} />;
}

interface AssetTableRowProps {
  asset: Asset;
  isExpanded: boolean;
  isSelected: boolean;
  isDragging: boolean;
  viewMode: 'touch' | 'standard' | 'compact';
  visibleColumns: Set<string>;
  onToggleSelect: (id: string) => void;
  onExpand: (id: string) => void;
  onAction: (panel: 'edit' | 'history' | 'details') => void;
  onDragStart: (e: React.DragEvent, asset: Asset) => void;
  onDragEnd: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  assetCategories: { id: string; label: string; icon: React.ReactNode; types: string[] }[];
}

export function AssetTableRow({
  asset, isExpanded, isSelected, isDragging, viewMode, visibleColumns,
  onToggleSelect, onExpand, onAction, onDragStart, onDragEnd,
  onMouseEnter, onMouseLeave, assetCategories,
}: AssetTableRowProps) {
  const navigate = useNavigate();
  const pyClass = viewMode === 'touch' ? 'py-5' : viewMode === 'compact' ? 'py-1.5' : 'py-3';
  const checkboxSize = viewMode === 'touch' ? 'w-6 h-6' : 'w-4 h-4';
  const iconSize = viewMode === 'touch' ? 20 : 16;
  const imgSizeClass = viewMode === 'touch' ? 'w-10 h-10' : viewMode === 'compact' ? 'w-6 h-6' : 'w-8 h-8';
  const showSubtitles = viewMode !== 'compact';
  const statusColor = STATUS_DOT[asset.status] || 'bg-slate-400';

  const categoryIcon = assetCategories.find(c => c.types.includes(asset.type))?.icon;

  return (
    <tr
      key={asset.id}
      draggable
      onDragStart={(e) => onDragStart(e, asset)}
      onDragEnd={onDragEnd}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`group relative transition-all duration-200 hover:shadow-md
        ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50'}
        ${isSelected && !isExpanded ? 'bg-blue-50/30' : ''}
        ${isDragging ? 'opacity-50 bg-slate-100' : ''}`
      }
    >
      {/* Checkbox & Status Line */}
      <td className={`px-4 ${pyClass} text-left w-12 relative`}>
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColor} opacity-80 group-hover:opacity-100 transition-opacity`} />
        <input
          type="checkbox"
          className={`rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${checkboxSize}`}
          checked={isSelected}
          onChange={() => onToggleSelect(asset.id)}
        />
      </td>

      {/* Drag Handle & Icon */}
      <td className={`px-4 ${pyClass} w-16 text-left`}>
        <div className="flex items-center gap-2">
          <GripVertical size={16} className="text-slate-300 cursor-grab active:cursor-grabbing hover:text-slate-500" />
          <div className="relative group/img z-10 hover:z-50">
            <div className={`p-1.5 rounded-md text-slate-500 bg-slate-50 border border-slate-200 shadow-sm transition-colors ${asset.imageUrl ? 'group-hover/img:bg-blue-50 group-hover/img:text-blue-600 group-hover/img:border-blue-200 cursor-help' : ''}`}>
              {getAssetIcon(asset.type, iconSize)}
            </div>
            {asset.imageUrl && (
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 w-48 opacity-0 group-hover/img:opacity-100 pointer-events-none transition-all duration-200 bg-white p-1.5 rounded-xl shadow-2xl border border-slate-200 scale-95 group-hover/img:scale-100 origin-left">
                <img src={asset.imageUrl} alt={asset.name} className="w-full h-32 object-cover rounded-lg bg-slate-50" referrerPolicy="no-referrer" />
                <div className="text-center text-xs font-medium text-slate-700 mt-2 mb-1">{asset.name}</div>
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Inventory Number */}
      <td className={`px-4 ${pyClass} w-40 text-left whitespace-nowrap`}>
        <div className="flex flex-col">
          <span className="font-mono text-sm font-medium text-slate-800">{asset.inventoryNumber}</span>
          {showSubtitles && <span className="text-xs text-slate-400">INV</span>}
        </div>
      </td>

      {/* Name */}
      <td className={`px-4 ${pyClass}`}>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-800">{asset.name}</span>
          {showSubtitles && (
            <div className="flex items-center gap-1.5">
              {categoryIcon && <span className="text-xs text-slate-400">{categoryIcon}</span>}
              <span className="text-xs text-slate-400">{asset.type}</span>
            </div>
          )}
        </div>
      </td>

      {/* Dynamic columns */}
      {visibleColumns.has('type') && (
        <td className={`px-4 ${pyClass} w-32 whitespace-nowrap`}>
          <span className="text-sm text-slate-600">{asset.type}</span>
        </td>
      )}
      {visibleColumns.has('assignee') && (
        <td className={`px-4 ${pyClass} w-36 whitespace-nowrap`}>
          <span className="text-sm text-slate-600">{asset.assignee}</span>
        </td>
      )}
      {visibleColumns.has('location') && (
        <td className={`px-4 ${pyClass} whitespace-nowrap`}>
          <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{asset.locId}</span>
        </td>
      )}

      {/* Custom field columns */}
      {asset.custom_fields && Object.keys(asset.custom_fields).filter(col => visibleColumns.has(col)).map(col => (
        <td key={col} className={`px-4 ${pyClass} whitespace-nowrap`}>
          <span className="text-sm text-slate-600">{asset.custom_fields![col]}</span>
        </td>
      ))}

      {/* Status badge */}
      <td className={`px-4 ${pyClass} w-32 whitespace-nowrap`}>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border
          ${asset.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' :
            asset.status === 'in_stock' ? 'bg-blue-50 text-blue-700 border-blue-200/50' :
            asset.status === 'in_service' ? 'bg-amber-50 text-amber-700 border-amber-200/50' :
            asset.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200/50' :
            'bg-slate-100 text-slate-600 border-slate-200/50'}`
        }>
          <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
          {asset.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </span>
        {(asset.is_checklist_pending || asset.pending_sop) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/checklists');
            }}
            title="SOP Checklist pending — click to open Checklists"
            className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full border border-amber-300 transition-colors cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <ClipboardCheck size={10} />
            {asset.pending_sop || 'In Process · SOP'}
          </button>
        )}
      </td>

      {/* Actions */}
      <td className={`px-4 ${pyClass} w-32 text-left whitespace-nowrap`}>
        <div className="flex items-center gap-1">
          <button onClick={() => onAction('edit')} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Edit">
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          <button onClick={() => onAction('history')} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="History">
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          </button>
          <button onClick={() => onAction('details')} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Details">
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
