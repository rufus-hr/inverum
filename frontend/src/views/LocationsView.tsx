import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Laptop, Search, Edit2, ChevronDown, User, Box, MapPin, X,
  Archive, Server, AlertCircle, CheckCircle2, Plus, Layers, Lock, Inbox, Layout,
} from 'lucide-react';
import { TreeView } from '../components/TreeView';
import { EditLocationModal, AddEntityModal } from '../components/EditModals';
import { ScannerPlacementModal } from '../components/ScannerModal';

import type { Asset, TreeNodeData } from '../types';
import type { PagedResponse, CursorPagedResponse, LocationResponse, AssetResponse } from '../types/api';
import { useApiQuery, useApiMutation } from '../hooks/useApi';
import { apiFetch } from '../lib/api';

/* ─── StorageUnitAssetList (inline, only used here) ──────────────────── */

interface StorageUnitAssetItem {
  name: string;
  inv: string;
  status: string;
  icon?: React.ReactNode;
}

function StorageUnitAssetList({ items, onDragStart, onDragEnd, dragging }: {
  items: StorageUnitAssetItem[];
  onDragStart?: (inv: string) => void;
  onDragEnd?: () => void;
  dragging?: string | null;
}) {
  if (items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Box size={20} className="text-slate-300" />
        </div>
        <p className="text-sm text-slate-500 font-medium">Prazno.</p>
        <p className="text-xs text-slate-400 mt-1">Skenirajte asset za dodavanje</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div
            key={item.inv}
            draggable={!!onDragStart}
            onDragStart={onDragStart ? (e) => {
              e.dataTransfer.effectAllowed = 'move';
              const ghost = document.createElement('div');
              ghost.style.cssText = 'position:absolute;top:-1000px;left:-1000px;';
              ghost.className = 'flex items-center gap-2 bg-slate-900 border border-slate-700 shadow-2xl rounded-lg px-3 py-2 font-mono text-sm font-bold text-white';
              const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></svg>`;
              ghost.innerHTML = `${svgIcon}<span>${item.inv}</span>`;
              document.body.appendChild(ghost);
              e.dataTransfer.setDragImage(ghost, -10, -10);
              setTimeout(() => { onDragStart(item.inv); if (document.body.contains(ghost)) document.body.removeChild(ghost); }, 0);
            } : undefined}
            onDragEnd={onDragEnd}
            className={`flex items-center justify-between px-4 py-3 transition-colors
              ${onDragStart ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
              ${dragging === item.inv ? 'opacity-40 bg-slate-50' : 'hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-slate-400 shrink-0">{item.icon ?? <Laptop size={16} />}</span>
              <div>
                <p className="text-sm font-bold text-slate-900">{item.name}</p>
                <p className="text-xs font-mono text-blue-600 font-bold">{item.inv}</p>
              </div>
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
              item.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' :
              'bg-slate-100 text-slate-600 border border-slate-200/50'
            }`}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── LocationsView ──────────────────────────────────────────────────── */

interface LocationsViewProps {
  assets: Asset[];
}

export function LocationsView({ assets = [] }: Partial<LocationsViewProps> = {}) {
  const [locTree, setLocTree] = useState<TreeNodeData[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch locations and assets from API
  const { data: locsData, refetch: refetchLocations } = useApiQuery<PagedResponse<LocationResponse>>('/locations/?limit=200');
  const { data: apiAssetsData } = useApiQuery<CursorPagedResponse<AssetResponse>>('/assets/?limit=200', { skip: assets.length > 0 });

  const createLocationMutation = useApiMutation<Record<string, any>, LocationResponse>('/locations/', 'POST');
  const updateLocationMutation = useApiMutation<Record<string, any>, LocationResponse>('/locations/', 'PUT');
  const deleteLocationMutation = useApiMutation<void, void>('/locations/', 'DELETE');
  const createStorageUnitMutation = useApiMutation<Record<string, any>, any>('/storage-units/', 'POST');

  useEffect(() => {
    if (!locsData?.items || locsData.items.length === 0) return;
    const data = locsData.items;
    const nodeMap = new Map<string, TreeNodeData>();
    const roots: TreeNodeData[] = [];
    for (const loc of data) {
      nodeMap.set(loc.id, { id: loc.id, label: loc.name, children: [] });
    }
    for (const loc of data) {
      const node = nodeMap.get(loc.id)!;
      if (loc.parent_id && nodeMap.has(loc.parent_id)) {
        nodeMap.get(loc.parent_id)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }
    setLocTree(roots);
    setSelectedLocationId(prev => (prev && nodeMap.has(prev) ? prev : (roots[0]?.id ?? null)));
  }, [locsData]);
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [locationPanelWidth, setLocationPanelWidth] = useState(320);
  const locationPanelResizing = useRef(false);

  const [showWorkspaces, setShowWorkspaces] = useState(true);
  const [showStorageUnits, setShowStorageUnits] = useState(true);
  const [showRacks, setShowRacks] = useState(true);

  const [draggingShelfAsset, setDraggingShelfAsset] = useState<{ inv: string; fromShelf: string } | null>(null);
  const [dragOverShelf, setDragOverShelf] = useState<string | null>(null);

  const [isEditLocationOpen, setIsEditLocationOpen] = useState(false);
  const [isAddEntityOpen, setIsAddEntityOpen] = useState(false);
  const [addEntityParentId, setAddEntityParentId] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // We keep a local copy so shelf drag-drop can update locId
  const [localAssets, setLocalAssets] = useState<Asset[]>(assets);
  useEffect(() => {
    if (assets.length > 0) {
      setLocalAssets(assets);
    } else if (apiAssetsData?.items) {
      setLocalAssets(
        apiAssetsData.items.map(a => ({
          id: a.id,
          inventoryNumber: a.inventory_number ?? a.serial_number ?? a.id.slice(0, 8),
          serialNumber: a.serial_number ?? '',
          name: a.name ?? 'Unnamed Asset',
          type: a.mobility_type ?? 'Asset',
          status: a.status === 'active' ? 'Active' : a.status === 'in_stock' ? 'Storage' : a.status === 'in_service' ? 'In Repair' : a.status,
          assignee: null,
          locId: a.location_id ?? '',
          orgId: a.organization_id,
          legalEntity: a.legal_entity_id ?? '',
        }))
      );
    }
  }, [assets, apiAssetsData]);

  // Compute all descendant location IDs for the currently selected node
  const selectedSubtreeIds = useMemo(() => {
    if (!selectedLocationId) return new Set<string>();
    const ids = new Set<string>([selectedLocationId]);
    const findAndCollect = (nodes: TreeNodeData[], collect: boolean) => {
      for (const n of nodes) {
        const isMatch = collect || n.id === selectedLocationId;
        if (isMatch) ids.add(n.id);
        if (n.children && n.children.length > 0) {
          findAndCollect(n.children, isMatch);
        }
      }
    };
    findAndCollect(locTree, false);
    return ids;
  }, [selectedLocationId, locTree]);

  const filteredLocationAssets = useMemo(() => {
    const byLoc = selectedSubtreeIds.size > 0
      ? localAssets.filter(a => selectedSubtreeIds.has(a.locId))
      : localAssets;
    const list = byLoc.length > 0 ? byLoc : localAssets.slice(0, 15);
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      a => a.name.toLowerCase().includes(q) || a.inventoryNumber.toLowerCase().includes(q)
    );
  }, [localAssets, selectedSubtreeIds, searchQuery]);

  const selectedLocationName = useMemo(() => {
    if (!selectedLocationId) return '';
    const findNode = (nodes: TreeNodeData[]): TreeNodeData | null => {
      for (const node of nodes) {
        if (node.id === selectedLocationId) return node;
        if (node.children) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findNode(locTree)?.label || '';
  }, [selectedLocationId, locTree]);

  const startLocationPanelResize = (e: React.MouseEvent) => {
    e.preventDefault();
    locationPanelResizing.current = true;
    const startX = e.clientX;
    const startWidth = locationPanelWidth;
    const onMove = (ev: MouseEvent) => {
      if (!locationPanelResizing.current) return;
      const next = Math.min(480, Math.max(200, startWidth + ev.clientX - startX));
      setLocationPanelWidth(next);
    };
    const onUp = () => {
      locationPanelResizing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const shelfAssets = useMemo(() =>
    localAssets.reduce((acc, a) => {
      if (a.locId.startsWith('shelf-') || a.locId.startsWith('rack-') || a.locId.startsWith('cab-')) {
        acc[a.locId] = [...(acc[a.locId] ?? []), { name: a.name, inv: a.inventoryNumber, status: a.status }];
      }
      return acc;
    }, {} as Record<string, { name: string; inv: string; status: string }[]>),
    [localAssets]
  );

  // Reset shelf selection when location changes
  useEffect(() => {
    setSelectedShelfId(null);
  }, [selectedLocationId]);

  // 'E' keyboard shortcut for edit location
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key.toLowerCase() === 'e') {
        if (selectedLocationId) {
          setIsEditLocationOpen(true);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLocationId]);

  return (
    <>
      <div className="flex-1 flex overflow-hidden bg-slate-50">
        {/* Left Side - Tree Hierarchy */}
        <div style={{ width: locationPanelWidth }} className="bg-white border-r border-slate-200 flex flex-col h-full shrink-0 relative">
          <div className="p-4 border-b border-slate-100 font-bold text-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm uppercase tracking-wider">
              Location Hierarchy
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowWorkspaces(!showWorkspaces)}
                className={`p-1.5 rounded-md transition-colors ${showWorkspaces ? 'bg-amber-50 text-amber-600' : 'text-slate-400 hover:bg-slate-100'}`}
                title={showWorkspaces ? "Hide Workspaces" : "Show Workspaces"}
              >
                <User size={16} />
              </button>
              <button
                onClick={() => setShowStorageUnits(!showStorageUnits)}
                className={`p-1.5 rounded-md transition-colors ${showStorageUnits ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                title={showStorageUnits ? "Hide Storage Units" : "Show Storage Units"}
              >
                <Archive size={16} />
              </button>
              <button
                onClick={() => setShowRacks(!showRacks)}
                className={`p-1.5 rounded-md transition-colors ${showRacks ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-100'}`}
                title={showRacks ? "Hide Racks" : "Show Racks"}
              >
                <Server size={16} />
              </button>
              <div className="w-px h-4 bg-slate-200 mx-1"></div>
              <button
                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors"
                title="Add Root Location"
                onClick={() => {
                  setAddEntityParentId('root');
                  setIsAddEntityOpen(true);
                }}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="p-2 flex-1 overflow-y-auto">
            <TreeView
              data={locTree}
              onSelect={(node) => {
                setSelectedLocationId(node.id);
              }}
              selectedId={selectedLocationId}
              onAdd={(id) => {
                setAddEntityParentId(id);
                setIsAddEntityOpen(true);
              }}
              showWorkspaces={showWorkspaces}
              showStorageUnits={showStorageUnits}
              showRacks={showRacks}
            />
          </div>
          {/* Resize handle */}
          <div
            onMouseDown={startLocationPanelResize}
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors z-10"
          />
        </div>
        <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden">
          {selectedLocationId ? (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Contextual Header */}
                <div className="px-8 py-6 bg-white border-b border-slate-200 shrink-0">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
                      {(() => {
                        if (selectedLocationId.startsWith('ws')) return <User size={24} />;
                        if (selectedLocationId.startsWith('rack')) return <Server size={24} />;
                        if (selectedLocationId.startsWith('cab')) return <Archive size={24} />;
                        if (selectedLocationId.startsWith('safe')) return <Lock size={24} />;
                        if (selectedLocationId.startsWith('shelf')) return <Layers size={24} />;
                        if (selectedLocationId.startsWith('drawer')) return <Inbox size={24} />;
                        return <MapPin size={24} />;
                      })()}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-slate-900">
                          {(() => {
                            const findNode = (nodes: TreeNodeData[]): TreeNodeData | null => {
                              for (const node of nodes) {
                                if (node.id === selectedLocationId) return node;
                                if (node.children) {
                                  const found = findNode(node.children);
                                  if (found) return found;
                                }
                              }
                              return null;
                            };
                            return findNode(locTree)?.label || 'Details';
                          })()}
                        </h2>
                        <button
                          onClick={() => setIsEditLocationOpen(true)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                      <p className="text-slate-500 text-sm font-medium">
                        {selectedLocationId.startsWith('ws') ? 'Workspace' :
                         selectedLocationId.startsWith('rack') ? 'Rack Unit' :
                         selectedLocationId.startsWith('cab') ? 'Storage Cabinet' :
                         selectedLocationId.startsWith('safe') ? 'Security Safe' :
                         selectedLocationId.startsWith('shelf') ? 'Storage Shelf' :
                         selectedLocationId.startsWith('drawer') ? 'Storage Drawer' :
                         'Location'} • ID: {selectedLocationId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Floor Plan Trigger */}
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-bold text-sm transition-all shadow-sm">
                      <Layout size={16} className="text-blue-600" />
                      Floor plan
                    </button>
                  </div>
                </div>

                {/* Contextual Filters / Info */}
                {!selectedLocationId.startsWith('ws') && !selectedLocationId.startsWith('rack') && !selectedLocationId.startsWith('cab') && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">
                        Asset Categories <ChevronDown size={14} />
                      </button>
                      <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">
                        Asset Status <ChevronDown size={14} />
                      </button>
                    </div>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search assets in this location..."
                        className="pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-0 rounded-lg text-sm w-64 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Contextual Content */}
              <div className="flex-1 overflow-y-auto p-8">
                {selectedLocationId.startsWith('ws') ? (
                  /* Workplace View */
                  <div className="max-w-2xl space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Assignee</h4>
                        <div className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            IŠ
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">Ivan Štimac</p>
                            <p className="text-xs text-slate-500">IT Department</p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Workspace Info</h4>
                        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Shared desk profile:</span>
                            <span className="font-bold text-slate-900">&mdash;</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Location:</span>
                            <span className="font-bold text-slate-900">Soba 101, Kat 1</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Assigned Assets</h4>
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                          <tbody className="divide-y divide-slate-100">
                            {localAssets.slice(0, 2).map(asset => (
                              <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                                      <Laptop size={16} />
                                    </div>
                                    <div>
                                      <p className="font-bold text-slate-900">{asset.name}</p>
                                      <p className="text-[10px] font-mono text-blue-600 font-bold">{asset.inventoryNumber}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                                    ACTIVE
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : selectedLocationId.startsWith('rack') ? (
                  /* Rack View */
                  <div className="max-w-2xl space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Security Level</h4>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(i => (
                              <div key={i} className={`w-3 h-3 rounded-full ${i <= 4 ? 'bg-slate-900' : 'border-2 border-slate-200'}`} />
                            ))}
                          </div>
                          <span className="text-sm font-bold text-slate-900 ml-2">4/5</span>
                        </div>
                        <p className="text-xs text-slate-500">High security zone. Access restricted to IT Infra.</p>
                      </div>
                      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Rack Capacity</h4>
                        <div className="flex items-end gap-2 mb-2">
                          <span className="text-3xl font-bold text-slate-900">42</span>
                          <span className="text-sm font-bold text-slate-400 mb-1">U</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full w-1/3" />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 font-medium">14U used of 42U total</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rack Content</h4>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                          <CheckCircle2 size={12} />
                          All systems operational
                        </div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl p-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Server size={14} className="text-slate-400" />
                              <div>
                                <p className="text-xs font-bold text-slate-800">Dell PowerEdge R740</p>
                                <p className="text-[9px] font-mono text-blue-600 font-bold">IT-SRV-001</p>
                              </div>
                            </div>
                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">in_service</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Server size={14} className="text-slate-400" />
                              <div>
                                <p className="text-xs font-bold text-slate-800">HP ProLiant DL380</p>
                                <p className="text-[9px] font-mono text-blue-600 font-bold">IT-SRV-002</p>
                              </div>
                            </div>
                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">in_service</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (selectedLocationId.startsWith('cab') || selectedLocationId.startsWith('safe') || selectedLocationId.startsWith('shelf') || selectedLocationId.startsWith('drawer')) ? (
                  /* Storage Unit View */
                  <div className="max-w-2xl space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Security Level</h4>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(i => (
                              <div key={i} className={`w-3 h-3 rounded-full ${i <= 2 ? 'bg-slate-900' : 'border-2 border-slate-200'}`} />
                            ))}
                          </div>
                          <span className="text-sm font-bold text-slate-900 ml-2">2/5</span>
                        </div>
                        <p className="text-xs text-slate-500">Standard storage protocols.</p>
                      </div>
                      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Storage Info</h4>
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <Box size={24} />
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-slate-900">{selectedLocationId === 'cab-regal' ? '3' : '12'}</p>
                            <p className="text-xs text-slate-500 font-medium">Total assets in unit</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unit Content</h4>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                          <AlertCircle size={12} />
                          Audit due in 14 days
                        </div>
                      </div>

                      {selectedLocationId === 'cab-regal' ? (
                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                          <h5 className="text-sm font-bold text-slate-800 mb-4">Internal Structure (3x4 Grid)</h5>
                          <div className="grid grid-cols-3 gap-2">
                            {['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3', 'A4', 'B4', 'C4'].map((cell) => {
                              const shelfKey = `shelf-${cell.toLowerCase()}`;
                              const cellItems = shelfAssets[shelfKey] ?? [];
                              const count = cellItems.length;
                              const isSelected = selectedShelfId === shelfKey;
                              const isDragOver = dragOverShelf === shelfKey;
                              return (
                                <div
                                  key={cell}
                                  onClick={() => setSelectedShelfId(shelfKey)}
                                  onDragOver={(e) => { e.preventDefault(); setDragOverShelf(shelfKey); }}
                                  onDragLeave={() => setDragOverShelf(null)}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOverShelf(null);
                                    if (!draggingShelfAsset || draggingShelfAsset.fromShelf === shelfKey) return;
                                    const { inv } = draggingShelfAsset;
                                    const matched = localAssets.find(a => a.inventoryNumber === inv);
                                    setLocalAssets(prev => prev.map(a =>
                                      a.inventoryNumber === inv ? { ...a, locId: shelfKey } : a
                                    ));
                                    setDraggingShelfAsset(null);
                                    if (matched) {
                                      void apiFetch(`/assets/${matched.id}`, {
                                        method: 'PUT',
                                        body: JSON.stringify({
                                          custom_fields: { ...(matched.custom_fields || {}), shelf: shelfKey },
                                        }),
                                      }).catch(() => {});
                                    }
                                  }}
                                  className={`relative border rounded-lg p-3 cursor-pointer transition-colors group overflow-hidden
                                    ${isSelected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' :
                                      isDragOver ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400' :
                                      'border-slate-200 hover:border-blue-500 hover:bg-blue-50'}`}
                                >
                                  <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg transition-colors
                                    ${isDragOver ? 'bg-emerald-400' : count > 0 ? 'bg-blue-500' : 'bg-slate-200'}`} />
                                  <div className="flex justify-between items-center pl-1">
                                    <span className={`text-sm font-extrabold ${isSelected ? 'text-blue-700' : isDragOver ? 'text-emerald-700' : 'text-slate-600 group-hover:text-blue-700'}`}>{cell}</span>
                                    {count > 0 && (
                                      <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded ${isSelected ? 'bg-blue-200 text-blue-800' : isDragOver ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                        {count}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <StorageUnitAssetList items={[
                          { name: 'Lenovo T14 Gen3', inv: 'IT-LAP-300018', status: 'Storage' },
                          { name: 'Dell Latitude 5530', inv: 'IT-LAP-300022', status: 'Active' },
                        ]} />
                      )}
                    </div>
                  </div>
                ) : (
                  /* General Location View (Floor, Room, etc.) */
                  <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-widest border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-4">Inv. Number</th>
                            <th className="px-6 py-4">Asset Name</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Assignee</th>
                            <th className="px-6 py-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredLocationAssets.map(asset => (
                            <tr key={asset.id} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                              <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">{asset.inventoryNumber}</td>
                              <td className="px-6 py-4 font-bold text-slate-900">{asset.name}</td>
                              <td className="px-6 py-4 text-slate-500">{asset.type}</td>
                              <td className="px-6 py-4 text-slate-600 font-medium">{asset.assignee || '-'}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider
                                  ${asset.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' :
                                    asset.status === 'In Repair' ? 'bg-amber-50 text-amber-700 border border-amber-200/50' :
                                    asset.status === 'Pending Checklist' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/50' :
                                    'bg-slate-100 text-slate-700 border border-slate-200/50'}`}
                                >
                                  {asset.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Shelf Details */}
            {selectedLocationId === 'cab-regal' && selectedShelfId && (
              <div className="w-1/2 border-l border-slate-200 bg-slate-50 overflow-y-auto flex flex-col shrink-0 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
                  {/* Contextual Header for Shelf */}
                  <div className="px-8 py-6 bg-white border-b border-slate-200 shrink-0">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
                          <Layers size={24} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-slate-900">Polica {selectedShelfId.split('-')[1].toUpperCase()}</h2>
                          <p className="text-slate-500 text-sm font-medium">Storage Shelf • Regalni Ormar / {selectedShelfId.split('-')[1].toUpperCase()}</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedShelfId(null)} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors">
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="p-8 flex-1">
                    {/* Storage Unit View for Shelf */}
                    <div className="max-w-2xl space-y-8">
                      {/* Security Level & Storage Info */}
                      <div className="grid grid-cols-2 gap-8">
                        {/* Security Level */}
                        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Security Level</h4>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className={`w-3 h-3 rounded-full ${i <= 2 ? 'bg-slate-900' : 'border-2 border-slate-200'}`} />
                              ))}
                            </div>
                            <span className="text-sm font-bold text-slate-900 ml-2">2/5</span>
                          </div>
                          <p className="text-xs text-slate-500">Standard storage protocols.</p>
                        </div>
                        {/* Storage Info */}
                        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Storage Info</h4>
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                              <Box size={24} />
                            </div>
                            <div>
                              <p className="text-2xl font-bold text-slate-900">{(shelfAssets[selectedShelfId!] ?? []).length}</p>
                              <p className="text-xs text-slate-500 font-medium">Total assets in unit</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Unit Content */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unit Content</h4>
                        </div>
                        <StorageUnitAssetList
                          items={shelfAssets[selectedShelfId!] ?? []}
                          dragging={draggingShelfAsset?.inv ?? null}
                          onDragStart={(inv) => setDraggingShelfAsset({ inv, fromShelf: selectedShelfId! })}
                          onDragEnd={() => setDraggingShelfAsset(null)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-4">
              <div className="p-6 bg-slate-100 rounded-full">
                <MapPin size={48} className="opacity-20" />
              </div>
              <p className="font-medium">Select a location from the hierarchy to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <EditLocationModal
        isOpen={isEditLocationOpen}
        onClose={() => setIsEditLocationOpen(false)}
        locationId={selectedLocationId}
        initialName={selectedLocationName}
        onSave={async (id, data) => {
          try {
            await updateLocationMutation.mutate(
              { name: data.name, location_type: data.type?.toLowerCase() },
              `/locations/${id}`
            );
            refetchLocations();
          } catch (err) {
            console.error('Failed to update location:', err);
          }
        }}
        onDelete={async (id) => {
          try {
            await deleteLocationMutation.mutate(undefined, `/locations/${id}`);
            setSelectedLocationId(null);
            refetchLocations();
          } catch (err) {
            console.error('Failed to delete location:', err);
          }
        }}
      />
      <AddEntityModal
        isOpen={isAddEntityOpen}
        onClose={() => setIsAddEntityOpen(false)}
        parentId={addEntityParentId}
        onSave={async (parentId, data) => {
          try {
            if (data.entityType === 'Storage Unit' && parentId !== 'root') {
              await createStorageUnitMutation.mutate({
                name: data.name,
                type: (data.storageType || 'cabinet').toLowerCase(),
                location_id: parentId,
                security_level: data.securityLevel || 1,
                is_lockable: (data.securityLevel || 1) >= 2,
              });
            } else {
              const created = await createLocationMutation.mutate({
                name: data.name,
                location_type: (data.locationType || 'room').toLowerCase(),
                parent_id: parentId === 'root' ? null : parentId,
                is_active: true,
              });
              if (created?.id) {
                setSelectedLocationId(created.id);
              }
            }
            refetchLocations();
          } catch (err) {
            console.error('Failed to create location/entity:', err);
          }
        }}
      />
      <ScannerPlacementModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />
    </>
  );
}

export default LocationsView;
