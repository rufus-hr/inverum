import React, { useState, useRef, useEffect } from 'react';
import { Building2, MapPin, ChevronDown, User, LogOut, X } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useViewFilters, type ViewName, type SupplyType } from '../store/viewFilters';
import { getLastTenantSlug } from '../lib/api';
import type { TreeNodeData } from '../types';

interface TopbarProps {
  activeView: string | null;
  orgTree?: TreeNodeData[];
  locTree?: TreeNodeData[];
}

export default function Topbar({ activeView, orgTree = [], locTree = [] }: TopbarProps) {
  const initialLocTree = locTree;
  const { logout, user } = useAuthStore();
  const { filters, setOrgFilter, setLocationFilter, setSupplyTypeFilter, clearFilters } = useViewFilters();

  const [orgOpen, setOrgOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const orgRef = useRef<HTMLDivElement>(null);
  const locRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) setOrgOpen(false);
      if (locRef.current && !locRef.current.contains(e.target as Node)) setLocOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 'supply' in App.tsx maps to 'supplies' in the filter store
  const view: ViewName = activeView === 'supply' ? 'supplies' : (activeView as ViewName) ?? 'assets';
  const currentFilter = filters[view] ?? { orgId: null, orgLabel: null, locationId: null, locationLabel: null, supplyType: null };
  const hasOrgFilter = !!currentFilter.orgId;
  const hasLocFilter = !!currentFilter.locationId;
  const supplyType = currentFilter.supplyType;

  const SUPPLY_SEGMENTS: { id: SupplyType; label: string }[] = [
    { id: 'consumable', label: 'Consumables' },
    { id: 'stock_item', label: 'Stock items' },
    { id: 'accessory', label: 'Accessories' },
  ];

  const handleOrgSelect = (node: TreeNodeData) => {
    setOrgFilter(view as ViewName, node.id, node.label);
    setOrgOpen(false);
  };

  const handleLocSelect = (node: TreeNodeData) => {
    setLocationFilter(view as ViewName, node.id, node.label);
    setLocOpen(false);
  };

  const showFilters = activeView !== null && ['assets', 'supply', 'supplies', 'employees', 'work_orders', 'vendors', 'dashboard'].includes(activeView);
  const showLocFilter = showFilters && activeView !== 'dashboard';
  const showSupplyTypeFilter = activeView === 'supply' || activeView === 'supplies';

  return (
    <header className="h-12 bg-theme-surface border-b border-theme-border flex items-center px-4 gap-3 shrink-0 z-40">
      {/* Tenant badge */}
      <div className="flex items-center gap-2 pr-3 border-r border-theme-border shrink-0">
        <div className="w-5 h-5 bg-theme-text rounded flex items-center justify-center">
          <span className="text-theme-surface text-[9px] font-black">I</span>
        </div>
        <span className="text-xs font-semibold text-theme-text-subtle uppercase tracking-wider">{getLastTenantSlug()}</span>
      </div>

      {/* Org filter */}
      {showFilters && (
        <div ref={orgRef} className="relative">
          <button
            onClick={() => { setOrgOpen(!orgOpen); setLocOpen(false); setUserOpen(false); }}
            className={`flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-md transition-colors
              ${hasOrgFilter
                ? 'bg-theme-primary/10 text-theme-primary border border-theme-primary/30'
                : 'text-theme-text-muted hover:bg-theme-surface-hover border border-transparent'
              }`}
          >
            <Building2 size={13} />
            <span className="max-w-[140px] truncate">
              {hasOrgFilter ? currentFilter.orgLabel : 'Organisation'}
            </span>
            {hasOrgFilter
              ? <X size={12} className="ml-0.5 hover:text-theme-primary" onClick={(e) => { e.stopPropagation(); setOrgFilter(view as ViewName, null, null); }} />
              : <ChevronDown size={13} />
            }
          </button>

          {orgOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-theme-surface border border-theme-border rounded-xl shadow-xl z-50 py-1 max-h-72 overflow-y-auto">
              <TreeDropdown nodes={orgTree} onSelect={handleOrgSelect} selectedId={currentFilter.orgId} maxDepth={activeView === 'dashboard' ? 1 : undefined} />
            </div>
          )}
        </div>
      )}

      {/* Location filter */}
      {showLocFilter && (
        <div ref={locRef} className="relative">
          <button
            onClick={() => { setLocOpen(!locOpen); setOrgOpen(false); setUserOpen(false); }}
            className={`flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-md transition-colors
              ${hasLocFilter
                ? 'bg-theme-primary/10 text-theme-primary border border-theme-primary/30'
                : 'text-theme-text-muted hover:bg-theme-surface-hover border border-transparent'
              }`}
          >
            <MapPin size={13} />
            <span className="max-w-[140px] truncate">
              {hasLocFilter ? currentFilter.locationLabel : 'Location'}
            </span>
            {hasLocFilter
              ? <X size={12} className="ml-0.5 hover:text-theme-primary" onClick={(e) => { e.stopPropagation(); setLocationFilter(view as ViewName, null, null); }} />
              : <ChevronDown size={13} />
            }
          </button>

          {locOpen && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-theme-surface border border-theme-border rounded-xl shadow-xl z-50 py-1 max-h-72 overflow-y-auto">
              <TreeDropdown nodes={initialLocTree} onSelect={handleLocSelect} selectedId={currentFilter.locationId} />
            </div>
          )}
        </div>
      )}

      {/* Supply type segmented control */}
      {showSupplyTypeFilter && (
        <div className="flex items-center bg-theme-bg rounded-lg p-0.5 gap-0.5">
          {SUPPLY_SEGMENTS.map(seg => (
            <button
              key={seg.id}
              onClick={() => setSupplyTypeFilter('supplies', supplyType === seg.id ? null : seg.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                supplyType === seg.id
                  ? 'bg-theme-surface text-theme-text shadow-sm'
                  : 'text-theme-text-muted hover:text-theme-text'
              }`}
            >
              {seg.label}
            </button>
          ))}
        </div>
      )}

      {/* Clear all — visible only when any filter active */}
      {showFilters && (hasOrgFilter || (showLocFilter && hasLocFilter) || !!supplyType) && (
        <button
          onClick={() => clearFilters(view as ViewName)}
          className="text-xs text-theme-text-subtle hover:text-theme-text transition-colors"
        >
          Clear filters
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User menu */}
      <div ref={userRef} className="relative">
        <button
          onClick={() => { setUserOpen(!userOpen); setOrgOpen(false); setLocOpen(false); }}
          className="flex items-center gap-2 text-sm font-medium text-theme-text-muted hover:text-theme-text px-2 py-1 rounded-md hover:bg-theme-surface-hover transition-colors"
        >
          <div className="w-6 h-6 bg-theme-bg rounded-full flex items-center justify-center">
            <User size={12} className="text-theme-text-muted" />
          </div>
          <span className="text-xs font-semibold text-theme-text-muted">{user?.userId?.slice(0, 8) ?? 'User'}</span>
        </button>

        {userOpen && (
          <div className="absolute top-full right-0 mt-1 w-48 bg-theme-surface border border-theme-border rounded-xl shadow-xl z-50 py-1">
            <div className="px-3 py-2 border-b border-theme-border">
              <p className="text-xs font-semibold text-theme-text">Signed in</p>
              <p className="text-xs text-theme-text-muted truncate">{user?.tenantId}</p>
            </div>
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-theme-danger hover:bg-theme-danger/5 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function TreeDropdown({ nodes, onSelect, selectedId, level = 0, maxDepth }: {
  nodes: TreeNodeData[];
  onSelect: (node: TreeNodeData) => void;
  selectedId: string | null;
  level?: number;
  maxDepth?: number;
}) {
  return (
    <>
      {nodes.map(node => (
        <TreeDropdownItem key={node.id} node={node} onSelect={onSelect} selectedId={selectedId} level={level} maxDepth={maxDepth} />
      ))}
    </>
  );
}

function TreeDropdownItem({ node, onSelect, selectedId, level, maxDepth }: {
  node: TreeNodeData;
  onSelect: (node: TreeNodeData) => void;
  selectedId: string | null;
  level: number;
  maxDepth?: number;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const canExpand = hasChildren && (maxDepth === undefined || level < maxDepth);

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-colors text-sm
          ${selectedId === node.id ? 'bg-theme-primary/10 text-theme-primary font-semibold' : 'text-theme-text hover:bg-theme-surface-hover'}`}
        style={{ paddingLeft: `${(level + 1) * 12}px` }}
        onClick={() => onSelect(node)}
      >
        {canExpand && (
          <ChevronDown
            size={12}
            className={`text-theme-text-subtle transition-transform shrink-0 ${open ? '' : '-rotate-90'}`}
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          />
        )}
        {!canExpand && <span className="w-3" />}
        <span className="truncate">{node.label}</span>
      </div>
      {canExpand && open && (
        <TreeDropdown nodes={node.children!} onSelect={onSelect} selectedId={selectedId} level={level + 1} maxDepth={maxDepth} />
      )}
    </div>
  );
}
