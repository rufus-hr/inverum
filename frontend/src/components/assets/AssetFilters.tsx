import React, { useRef, useState, useEffect } from 'react';
import { Search, Filter, X, CheckCircle2 } from 'lucide-react';
import type { AssetStatus } from '../../types';
import type { UseAssetFiltersReturn } from '../../hooks/useAssetFilters';

interface AssetFiltersProps {
  filters: UseAssetFiltersReturn;
  availableCustomFields: Record<string, string[]>;
  assetCategories: { id: string; label: string; icon: React.ReactNode; types: string[] }[];
}

export function AssetFilters({ filters, availableCustomFields, assetCategories }: AssetFiltersProps) {
  const {
    searchQuery, setSearchQuery,
    selectedTypes, toggleType, toggleCategory,
    selectedStatuses, toggleStatus,
    dynamicFilters, setDynamicFilters,
    clearAll, hasActiveFilters, activeDynamicFiltersCount,
  } = filters;

  const [showTypeFilters, setShowTypeFilters] = useState(false);
  const [showStatusFilters, setShowStatusFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const typeFiltersRef = useRef<HTMLDivElement>(null);
  const statusFiltersRef = useRef<HTMLDivElement>(null);
  const advancedFiltersRef = useRef<HTMLDivElement>(null);

  // Click-outside handler
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (typeFiltersRef.current && !typeFiltersRef.current.contains(e.target as Node)) setShowTypeFilters(false);
      if (statusFiltersRef.current && !statusFiltersRef.current.contains(e.target as Node)) setShowStatusFilters(false);
      if (advancedFiltersRef.current && !advancedFiltersRef.current.contains(e.target as Node)) setShowAdvancedFilters(false);
    };
    if (showTypeFilters || showStatusFilters || showAdvancedFilters) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [showTypeFilters, showStatusFilters, showAdvancedFilters]);

  return (
    <div className="mb-6 space-y-3">
      {/* Search + Filter row */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets by name, inventory number..."
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Type filter */}
        <div className="relative" ref={typeFiltersRef}>
          <button
            onClick={() => setShowTypeFilters(!showTypeFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors shadow-sm
              ${selectedTypes.size > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Type
            {selectedTypes.size > 0 && (
              <span className="flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full ml-1">
                {selectedTypes.size}
              </span>
            )}
          </button>
          {showTypeFilters && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200 shadow-xl rounded-xl p-3 z-50">
              {assetCategories.map(cat => {
                const categoryTypes = cat.types;
                const allSelected = cat.types.every(t => selectedTypes.has(t));
                const someSelected = cat.types.some(t => selectedTypes.has(t));
                return (
                  <div key={cat.id} className="mb-3 last:mb-0">
                    <div
                      className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors"
                      onClick={() => toggleCategory(categoryTypes)}
                    >
                      <input type="checkbox" checked={allSelected} ref={input => { if (input) input.indeterminate = someSelected && !allSelected; }} readOnly className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      {cat.icon} {cat.label}
                    </div>
                    <div className="space-y-1.5 pl-7">
                      {cat.types.map(type => (
                        <label key={type} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
                          <input type="checkbox" checked={selectedTypes.has(type)} onChange={() => toggleType(type)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                          {type}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status filter */}
        <div className="relative" ref={statusFiltersRef}>
          <button
            onClick={() => setShowStatusFilters(!showStatusFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors shadow-sm
              ${selectedStatuses.size > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <CheckCircle2 size={14} />
            Asset Status
            {selectedStatuses.size > 0 && (
              <span className="flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full ml-1">{selectedStatuses.size}</span>
            )}
          </button>
          {showStatusFilters && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200 shadow-xl rounded-xl p-2 z-50">
              {['active', 'in_stock', 'in_service', 'pending', 'retired'].map(status => (
                <label key={status} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${selectedStatuses.has(status as AssetStatus) ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                  <input type="checkbox" checked={selectedStatuses.has(status as AssetStatus)} onChange={() => toggleStatus(status as AssetStatus)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                  {status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Advanced filters */}
        <div className="relative" ref={advancedFiltersRef}>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border transition-colors shadow-sm
              ${showAdvancedFilters || activeDynamicFiltersCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          >
            <Filter size={16} />
            Advanced
            {activeDynamicFiltersCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-blue-600 text-white rounded-full">{activeDynamicFiltersCount}</span>
            )}
          </button>
          {showAdvancedFilters && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 shadow-xl rounded-xl p-5 z-50 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800">Advanced Filters</h3>
                <button onClick={() => setShowAdvancedFilters(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <div className="space-y-4">
                {Object.entries(availableCustomFields).map(([key, values]) => (
                  <div key={key}>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{key}</label>
                    <select
                      value={dynamicFilters[key] || ''}
                      onChange={(e) => setDynamicFilters({...dynamicFilters, [key]: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                    >
                      <option value="">Any {key}</option>
                      {values.map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Clear all */}
        {hasActiveFilters && (
          <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-600 font-medium ml-auto">
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
