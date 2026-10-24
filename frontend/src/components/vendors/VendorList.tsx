import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Building2, Search, Plus, X, Check, ChevronDown,
  BarChart3, Filter, ArrowUpDown,
} from 'lucide-react';
import {
  Vendor,
  VendorType,
  ListMode,
  VENDOR_TYPE_LABELS,
  ALL_VENDOR_TYPES,
  ReliabilityBar,
  TypeChip,
  TypeChips,
  formatCurrency,
} from './VendorTypesAndHelpers';

export function VendorListScreen({
  vendors,
  onSelectVendor,
  onNewVendor,
}: {
  vendors: Vendor[];
  onSelectVendor: (id: string) => void;
  onNewVendor: () => void;
}) {
  const [listMode, setListMode] = useState<ListMode>('list');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<VendorType[]>([]);
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [contractDropdownOpen, setContractDropdownOpen] = useState(false);
  const [sortField, setSortField] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && search) {
        e.stopPropagation();
        setSearch('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [search]);

  const toggleTypeFilter = (t: VendorType) => {
    setTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const filtered = useMemo(() => {
    let result = vendors.filter(v => !v.isArchived);

    if (typeFilter.length > 0) {
      result = result.filter(v => v.types.some(t => typeFilter.includes(t)));
    }

    if (contractFilter !== 'all') {
      if (contractFilter === 'active') {
        result = result.filter(v => v.contracts.some(c => c.status === 'active'));
      } else if (contractFilter === 'expiring') {
        result = result.filter(v => v.contracts.some(c => c.status === 'expiring'));
      } else if (contractFilter === 'expired') {
        result = result.filter(v => v.contracts.some(c => c.status === 'expired'));
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.oib.includes(q) ||
        v.contacts.some(c => c.email.toLowerCase().includes(q))
      );
    }

    return result;
  }, [vendors, typeFilter, contractFilter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'assets': cmp = a.assetCount - b.assetCount; break;
        case 'spend': cmp = a.spend - b.spend; break;
        case 'wo': cmp = a.openWO - b.openWO; break;
        case 'reliability': cmp = (a.reliability ?? -1) - (b.reliability ?? -1); break;
        default: cmp = a.name.localeCompare(b.name);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortField, sortDir]);

  const matrixVendors = useMemo(() => {
    return filtered
      .filter(v => v.reliability !== null && v.serviceRecords.length >= 3)
      .sort((a, b) => (b.reliability ?? 0) - (a.reliability ?? 0));
  }, [filtered]);

  const totalSpend = filtered.reduce((s, v) => s + v.spend, 0);
  const activeContracts = filtered.reduce((s, v) => s + v.contracts.filter(c => c.status === 'active' || c.status === 'expiring').length, 0);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ field, children, className = '' }: { field: string; children: React.ReactNode; className?: string }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <ArrowUpDown className="w-3 h-3" />
        )}
      </div>
    </th>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
          <button
            onClick={onNewVendor}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Vendor
          </button>
        </div>
        <p className="text-sm text-slate-500">
          {filtered.length} vendor{filtered.length !== 1 ? 's' : ''} &middot; {formatCurrency(totalSpend)} total spend &middot; {activeContracts} active contract{activeContracts !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters toolbar */}
      <div className="px-6 pb-4 flex items-center gap-3 flex-wrap">
        {/* Type filter */}
        <div className="relative">
          <button
            onClick={() => { setTypeDropdownOpen(!typeDropdownOpen); setContractDropdownOpen(false); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-700">
              {typeFilter.length > 0 ? `Type (${typeFilter.length})` : 'Type'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {typeDropdownOpen && (
            <div className="absolute z-20 mt-1 w-48 bg-white border border-slate-200 rounded-md shadow-lg py-1">
              {ALL_VENDOR_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => toggleTypeFilter(t)}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <TypeChip type={t} />
                  </div>
                  {typeFilter.includes(t) && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
              {typeFilter.length > 0 && (
                <>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    onClick={() => { setTypeFilter([]); setTypeDropdownOpen(false); }}
                    className="w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50"
                  >
                    Clear filter
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Contract status filter */}
        <div className="relative">
          <button
            onClick={() => { setContractDropdownOpen(!contractDropdownOpen); setTypeDropdownOpen(false); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <span className="text-slate-700">
              {contractFilter !== 'all' ? `Contracts: ${contractFilter}` : 'Contract status'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {contractDropdownOpen && (
            <div className="absolute z-20 mt-1 w-48 bg-white border border-slate-200 rounded-md shadow-lg py-1">
              {['all', 'active', 'expiring', 'expired'].map(s => (
                <button
                  key={s}
                  onClick={() => { setContractFilter(s); setContractDropdownOpen(false); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center justify-between"
                >
                  <span className="capitalize">{s === 'all' ? 'All' : s === 'expiring' ? 'Expiring 90d' : s}</span>
                  {contractFilter === s && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, OIB, email..."
            className="w-full pl-9 pr-8 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center border border-slate-300 rounded-md overflow-hidden ml-auto">
          <button
            onClick={() => setListMode('list')}
            className={`px-3 py-1.5 text-sm font-medium ${listMode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
            title="List view"
          >
            <span className="font-mono text-xs">&#8801;</span> List
          </button>
          <button
            onClick={() => setListMode('matrix')}
            className={`px-3 py-1.5 text-sm font-medium border-l border-slate-300 ${listMode === 'matrix' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Reliability Matrix"
          >
            <BarChart3 className="w-3.5 h-3.5 inline mr-1" /> Matrix
          </button>
        </div>
      </div>

      {/* Click-away for dropdowns */}
      {(typeDropdownOpen || contractDropdownOpen) && (
        <div className="fixed inset-0 z-10" onClick={() => { setTypeDropdownOpen(false); setContractDropdownOpen(false); }} />
      )}

      {/* Active filter chips */}
      {(typeFilter.length > 0 || contractFilter !== 'all') && (
        <div className="px-6 pb-3 flex items-center gap-2 flex-wrap">
          {typeFilter.map(t => (
            <button
              key={t}
              onClick={() => toggleTypeFilter(t)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
            >
              {VENDOR_TYPE_LABELS[t]}
              <X className="w-3 h-3" />
            </button>
          ))}
          {contractFilter !== 'all' && (
            <button
              onClick={() => setContractFilter('all')}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
            >
              Contracts: {contractFilter}
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => { setTypeFilter([]); setContractFilter('all'); }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mb-4" />
            {vendors.length === 0 ? (
              <>
                <h3 className="text-lg font-medium text-slate-900 mb-2">Add your first vendor</h3>
                <p className="text-sm text-slate-500 mb-4 max-w-md">
                  Track your equipment suppliers, service partners, and carriers.
                </p>
                <button
                  onClick={onNewVendor}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Vendor
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No vendors match these filters</h3>
                <p className="text-sm text-slate-500 mb-4">Try adjusting your filters or search terms.</p>
                <button
                  onClick={() => { setTypeFilter([]); setContractFilter('all'); setSearch(''); }}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : listMode === 'list' ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <SortHeader field="name" className="w-[28%]">Name</SortHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Types</th>
                  <SortHeader field="assets">Assets</SortHeader>
                  <SortHeader field="spend">Spend</SortHeader>
                  <SortHeader field="wo">Open WO</SortHeader>
                  <SortHeader field="reliability">Reliability</SortHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map(v => (
                  <tr
                    key={v.id}
                    onClick={() => onSelectVendor(v.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{v.name}</span>
                        {v.types.includes('manufacturer') && <span className="text-slate-400" title="Manufacturer">&#9881;</span>}
                        {v.types.includes('carrier') && <span className="text-slate-400" title="Carrier">&#128230;</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TypeChips types={v.types} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {v.assetCount > 0 ? v.assetCount : <span className="text-slate-400">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {v.spend > 0 ? formatCurrency(v.spend) : <span className="text-slate-400">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {v.openWO > 0 ? (
                        <span className="font-medium text-blue-600">{v.openWO}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ReliabilityBar score={v.reliability} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          matrixVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BarChart3 className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No reliability data available</h3>
              <p className="text-sm text-slate-500 max-w-md">
                Vendors need at least 3 closed work orders to appear in the Reliability Matrix.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[35%]">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Failure Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Avg MTTR</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixVendors.map(v => (
                    <tr
                      key={v.id}
                      onClick={() => onSelectVendor(v.id)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{v.name}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{v.failureRate}%</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{v.mttr}d</td>
                      <td className="px-4 py-3">
                        <ReliabilityBar score={v.reliability} size="lg" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
