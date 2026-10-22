import { useState, useMemo } from 'react';
import type { Asset, AssetStatus } from '../types';

export interface AssetFilterState {
  searchQuery: string;
  selectedTypes: Set<string>;
  selectedStatuses: Set<AssetStatus>;
  dynamicFilters: Record<string, string>;
  viewMode: 'touch' | 'standard' | 'compact';
}

export interface UseAssetFiltersReturn extends AssetFilterState {
  setSearchQuery: (q: string) => void;
  setSelectedTypes: (types: Set<string>) => void;
  setSelectedStatuses: (statuses: Set<AssetStatus>) => void;
  setDynamicFilters: (filters: Record<string, string>) => void;
  setViewMode: (mode: 'touch' | 'standard' | 'compact') => void;
  toggleType: (type: string) => void;
  toggleCategory: (categoryTypes: string[]) => void;
  toggleStatus: (status: AssetStatus) => void;
  clearAll: () => void;
  hasActiveFilters: boolean;
  activeDynamicFiltersCount: number;
}

export function useAssetFilters(): UseAssetFiltersReturn {
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<AssetStatus>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'touch' | 'standard' | 'compact'>('standard');

  const activeDynamicFiltersCount = Object.values(dynamicFilters).filter(v => v !== '').length;
  const hasActiveFilters = selectedTypes.size > 0 || selectedStatuses.size > 0 || searchQuery !== '' || activeDynamicFiltersCount > 0;

  const clearAll = () => {
    setSelectedTypes(new Set());
    setSelectedStatuses(new Set());
    setSearchQuery('');
    setDynamicFilters({});
  };

  const toggleType = (type: string) => {
    const newSet = new Set(selectedTypes);
    newSet.has(type) ? newSet.delete(type) : newSet.add(type);
    setSelectedTypes(newSet);
  };

  const toggleCategory = (categoryTypes: string[]) => {
    const newSet = new Set(selectedTypes);
    const allSelected = categoryTypes.every(t => newSet.has(t));
    if (allSelected) {
      categoryTypes.forEach(t => newSet.delete(t));
    } else {
      categoryTypes.forEach(t => newSet.add(t));
    }
    setSelectedTypes(newSet);
  };

  const toggleStatus = (status: AssetStatus) => {
    const newSet = new Set(selectedStatuses);
    newSet.has(status) ? newSet.delete(status) : newSet.add(status);
    setSelectedStatuses(newSet);
  };

  return {
    searchQuery,
    selectedTypes,
    selectedStatuses,
    dynamicFilters,
    viewMode,
    setSearchQuery,
    setSelectedTypes,
    setSelectedStatuses,
    setDynamicFilters,
    setViewMode,
    toggleType,
    toggleCategory,
    toggleStatus,
    clearAll,
    hasActiveFilters,
    activeDynamicFiltersCount,
  };
}

export function applyFilters(assets: Asset[], filters: AssetFilterState, orgFilterIds?: Set<string>, locFilterIds?: Set<string>): Asset[] {
  let result = assets;

  if (orgFilterIds && orgFilterIds.size > 0) {
    result = result.filter(a => orgFilterIds.has(a.orgId));
  }
  if (locFilterIds && locFilterIds.size > 0) {
    result = result.filter(a => locFilterIds.has(a.locId));
  }
  if (filters.selectedTypes.size > 0) {
    result = result.filter(a => filters.selectedTypes.has(a.type));
  }
  if (filters.selectedStatuses.size > 0) {
    result = result.filter(a => filters.selectedStatuses.has(a.status as AssetStatus));
  }
  Object.entries(filters.dynamicFilters).forEach(([key, value]) => {
    if (value) {
      result = result.filter(a => a.custom_fields?.[key] === value);
    }
  });
  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    result = result.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.inventoryNumber.toLowerCase().includes(q) ||
      a.assignee.toLowerCase().includes(q)
    );
  }

  return result;
}

export function getAvailableCustomFields(assets: Asset[]): Record<string, string[]> {
  const fields: Record<string, Set<string>> = {};
  assets.forEach(asset => {
    if (asset.custom_fields) {
      Object.entries(asset.custom_fields).forEach(([key, value]) => {
        if (!fields[key]) fields[key] = new Set();
        fields[key].add(value as string);
      });
    }
  });
  const result: Record<string, string[]> = {};
  Object.keys(fields).forEach(key => {
    result[key] = Array.from(fields[key]).sort();
  });
  return result;
}
