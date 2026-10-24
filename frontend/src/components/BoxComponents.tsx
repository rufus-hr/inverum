import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box as BoxIcon, Truck, Lock, Unlock, Search,
} from 'lucide-react';
import { useApiQuery } from '../hooks/useApi';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';
import type {
  PagedResponse,
  BoxResponse,
  BoxCreatePayload,
  BoxModifyPayload,
  AssetResponse,
  StockInstanceResponse,
  SupplyResponse,
  LocationResponse,
} from '../types/api';

import {
  BoxData,
  BoxAsset,
  BoxStockItem,
  LocationNode,
  effectiveLocation,
  allLocations,
  boxMatchesSearch,
  nextInventoryNumber,
  isBoxEmpty,
  sealTree,
  updateBoxInTree,
  containsId,
  removeFromTree,
  addChildToNode,
  findParentInTree,
} from './boxes/BoxTypesAndHelpers';
import { BoxCard, BoxTreeNode } from './boxes/BoxCard';
import { BoxDetail } from './boxes/BoxDetail';
import {
  NewBoxTargets,
  DragDropTargets,
  DropIntoPanel,
  ChildRelocatePanel,
  BoxContextMenu,
} from './boxes/BoxModalsAndTargets';

export type { BoxData, BoxAsset, BoxStockItem };

// ─── Build BoxData[] tree from API responses ─────────────────────────────────

function buildBoxTree(
  rawBoxes: BoxResponse[],
  rawAssets: AssetResponse[],
  rawStock: StockInstanceResponse[],
  rawSupplies: SupplyResponse[],
  rawLocations: LocationResponse[],
): BoxData[] {
  const locMap = new Map<string, string>();
  for (const loc of rawLocations) {
    locMap.set(loc.id, loc.name);
  }

  const supplyMap = new Map<string, SupplyResponse>();
  for (const sup of rawSupplies) {
    supplyMap.set(sup.id, sup);
  }

  const nodeMap = new Map<string, BoxData>();
  for (const b of rawBoxes) {
    const locName = b.location_id ? (locMap.get(b.location_id) ?? 'Nepoznato') : undefined;
    nodeMap.set(b.id, {
      id: b.id,
      inventory_number: b.inventory_number,
      label: b.notes ?? undefined,
      status: b.status,
      location: b.location_id ? { id: b.location_id, name: locName! } : undefined,
      parent_box_id: b.parent_box_id ?? undefined,
      transit_record: b.status === 'in_transit' ? {
        id: `TR-${b.id.slice(0, 6)}`,
        destination: b.notes || 'U tranzitu',
        carrier: 'Interni transport',
        tracking_number: b.inventory_number,
        estimated_arrival: '—',
      } : undefined,
      assets: [],
      stock_items: [],
      consumables: [],
      accessories: [],
      children: [],
    });
  }

  // Attach assets placed in boxes
  for (const a of rawAssets) {
    if (a.box_id && nodeMap.has(a.box_id)) {
      nodeMap.get(a.box_id)!.assets.push({
        id: a.id,
        inventory_number: a.inventory_number ?? a.serial_number ?? a.id.slice(0, 8).toUpperCase(),
        name: a.name ?? 'Asset',
        status: a.status ?? 'Active',
      });
    }
  }

  // Attach stock instances placed in boxes
  for (const st of rawStock) {
    if (st.box_id && nodeMap.has(st.box_id)) {
      const boxNode = nodeMap.get(st.box_id)!;
      const sup = supplyMap.get(st.supply_id);
      const item: BoxStockItem = {
        id: st.id,
        inventory_number: sup?.part_number ?? st.id.slice(0, 8).toUpperCase(),
        name: sup?.name ?? 'Supply stavka',
        quantity: st.quantity,
      };
      if (st.entity_type === 'stock_item') boxNode.stock_items.push(item);
      else if (st.entity_type === 'consumable') boxNode.consumables.push(item);
      else if (st.entity_type === 'accessory') boxNode.accessories.push(item);
    }
  }

  // Build parent-child hierarchy
  const roots: BoxData[] = [];
  for (const b of rawBoxes) {
    const node = nodeMap.get(b.id)!;
    if (b.parent_box_id && nodeMap.has(b.parent_box_id)) {
      const parent = nodeMap.get(b.parent_box_id)!;
      if (!node.location && parent.location) {
        node.location = parent.location;
      }
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function buildLocationTree(locs: LocationResponse[]): LocationNode[] {
  if (locs.length === 0) return [];
  const byParent: Record<string, LocationResponse[]> = {};
  for (const loc of locs) {
    const pid = loc.parent_id ?? '_root';
    if (!byParent[pid]) byParent[pid] = [];
    byParent[pid].push(loc);
  }
  function build(parentId: string): LocationNode[] {
    return (byParent[parentId] ?? []).map(loc => ({
      id: loc.id,
      name: loc.name,
      children: build(loc.id),
    }));
  }
  return build('_root');
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function BoxesDashboard({ boxes: initialBoxes = [] }: { boxes?: BoxData[] } = {}) {
  const toast = useToast();
  const { data: boxesResp, refetch: refetchBoxes } = useApiQuery<PagedResponse<BoxResponse>>('/boxes/?limit=200');
  const { data: assetsResp } = useApiQuery<PagedResponse<AssetResponse>>('/assets/?limit=200');
  const { data: stockResp } = useApiQuery<PagedResponse<StockInstanceResponse>>('/stock/?limit=200');
  const { data: suppliesResp } = useApiQuery<PagedResponse<SupplyResponse>>('/supplies/?limit=200');
  const { data: locationsResp } = useApiQuery<PagedResponse<LocationResponse>>('/locations/?limit=200');

  const locationTree = useMemo(
    () => buildLocationTree(locationsResp?.items ?? []),
    [locationsResp],
  );

  const [localBoxes, setLocalBoxes] = useState<BoxData[]>(initialBoxes);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState('Sve lokacije');
  const [selectedBox, setSelectedBox] = useState<BoxData | null>(null);
  const [viewedBox, setViewedBox] = useState<BoxData | null>(null);
  const [draggingBox, setDraggingBox] = useState<BoxData | null>(null);
  const [dropContext, setDropContext] = useState<{ box: BoxData; action: 'ship' | 'move' | null } | null>(null);
  const droppedOnTarget = useRef(false);
  const [boxDropTarget, setBoxDropTarget] = useState<{ box: BoxData; rect: DOMRect } | null>(null);
  const [newBoxContext, setNewBoxContext] = useState<{ activeType: 'box' | 'pallet' | null } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ box: BoxData; x: number; y: number } | null>(null);
  const [childRelocateContext, setChildRelocateContext] = useState<{ box: BoxData; x: number; y: number } | null>(null);
  const [renamingBoxId, setRenamingBoxId] = useState<string | null>(null);
  const [hoveredBox, setHoveredBox] = useState<BoxData | null>(null);
  const [undoStack, setUndoStack] = useState<BoxData[][]>([]);

  useEffect(() => {
    if (boxesResp?.items) {
      const built = buildBoxTree(
        boxesResp.items,
        assetsResp?.items ?? [],
        stockResp?.items ?? [],
        suppliesResp?.items ?? [],
        locationsResp?.items ?? [],
      );
      setLocalBoxes(built);
    }
  }, [boxesResp, assetsResp, stockResp, suppliesResp, locationsResp]);

  const persistBoxUpdate = useCallback(async (boxId: string, payload: BoxModifyPayload) => {
    try {
      await apiFetch<BoxResponse>(`/boxes/${boxId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      toast.error(err?.message || 'Greška pri spremanju promjena na boxu');
      refetchBoxes();
    }
  }, [refetchBoxes]);

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-19), localBoxes]);
  }, [localBoxes]);

  const selectBox = (box: BoxData) => { setSelectedBox(box); setViewedBox(box); };
  const closeBox = useCallback(() => { setSelectedBox(null); setViewedBox(null); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Escape' && selectedBox) closeBox();

      if (e.key === 'Backspace' && !selectedBox && !inInput) {
        setSearch(''); setStatusFilter('all'); setLocationFilter('Sve lokacije');
      }

      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setUndoStack(prev => {
          if (prev.length === 0) return prev;
          setLocalBoxes(prev[prev.length - 1]);
          setSelectedBox(null); setViewedBox(null);
          return prev.slice(0, -1);
        });
      }

      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !inInput) {
        setNewBoxContext({ activeType: null });
      }

      if (e.key === 'Delete' && e.shiftKey && !inInput) {
        const target = selectedBox ?? hoveredBox;
        if (target && isBoxEmpty(target)) {
          setUndoStack(prev => [...prev.slice(-19), localBoxes]);
          setLocalBoxes(prev => removeFromTree(prev, target.id));
          setSelectedBox(null); setViewedBox(null);
          apiFetch(`/boxes/${target.id}`, { method: 'DELETE' })
            .then(() => toast.success(`Box ${target.inventory_number} obrisan`))
            .catch(() => refetchBoxes());
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedBox, hoveredBox, closeBox, localBoxes, refetchBoxes]);

  const locations = allLocations(localBoxes);

  const filtered = localBoxes.filter(box => {
    const matchSearch = boxMatchesSearch(box, search);
    const matchStatus = statusFilter === 'all' || box.status === statusFilter;
    const loc = effectiveLocation(box);
    const matchLocation = locationFilter === 'Sve lokacije' || loc === locationFilter;
    return matchSearch && matchStatus && matchLocation;
  });

  const handleTargetDrop = (action: 'ship' | 'move') => {
    droppedOnTarget.current = true;
    setDropContext(prev => prev ? { ...prev, action } : null);
  };

  const handleMove = (dest: LocationNode) => {
    const box = dropContext?.box;
    if (!box) return;
    pushUndo();
    const patch = (b: BoxData): BoxData => ({
      ...b, status: 'open', location: { id: dest.id, name: dest.name }, transit_record: undefined,
    });
    setLocalBoxes(prev => updateBoxInTree(prev, box.id, patch));
    if (selectedBox?.id === box.id) setSelectedBox(patch(box));
    if (viewedBox?.id === box.id) setViewedBox(patch(box));
    setDropContext(null);
    persistBoxUpdate(box.id, {
      status: 'open',
      location_id: dest.id,
      storage_unit_id: null,
      parent_box_id: null,
    });
    toast.success(`${box.inventory_number} premješten na ${dest.name}`);
  };

  const handleShipStart = (dest: LocationNode) => {
    const box = dropContext?.box;
    if (!box) return;
    pushUndo();
    const patch = (b: BoxData): BoxData => ({
      ...b,
      status: 'in_transit',
      location: undefined,
      transit_record: {
        id: `TR-${Date.now()}`,
        destination: dest.name,
        carrier: 'Interni transport',
        tracking_number: box.inventory_number,
        estimated_arrival: '—',
      },
    });
    setLocalBoxes(prev => updateBoxInTree(prev, box.id, patch));
    if (selectedBox?.id === box.id) setSelectedBox(patch(box));
    if (viewedBox?.id === box.id) setViewedBox(patch(box));
    setDropContext(null);
    persistBoxUpdate(box.id, {
      status: 'in_transit',
      location_id: null,
      storage_unit_id: null,
      parent_box_id: null,
      notes: dest.name,
    });
    toast.success(`${box.inventory_number} poslan u tranzit prema ${dest.name}`);
  };

  const handleDragStart = (box: BoxData) => {
    setDraggingBox(box);
    setDropContext({ box, action: null });
    setBoxDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggingBox(null);
    if (!droppedOnTarget.current) {
      setDropContext(null);
      setBoxDropTarget(null);
    }
    droppedOnTarget.current = false;
  };

  const handleSeal = (box: BoxData) => {
    pushUndo();
    setLocalBoxes(prev => updateBoxInTree(prev, box.id, sealTree));
    setSelectedBox(prev => prev ? updateBoxInTree([prev], box.id, sealTree)[0] : null);
    setViewedBox(prev => prev ? updateBoxInTree([prev], box.id, sealTree)[0] : null);
    persistBoxUpdate(box.id, { status: 'sealed' });
  };

  const handleUnseal = (box: BoxData) => {
    pushUndo();
    const unseal = (b: BoxData): BoxData => ({ ...b, status: 'open' });
    setLocalBoxes(prev => updateBoxInTree(prev, box.id, unseal));
    setSelectedBox(prev => prev ? updateBoxInTree([prev], box.id, unseal)[0] : null);
    setViewedBox(prev => prev ? updateBoxInTree([prev], box.id, unseal)[0] : null);
    persistBoxUpdate(box.id, { status: 'open' });
  };

  const handleRelease = (box: BoxData) => {
    pushUndo();
    const parent = findParentInTree(localBoxes, box.id);
    const fallbackLoc = parent?.location ?? (locationsResp?.items?.[0] ? { id: locationsResp.items[0].id, name: locationsResp.items[0].name } : undefined);
    const released = { ...box, location: fallbackLoc, parent_box_id: undefined };
    setLocalBoxes(prev => [...removeFromTree(prev, box.id), released]);
    setSelectedBox(prev => prev ? removeFromTree([prev], box.id)[0] ?? null : null);
    setViewedBox(prev => prev?.id === box.id ? null : prev ? removeFromTree([prev], box.id)[0] ?? null : null);
    if (fallbackLoc) {
      persistBoxUpdate(box.id, {
        parent_box_id: null,
        storage_unit_id: null,
        location_id: fallbackLoc.id,
      });
    }
  };

  const handleChildMoveTo = (child: BoxData, targetId: string) => {
    if (child.id === targetId) return;
    if (containsId(child, targetId)) return;
    pushUndo();
    setLocalBoxes(prev => addChildToNode(removeFromTree(prev, child.id), targetId, child));
    setSelectedBox(prev => prev ? removeFromTree([prev], child.id)[0] ?? null : null);
    setViewedBox(prev => prev?.id === child.id ? null : prev ? removeFromTree([prev], child.id)[0] ?? null : null);
    setChildRelocateContext(null);
    persistBoxUpdate(child.id, {
      parent_box_id: targetId,
      location_id: null,
      storage_unit_id: null,
    });
  };

  const handleRename = (box: BoxData, newLabel: string) => {
    const label = newLabel.trim() || undefined;
    setLocalBoxes(prev => updateBoxInTree(prev, box.id, b => ({ ...b, label })));
    if (selectedBox?.id === box.id) setSelectedBox(b => b ? { ...b, label } : null);
    if (viewedBox?.id === box.id) setViewedBox(b => b ? { ...b, label } : null);
    setRenamingBoxId(null);
    persistBoxUpdate(box.id, { notes: label ?? null });
  };

  const handleNewBoxCreate = async (type: 'box' | 'pallet', location: LocationNode) => {
    pushUndo();
    const prefix = type === 'pallet' ? 'PAL' : 'BOX';
    const inventoryNumber = nextInventoryNumber(localBoxes, prefix);
    setNewBoxContext(null);

    try {
      const payload: BoxCreatePayload = {
        inventory_number: inventoryNumber,
        status: 'open',
        location_id: location.id,
        notes: type === 'pallet' ? 'Paleta' : null,
      };
      const created = await apiFetch<BoxResponse>('/boxes/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setLocalBoxes(prev => [...prev, {
        id: created.id,
        inventory_number: created.inventory_number,
        label: created.notes ?? undefined,
        status: created.status,
        location: { id: location.id, name: location.name },
        assets: [],
        stock_items: [],
        consumables: [],
        accessories: [],
        children: [],
      }]);
      toast.success(`Kreiran ${created.inventory_number} na lokaciji ${location.name}`);
    } catch (err: any) {
      toast.error(err?.message || 'Greška pri kreiranju boxa');
    }
  };

  const handleCardDrop = (box: BoxData, rect: DOMRect) => {
    if (!dropContext || dropContext.box.id === box.id || box.status !== 'open') return;
    droppedOnTarget.current = true;
    setBoxDropTarget({ box, rect });
  };

  const handleDropIntoBox = (targetBoxId: string) => {
    const dragging = dropContext?.box;
    if (!dragging) return;
    if (dragging.id === targetBoxId) return;
    if (containsId(dragging, targetBoxId)) return; // circular
    const targetBox = localBoxes.flatMap(function flat(b): BoxData[] { return [b, ...b.children.flatMap(flat)]; }).find(b => b.id === targetBoxId);
    if (targetBox?.status !== 'open') return;
    pushUndo();
    droppedOnTarget.current = true;
    setLocalBoxes(prev => {
      const cleaned = removeFromTree(prev, dragging.id);
      return addChildToNode(cleaned, targetBoxId, dragging);
    });
    setDropContext(null);
    setBoxDropTarget(null);
    if (selectedBox?.id === dragging.id) { setSelectedBox(null); setViewedBox(null); }
    persistBoxUpdate(dragging.id, {
      parent_box_id: targetBoxId,
      location_id: null,
      storage_unit_id: null,
    });
    toast.success(`${dragging.inventory_number} ubačen u ${targetBox.inventory_number}`);
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Left panel */}
      <div className={`flex flex-col transition-all duration-300 ${selectedBox ? 'w-96 shrink-0' : 'w-full'} border-r border-slate-200 bg-white`}>
        <div className={`p-5 border-b border-slate-200 shrink-0 ${selectedBox ? '' : 'p-6'}`}>
          {!selectedBox ? (
            <>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    <BoxIcon className="text-amber-500" size={26} />
                    Boxes
                  </h1>
                  <p className="text-slate-500 text-sm mt-0.5">Kontejneri, paketi, palete</p>
                </div>
                <button
                  onClick={() => setNewBoxContext({ activeType: null })}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold transition-colors shadow-sm flex items-center gap-2 text-sm"
                >
                  <BoxIcon size={16} /> Novi box
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Pretraži po ID, opisu, sadržaju..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape' && search) { e.stopPropagation(); setSearch(''); } }}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={locationFilter}
                  onChange={e => setLocationFilter(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {locations.map(l => <option key={l}>{l}</option>)}
                </select>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  {(['all', 'open', 'sealed', 'in_transit'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5
                        ${statusFilter === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {s === 'all' && 'Sve'}
                      {s === 'open' && <><Unlock size={12} /> Open</>}
                      {s === 'sealed' && <><Lock size={12} /> Sealed</>}
                      {s === 'in_transit' && <><Truck size={12} /> Transit</>}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={closeBox} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors">
                ← Nazad
              </button>
              <span className="text-slate-200">|</span>
              <span className="text-xs font-bold text-slate-700">{selectedBox.inventory_number}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!selectedBox ? (
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map(box => (
                <BoxCard
                  key={box.id}
                  box={box}
                  selected={false}
                  onClick={() => selectBox(box)}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isDragging={dropContext?.box.id === box.id}
                  isDroppable={!!dropContext && dropContext.box.id !== box.id && box.status === 'open'}
                  onBoxDrop={handleCardDrop}
                  onContextMenu={e => { e.preventDefault(); setContextMenu({ box, x: e.clientX, y: e.clientY }); }}
                  isRenaming={renamingBoxId === box.id}
                  onRename={label => handleRename(box, label)}
                  onRenameCancel={() => setRenamingBoxId(null)}
                  onHoverEnter={() => setHoveredBox(box)}
                  onHoverLeave={() => setHoveredBox(null)}
                />
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-400">
                  <BoxIcon size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">Nema boxeva koji odgovaraju filteru.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <BoxCard
                box={selectedBox}
                selected={true}
                onClick={() => {}}
                onDragStart={setDraggingBox}
                onDragEnd={() => setDraggingBox(null)}
                isDragging={draggingBox?.id === selectedBox.id}
              />
              {selectedBox.children.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200 bg-white">
                    <BoxIcon size={13} className="text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600">Boxevi unutar</span>
                    <span className="ml-auto text-[10px] text-slate-400">{selectedBox.children.length}</span>
                  </div>
                  <div className="p-1.5">
                    {selectedBox.children.map(child => (
                      <BoxTreeNode key={child.id} box={child} onSelect={setViewedBox} activeId={viewedBox?.id} onSeal={handleSeal} onUnseal={handleUnseal} onContextMenu={(b, x, y) => setContextMenu({ box: b, x, y })} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: detail */}
      {viewedBox && (
        <div className="flex-1 flex flex-col">
          <BoxDetail box={viewedBox} onClose={closeBox} />
        </div>
      )}

      {/* Drag targets — visible while dragging AND while selecting location after drop */}
      {dropContext && (
        <DragDropTargets
          activeAction={dropContext.action}
          onTargetDrop={handleTargetDrop}
          onMove={handleMove}
          onShipStart={handleShipStart}
          onClose={() => setDropContext(null)}
          locationTree={locationTree}
        />
      )}

      {/* Boxception selection panel */}
      {dropContext && boxDropTarget && (
        <DropIntoPanel
          targetBox={boxDropTarget.box}
          rect={boxDropTarget.rect}
          draggingId={dropContext.box.id}
          onDrop={handleDropIntoBox}
          onClose={() => { setBoxDropTarget(null); setDropContext(null); }}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <BoxContextMenu
          box={contextMenu.box}
          x={contextMenu.x}
          y={contextMenu.y}
          onSeal={() => handleSeal(contextMenu.box)}
          onUnseal={() => handleUnseal(contextMenu.box)}
          onRename={() => setRenamingBoxId(contextMenu.box.id)}
          onRelease={findParentInTree(localBoxes, contextMenu.box.id) ? () => handleRelease(contextMenu.box) : undefined}
          onMoveTo={findParentInTree(localBoxes, contextMenu.box.id) ? () => setChildRelocateContext({ box: contextMenu.box, x: contextMenu.x, y: contextMenu.y }) : undefined}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Child relocate panel */}
      {childRelocateContext && (
        <ChildRelocatePanel
          box={childRelocateContext.box}
          allBoxes={localBoxes}
          x={childRelocateContext.x}
          y={childRelocateContext.y}
          onMoveTo={targetId => handleChildMoveTo(childRelocateContext.box, targetId)}
          onRelease={() => { handleRelease(childRelocateContext.box); setChildRelocateContext(null); }}
          onClose={() => setChildRelocateContext(null)}
        />
      )}

      {/* New box targets */}
      {newBoxContext && (
        <NewBoxTargets
          activeType={newBoxContext.activeType}
          onTypeClick={type => setNewBoxContext({ activeType: type })}
          onSelect={handleNewBoxCreate}
          onClose={() => setNewBoxContext(null)}
          locationTree={locationTree}
        />
      )}

    </div>
  );
}

export default BoxesDashboard;
