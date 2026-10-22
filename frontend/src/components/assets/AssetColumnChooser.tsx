import React, { useRef } from 'react';
import {
  Columns, AlignJustify, Server, Smartphone, Car, Laptop,
} from 'lucide-react';

interface ViewPreset {
  id: string;
  name: string;
  icon: React.ReactNode;
  types: string[];
  columns: string[];
}

interface AssetColumnChooserProps {
  visibleColumns: Set<string>;
  onToggleColumn: (col: string) => void;
  activePreset: string;
  onApplyPreset: (presetId: string) => void;
  availableCustomFields: string[];
  show: boolean;
  onClose: () => void;
  viewPresets: ViewPreset[];
}

export function AssetColumnChooser({
  visibleColumns, onToggleColumn, activePreset, onApplyPreset,
  availableCustomFields, show, onClose, viewPresets,
}: AssetColumnChooserProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  if (!show) return null;

  const standardColumns = ['type', 'assignee', 'location'];

  return (
    <div
      ref={menuRef}
      className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 shadow-xl rounded-xl p-4 z-50"
    >
      {/* View Presets */}
      <div className="mb-4">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">View Presets</h4>
        <div className="flex flex-wrap gap-2">
          {viewPresets.map(preset => (
            <button
              key={preset.id}
              onClick={() => onApplyPreset(preset.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors
                ${activePreset === preset.id
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {preset.icon}
              {preset.name.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Standard columns */}
      <div className="mb-3">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Standard Columns</h4>
        <div className="space-y-1">
          {standardColumns.map(col => (
            <label key={col} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 py-0.5">
              <input
                type="checkbox"
                checked={visibleColumns.has(col)}
                onChange={() => onToggleColumn(col)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="capitalize">{col}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Custom field columns */}
      {availableCustomFields.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Custom Fields</h4>
          <div className="space-y-1">
            {availableCustomFields.map(col => (
              <label key={col} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 py-0.5">
                <input
                  type="checkbox"
                  checked={visibleColumns.has(col)}
                  onChange={() => onToggleColumn(col)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                {col}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
