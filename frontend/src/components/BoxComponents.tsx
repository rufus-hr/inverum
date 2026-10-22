import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box as BoxIcon, Truck, Lock, Unlock, Search, ArrowRight, MapPin,
  Package, Cpu, Zap, Puzzle, ChevronRight, ChevronDown, X,
  ArrowRightToLine, Pencil, LogOut,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BoxAsset {
  id: string;
  inventory_number: string;
  name: string;
  status: string;
}

export interface BoxStockItem {
  id: string;
  inventory_number: string;
  name: string;
  quantity: number;
}

export interface BoxData {
  id: string;
  inventory_number: string;
  label?: string;
  status: 'open' | 'sealed' | 'in_transit';
  location?: { id: string; name: string };
  parent_box_id?: string;
  transit_record?: {
    id: string;
    destination: string;
    carrier: string;
    tracking_number: string;
    estimated_arrival: string;
  };
  assets: BoxAsset[];
  stock_items: BoxStockItem[];
  consumables: BoxStockItem[];
  accessories: BoxStockItem[];
  children: BoxData[];
}

interface LocationNode {
  id: string;
  name: string;
  children?: LocationNode[];
}

// ─── Location tree (fetched from API) ─────────────────────────────────────────

function useLocationTree(): LocationNode[] {
  const [tree, setTree] = useState<LocationNode[]>([]);

  useEffect(() => {
    import('../lib/api').then(({ apiFetch }) => {
      apiFetch<{ items: any[] }>('/locations/?limit=200')
        .then(resp => {
          const locs = resp.items ?? [];
          if (locs.length === 0) return;
          const byParent: Record<string, any[]> = {};
          for (const loc of locs) {
            const pid = loc.parent_id ?? '_root';
            if (!byParent[pid]) byParent[pid] = [];
            byParent[pid].push(loc);
          }
          function build(parentId: string): LocationNode[] {
            return (byParent[parentId] ?? []).map((loc: any) => ({
              id: loc.id,
              name: loc.name,
              children: build(loc.id),
            }));
          }
          const built = build('_root');
          if (built.length > 0) setTree(built);
        })
        .catch(() => {});
    });
  }, []);

  return tree;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function totalItems(box: BoxData): number {
  return box.assets.length + box.stock_items.length + box.consumables.length + box.accessories.length;
}

function effectiveLocation(box: BoxData): string {
  if (box.status === 'in_transit') return `→ ${box.transit_record?.destination ?? '?'}`;
  return box.location?.name ?? 'Nepoznato';
}

function allLocations(boxes: BoxData[]): string[] {
  const locs = new Set<string>();
  for (const b of boxes) {
    if (b.location?.name) locs.add(b.location.name);
    if (b.transit_record?.destination) locs.add(`→ ${b.transit_record.destination}`);
  }
  return ['Sve lokacije', ...Array.from(locs)];
}

function boxMatchesSearch(box: BoxData, q: string): boolean {
  if (!q) return true;
  const lq = q.toLowerCase();
  if (box.inventory_number.toLowerCase().includes(lq)) return true;
  if ((box.label ?? '').toLowerCase().includes(lq)) return true;
  const hit = (items: { name: string; inventory_number: string }[]) =>
    items.some(i => i.name.toLowerCase().includes(lq) || i.inventory_number.toLowerCase().includes(lq));
  return hit(box.assets) || hit(box.stock_items) || hit(box.consumables) || hit(box.accessories);
}

function nextInventoryNumber(boxes: BoxData[], prefix: string): string {
  const nums: number[] = [];
  function scan(list: BoxData[]) {
    for (const b of list) {
      const m = b.inventory_number.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (m) nums.push(parseInt(m[1], 10));
      scan(b.children);
    }
  }
  scan(boxes);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

function isBoxEmpty(box: BoxData): boolean {
  return totalItems(box) === 0 && box.children.every(isBoxEmpty);
}

function sealTree(b: BoxData): BoxData {
  return { ...b, status: 'sealed', children: b.children.map(sealTree) };
}

function updateBoxInTree(boxes: BoxData[], id: string, updater: (b: BoxData) => BoxData): BoxData[] {
  return boxes.map(b => {
    if (b.id === id) return updater(b);
    if (b.children.length) return { ...b, children: updateBoxInTree(b.children, id, updater) };
    return b;
  });
}

function containsId(box: BoxData, id: string): boolean {
  if (box.id === id) return true;
  return box.children.some(c => containsId(c, id));
}

function removeFromTree(boxes: BoxData[], id: string): BoxData[] {
  return boxes
    .filter(b => b.id !== id)
    .map(b => ({ ...b, children: removeFromTree(b.children, id) }));
}

function addChildToNode(boxes: BoxData[], targetId: string, child: BoxData): BoxData[] {
  return boxes.map(b => {
    if (b.id === targetId) return { ...b, children: [...b.children, child] };
    return { ...b, children: addChildToNode(b.children, targetId, child) };
  });
}

function findParentInTree(boxes: BoxData[], childId: string): BoxData | null {
  for (const b of boxes) {
    if (b.children.some(c => c.id === childId)) return b;
    const found = findParentInTree(b.children, childId);
    if (found) return found;
  }
  return null;
}

// ─── Status ───────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: BoxData['status'] }) {
  if (status === 'in_transit') return <Truck size={18} />;
  if (status === 'sealed') return <Lock size={18} />;
  return <Unlock size={18} />;
}

function statusColor(status: BoxData['status']) {
  if (status === 'in_transit') return 'bg-blue-100 text-blue-600';
  if (status === 'sealed') return 'bg-emerald-100 text-emerald-600';
  return 'bg-slate-100 text-slate-500';
}

// ─── Cascade location picker (opens LEFT) ────────────────────────────────────

function CascadeLocationPicker({ nodes, onSelect, inline = false }: {
  nodes: LocationNode[];
  onSelect: (node: LocationNode) => void;
  inline?: boolean;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className={`${inline ? '' : 'absolute right-full top-0 mr-1 '}bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-48 z-[100]`}>
      {nodes.map(node => {
        const hasChildren = !!(node.children?.length);
        return (
          <div
            key={node.id}
            className="relative"
            onMouseEnter={() => setHoveredId(node.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <button
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-left hover:bg-blue-600 hover:text-white transition-colors"
              onClick={e => { e.stopPropagation(); onSelect(node); }}
            >
              <span className="truncate">{node.name}</span>
              {hasChildren && <span className="text-slate-300 text-xs shrink-0 group-hover:text-white/60">›</span>}
            </button>
            {hasChildren && hoveredId === node.id && (
              <CascadeLocationPicker nodes={node.children!} onSelect={onSelect} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── New box targets ──────────────────────────────────────────────────────────

function NewBoxTargets({ activeType, onTypeClick, onSelect, onClose, locationTree }: {
  activeType: 'box' | 'pallet' | null;
  onTypeClick: (type: 'box' | 'pallet') => void;
  onSelect: (type: 'box' | 'pallet', location: LocationNode) => void;
  onClose: () => void;
  locationTree: LocationNode[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const mouseHandler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', keyHandler);
    document.addEventListener('mousedown', mouseHandler);
    return () => {
      document.removeEventListener('keydown', keyHandler);
      document.removeEventListener('mousedown', mouseHandler);
    };
  }, [onClose]);

  return (
    <div ref={containerRef} className="fixed right-10 top-1/2 -translate-y-1/2 flex flex-col gap-14 z-[70] select-none">
      {/* Box */}
      <div className="relative flex flex-col items-center gap-2.5">
        <div
          onClick={() => onTypeClick('box')}
          className={`w-24 h-24 rounded-3xl flex items-center justify-center cursor-pointer transition-all duration-150
            ${activeType === 'box'
              ? 'bg-amber-500 shadow-2xl shadow-amber-500/40 ring-4 ring-amber-300 scale-110'
              : 'bg-white/90 backdrop-blur-sm shadow-xl ring-1 ring-slate-200/80 hover:ring-amber-300'}`}
        >
          <BoxIcon size={46} strokeWidth={1.5}
            className={`transition-colors ${activeType === 'box' ? 'text-white' : 'text-amber-400'}`}
          />
        </div>
        <span className={`text-xs font-bold tracking-wider uppercase transition-colors
          ${activeType === 'box' ? 'text-amber-500' : 'text-slate-400'}`}>Box</span>
        {activeType === 'box' && (
          <div className="absolute right-full top-0 mr-3">
            <CascadeLocationPicker nodes={locationTree} onSelect={loc => onSelect('box', loc)} />
          </div>
        )}
      </div>

      {/* Pallet */}
      <div className="relative flex flex-col items-center gap-2.5">
        <div
          onClick={() => onTypeClick('pallet')}
          className={`w-24 h-24 rounded-3xl flex items-center justify-center cursor-pointer transition-all duration-150
            ${activeType === 'pallet'
              ? 'bg-violet-500 shadow-2xl shadow-violet-500/40 ring-4 ring-violet-300 scale-110'
              : 'bg-white/90 backdrop-blur-sm shadow-xl ring-1 ring-slate-200/80 hover:ring-violet-300'}`}
        >
          <Package size={46} strokeWidth={1.5}
            className={`transition-colors ${activeType === 'pallet' ? 'text-white' : 'text-violet-400'}`}
          />
        </div>
        <span className={`text-xs font-bold tracking-wider uppercase transition-colors
          ${activeType === 'pallet' ? 'text-violet-500' : 'text-slate-400'}`}>Paleta</span>
        {activeType === 'pallet' && (
          <div className="absolute right-full top-0 mr-3">
            <CascadeLocationPicker nodes={locationTree} onSelect={loc => onSelect('pallet', loc)} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ship modal ───────────────────────────────────────────────────────────────


// ─── Drag drop targets ────────────────────────────────────────────────────────

function DragDropTargets({ activeAction, onTargetDrop, onMove, onShipStart, onClose, locationTree }: {
  activeAction: 'ship' | 'move' | null;
  onTargetDrop: (action: 'ship' | 'move') => void;
  onMove: (dest: LocationNode) => void;
  onShipStart: (dest: LocationNode) => void;
  onClose: () => void;
  locationTree: LocationNode[];
}) {
  const [hover, setHover] = useState<'ship' | 'move' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeAction) return;
    const mouseHandler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', mouseHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', mouseHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [activeAction, onClose]);

  const isShipActive = hover === 'ship' || activeAction === 'ship';
  const isMoveActive = hover === 'move' || activeAction === 'move';

  return (
    <div ref={containerRef} className="fixed right-10 top-1/2 -translate-y-1/2 flex flex-col gap-14 z-[70] select-none">
      {/* Ship */}
      <div className="relative flex flex-col items-center gap-2.5">
        <div
          className={`w-24 h-24 rounded-3xl flex items-center justify-center transition-all duration-150
            ${isShipActive
              ? 'bg-blue-600 shadow-2xl shadow-blue-500/40 ring-4 ring-blue-300 scale-110'
              : 'bg-white/90 backdrop-blur-sm shadow-xl ring-1 ring-slate-200/80'}`}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setHover('ship'); }}
          onDragLeave={() => setHover(null)}
          onDrop={e => { e.preventDefault(); setHover(null); onTargetDrop('ship'); }}
        >
          <Truck size={46} strokeWidth={1.5}
            className={`transition-colors ${isShipActive ? 'text-white' : 'text-blue-400'}`}
          />
        </div>
        <span className={`text-xs font-bold tracking-wider uppercase transition-colors
          ${isShipActive ? 'text-blue-600' : 'text-slate-400'}`}>
          Ship
        </span>
        {activeAction === 'ship' && (
          <div className="absolute right-full top-0 mr-3">
            <CascadeLocationPicker
              nodes={locationTree}
              onSelect={dest => { onShipStart(dest); }}
            />
          </div>
        )}
      </div>

      {/* Move */}
      <div className="relative flex flex-col items-center gap-2.5">
        <div
          className={`w-24 h-24 rounded-3xl flex items-center justify-center transition-all duration-150
            ${isMoveActive
              ? 'bg-emerald-600 shadow-2xl shadow-emerald-500/40 ring-4 ring-emerald-300 scale-110'
              : 'bg-white/90 backdrop-blur-sm shadow-xl ring-1 ring-slate-200/80'}`}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setHover('move'); }}
          onDragLeave={() => setHover(null)}
          onDrop={e => { e.preventDefault(); setHover(null); onTargetDrop('move'); }}
        >
          <ArrowRightToLine size={46} strokeWidth={1.5}
            className={`transition-colors ${isMoveActive ? 'text-white' : 'text-slate-400'}`}
          />
        </div>
        <span className={`text-xs font-bold tracking-wider uppercase transition-colors
          ${isMoveActive ? 'text-emerald-600' : 'text-slate-400'}`}>
          Move
        </span>
        {activeAction === 'move' && (
          <div className="absolute right-full top-0 mr-3">
            <CascadeLocationPicker
              nodes={locationTree}
              onSelect={dest => { onMove(dest); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Child box tree ───────────────────────────────────────────────────────────

function BoxTreeNode({ box, depth = 0, onSelect, activeId, onSeal, onUnseal, onContextMenu }: {
  box: BoxData;
  depth?: number;
  onSelect: (b: BoxData) => void;
  activeId?: string;
  onSeal?: (b: BoxData) => void;
  onUnseal?: (b: BoxData) => void;
  onContextMenu?: (box: BoxData, x: number, y: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = box.children.length > 0;
  const items = totalItems(box);
  const isActive = box.id === activeId;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer group transition-colors
          ${isActive ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(box)}
        onContextMenu={e => { e.preventDefault(); onContextMenu?.(box, e.clientX, e.clientY); }}
      >
        {hasChildren ? (
          <button onClick={e => { e.stopPropagation(); setOpen(!open); }} className="text-slate-400 hover:text-slate-600">
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span className="w-[13px]" />
        )}
        <span className={`p-1 rounded ${statusColor(box.status)}`}>
          <StatusIcon status={box.status} />
        </span>
        <div className="flex-1 min-w-0">
          <span className={`text-xs font-bold ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>
            {box.inventory_number}
          </span>
          {box.label && <span className="text-xs text-slate-400 ml-1.5 truncate">{box.label}</span>}
        </div>
        <span className="text-[10px] text-slate-400 font-medium shrink-0">{items} items</span>
      </div>
      {hasChildren && open && (
        <div>
          {box.children.map(child => (
            <BoxTreeNode key={child.id} box={child} depth={depth + 1} onSelect={onSelect} activeId={activeId} onSeal={onSeal} onUnseal={onUnseal} onContextMenu={onContextMenu} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Content section ──────────────────────────────────────────────────────────

function ContentSection<T>({
  icon, title, color, items, renderRow,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  items: T[];
  renderRow: (item: T) => React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors"
      >
        <span className={`p-1.5 rounded-lg ${color}`}>{icon}</span>
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        <span className="ml-auto text-xs text-slate-400 font-medium">{items.length}</span>
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
      </button>
      {open && (
        <table className="w-full text-xs text-left table-fixed">
          <colgroup>
            <col className="w-32" />
            <col />
            <col className="w-16" />
          </colgroup>
          <tbody className="divide-y divide-slate-50">
            {items.map(item => renderRow(item))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function BoxDetail({ box, onClose }: { box: BoxData; onClose: () => void }) {
  const [detailBox, setDetailBox] = useState<BoxData>(box);
  React.useEffect(() => { setDetailBox(box); }, [box]);

  return (
    <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200">
      <div className="bg-white border-b border-slate-200 px-5 py-4 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`p-1.5 rounded-lg ${statusColor(detailBox.status)}`}>
              <StatusIcon status={detailBox.status} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">{detailBox.inventory_number}</h2>
              {detailBox.label && <p className="text-xs text-slate-500">{detailBox.label}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
          {detailBox.status === 'in_transit' ? (
            <>
              <Truck size={12} className="text-blue-500" />
              <span className="font-medium text-blue-600">In Transit</span>
              <span>→ {detailBox.transit_record?.destination}</span>
              <span className="ml-auto text-slate-400">ETA: {detailBox.transit_record?.estimated_arrival}</span>
            </>
          ) : (
            <>
              <MapPin size={12} />
              <span>{detailBox.location?.name ?? 'Nepoznato'}</span>
            </>
          )}
        </div>
        {detailBox.status === 'in_transit' && detailBox.transit_record && (
          <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100 text-xs">
            <span className="text-blue-700 font-medium">{detailBox.transit_record.carrier}</span>
            <span className="mx-2 text-blue-300">·</span>
            <span className="font-mono text-blue-600 tracking-wider">{detailBox.transit_record.tracking_number}</span>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <ContentSection<BoxAsset>
          icon={<Cpu size={14} />}
          title="Assets"
          color="bg-blue-50 text-blue-600"
          items={detailBox.assets}
          renderRow={(a: BoxAsset) => (
            <tr key={a.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 font-mono text-slate-400 truncate">{a.inventory_number}</td>
              <td className="px-4 py-2 font-medium text-slate-800 truncate">{a.name}</td>
              <td className="px-4 py-2 text-slate-400 text-right">{a.status}</td>
            </tr>
          )}
        />
        <ContentSection<BoxStockItem>
          icon={<Package size={14} />}
          title="Stock Items"
          color="bg-violet-50 text-violet-600"
          items={detailBox.stock_items}
          renderRow={(s: BoxStockItem) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 font-mono text-slate-400 truncate">{s.inventory_number}</td>
              <td className="px-4 py-2 font-medium text-slate-800 truncate">{s.name}</td>
              <td className="px-4 py-2 font-bold text-slate-700 text-right">×{s.quantity}</td>
            </tr>
          )}
        />
        <ContentSection<BoxStockItem>
          icon={<Zap size={14} />}
          title="Consumables"
          color="bg-amber-50 text-amber-600"
          items={detailBox.consumables}
          renderRow={(c: BoxStockItem) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 font-mono text-slate-400 truncate">{c.inventory_number}</td>
              <td className="px-4 py-2 font-medium text-slate-800 truncate">{c.name}</td>
              <td className="px-4 py-2 font-bold text-slate-700 text-right">×{c.quantity}</td>
            </tr>
          )}
        />
        <ContentSection<BoxStockItem>
          icon={<Puzzle size={14} />}
          title="Accessories"
          color="bg-emerald-50 text-emerald-600"
          items={detailBox.accessories}
          renderRow={(a: BoxStockItem) => (
            <tr key={a.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 font-mono text-slate-400 truncate">{a.inventory_number}</td>
              <td className="px-4 py-2 font-medium text-slate-800 truncate">{a.name}</td>
              <td className="px-4 py-2 font-bold text-slate-700 text-right">×{a.quantity}</td>
            </tr>
          )}
        />
      </div>
    </div>
  );
}

// ─── Drop into panel (boxception) ────────────────────────────────────────────

function DropBoxTreeNode({ box, depth, draggingId, onDrop }: {
  box: BoxData;
  depth: number;
  draggingId: string;
  onDrop: (targetId: string) => void;
}) {
  const isSelf = box.id === draggingId;
  const blocked = isSelf || box.status !== 'open';

  return (
    <div>
      <button
        disabled={blocked}
        onClick={() => { if (!blocked) onDrop(box.id); }}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors text-left
          ${blocked
            ? 'opacity-30 cursor-not-allowed'
            : 'hover:bg-blue-50 cursor-pointer group'}`}
      >
        <span className={`p-1 rounded ${statusColor(box.status)}`}>
          <StatusIcon status={box.status} />
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-slate-700">{box.inventory_number}</span>
          {box.label && <span className="text-xs text-slate-400 ml-1.5 truncate">{box.label}</span>}
        </div>
        <span className="text-[10px] text-slate-400 shrink-0">{totalItems(box)} items</span>
        {!blocked && <span className="text-[10px] text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">↵</span>}
      </button>
      {box.children.map(child => (
        <DropBoxTreeNode key={child.id} box={child} depth={depth + 1} draggingId={draggingId} onDrop={onDrop} />
      ))}
    </div>
  );
}

function DropIntoPanel({ targetBox, rect, draggingId, onDrop, onClose }: {
  targetBox: BoxData;
  rect: DOMRect;
  draggingId: string;
  onDrop: (targetId: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const mouseHandler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', handler);
    document.addEventListener('mousedown', mouseHandler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('mousedown', mouseHandler);
    };
  }, [onClose]);

  const panelWidth = Math.max(rect.width, 280);
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow >= 320 ? rect.bottom + 6 : rect.top - 6; // otvori gore ako nema mjesta dolje
  const translateY = spaceBelow >= 320 ? '0' : '-100%';

  return (
    <div
      ref={panelRef}
      style={{ position: 'fixed', left: rect.left, top, width: panelWidth, transform: `translateY(${translateY})`, zIndex: 90 }}
      className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
    >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-50 border-b border-blue-200">
          <div className="p-1.5 bg-blue-100 rounded-lg">
            <BoxIcon size={14} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-blue-800">Odaberi destinaciju</p>
            <p className="text-[10px] text-blue-500 truncate">{targetBox.inventory_number}{targetBox.label ? ` — ${targetBox.label}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-blue-200 text-blue-400 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Target box itself */}
        <div className="p-1.5 border-b border-slate-100">
          <button
            onClick={() => onDrop(targetBox.id)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-blue-50 transition-colors text-left group"
          >
            <span className={`p-1 rounded ${statusColor(targetBox.status)}`}>
              <StatusIcon status={targetBox.status} />
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-slate-700">{targetBox.inventory_number}</span>
              {targetBox.label && <span className="text-xs text-slate-400 ml-1.5 truncate">{targetBox.label}</span>}
            </div>
            <span className="text-[10px] text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">ubaci ↵</span>
          </button>
        </div>

        {/* Children tree */}
        {targetBox.children.length > 0 && (
          <div className="max-h-56 overflow-y-auto p-1.5">
            {targetBox.children.map(child => (
              <DropBoxTreeNode key={child.id} box={child} depth={0} draggingId={draggingId} onDrop={onDrop} />
            ))}
          </div>
        )}
        {targetBox.children.length === 0 && (
          <div className="px-4 py-3 text-xs text-slate-400 italic">Nema child boxova — ubacit će se direktno.</div>
        )}
    </div>
  );
}

// ─── Child relocate panel ─────────────────────────────────────────────────────

function ChildRelocatePanel({ box, allBoxes, x, y, onMoveTo, onRelease, onClose }: {
  box: BoxData;
  allBoxes: BoxData[];
  x: number;
  y: number;
  onMoveTo: (targetId: string) => void;
  onRelease: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const mouseHandler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', keyHandler);
    document.addEventListener('mousedown', mouseHandler);
    return () => {
      document.removeEventListener('keydown', keyHandler);
      document.removeEventListener('mousedown', mouseHandler);
    };
  }, [onClose]);

  const panelWidth = 280;
  const panelHeight = 320;
  const left = Math.min(x, window.innerWidth - panelWidth - 8);
  const top = y + panelHeight > window.innerHeight - 8 ? y - panelHeight : y;

  // All open boxes excluding the moved box and its descendants
  const available = allBoxes.filter(b => !containsId(b, box.id) && b.status !== 'in_transit');

  return (
    <div
      ref={panelRef}
      style={{ position: 'fixed', left, top, width: panelWidth, zIndex: 150 }}
      className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border-b border-amber-200">
        <div className="p-1.5 bg-amber-100 rounded-lg">
          <BoxIcon size={14} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-amber-800">Premjesti u...</p>
          <p className="text-[10px] text-amber-500 truncate">{box.inventory_number}{box.label ? ` — ${box.label}` : ''}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-amber-200 text-amber-400 transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Release option */}
      <div className="p-1.5 border-b border-slate-100">
        <button
          onClick={onRelease}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-amber-50 transition-colors text-left group"
        >
          <span className="p-1 rounded bg-amber-100 text-amber-600">
            <LogOut size={14} />
          </span>
          <span className="text-xs font-bold text-slate-700">Release (top-level)</span>
          <span className="text-[10px] text-amber-400 font-semibold opacity-0 group-hover:opacity-100 ml-auto transition-opacity">↵</span>
        </button>
      </div>

      {/* Box tree */}
      <div className="p-1.5 max-h-52 overflow-y-auto">
        {available.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3">Nema dostupnih boxova</p>
        ) : (
          available.map(b => (
            <DropBoxTreeNode key={b.id} box={b} depth={0} draggingId={box.id} onDrop={onMoveTo} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────

function BoxContextMenu({ box, x, y, onSeal, onUnseal, onRename, onRelease, onMoveTo, onClose }: {
  box: BoxData;
  x: number;
  y: number;
  onSeal: () => void;
  onUnseal: () => void;
  onRename: () => void;
  onRelease?: () => void;
  onMoveTo?: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mouseHandler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', mouseHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', mouseHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const left = Math.min(x, window.innerWidth - 192);
  const top = Math.min(y, window.innerHeight - 155);

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left, top, zIndex: 150 }}
      className="bg-white rounded-xl border border-slate-200 shadow-xl py-1 min-w-48 text-sm"
    >
      {box.status === 'open' && (
        <button
          onClick={() => { onSeal(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left text-slate-700 transition-colors"
        >
          <Lock size={14} className="text-emerald-500" /> Seal
        </button>
      )}
      {box.status === 'sealed' && (
        <button
          onClick={() => { onUnseal(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left text-slate-700 transition-colors"
        >
          <Unlock size={14} className="text-slate-400" /> Unseal
        </button>
      )}
      <div className="my-1 border-t border-slate-100" />
      <button
        onClick={() => { onRename(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left text-slate-700 transition-colors"
      >
        <Pencil size={14} className="text-blue-400" /> Rename
      </button>
      {(onRelease || onMoveTo) && <div className="my-1 border-t border-slate-100" />}
      {onMoveTo && (
        <button
          onClick={() => { onMoveTo(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 text-left text-blue-700 transition-colors"
        >
          <ArrowRight size={14} className="text-blue-400" /> Premjesti u →
        </button>
      )}
      {onRelease && (
        <button
          onClick={() => { onRelease(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-amber-50 text-left text-amber-700 transition-colors"
        >
          <LogOut size={14} className="text-amber-500" /> Release iz boxa
        </button>
      )}
    </div>
  );
}

// ─── Box card ─────────────────────────────────────────────────────────────────

function BoxCard({ box, selected, onClick, onDragStart, onDragEnd, isDragging, isDroppable, onBoxDrop, onContextMenu, isRenaming, onRename, onRenameCancel, onHoverEnter, onHoverLeave }: {
  box: BoxData;
  selected: boolean;
  onClick: () => void;
  onDragStart: (box: BoxData) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDroppable?: boolean;
  onBoxDrop?: (box: BoxData, rect: DOMRect) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isRenaming?: boolean;
  onRename?: (label: string) => void;
  onRenameCancel?: () => void;
  onHoverEnter?: () => void;
  onHoverLeave?: () => void;
}) {
  const items = totalItems(box);
  const childCount = box.children.length;
  const canDrag = box.status !== 'in_transit';
  const escapeRef = useRef(false);

  // Always return the SAME root element so browser keeps the drag reference alive
  // and onDragEnd always fires. Switching to a different element on isDragging
  // unmounts the original and dragend never reaches React.
  return (
    <div
      onClick={isDragging ? undefined : onClick}
      draggable={canDrag && !isRenaming}
      onDragStart={(canDrag && !isRenaming) ? e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', box.id);
        onDragStart(box);
      } : undefined}
      onDragEnd={(canDrag && !isRenaming) ? onDragEnd : undefined}
      onDragOver={(!isDragging && box.status === 'open' && onBoxDrop) ? e => {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      } : undefined}
      onDrop={(!isDragging && box.status === 'open' && onBoxDrop) ? e => {
        e.preventDefault(); e.stopPropagation();
        onBoxDrop(box, e.currentTarget.getBoundingClientRect());
      } : undefined}
      onContextMenu={onContextMenu}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      className={`relative bg-white border rounded-xl transition-all overflow-hidden flex flex-col
        ${(canDrag && !isRenaming) ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
        ${isDragging
          ? 'border-dashed border-blue-300 opacity-50 shadow-none'
          : isRenaming
            ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm'
            : isDroppable
              ? 'border-blue-200 ring-1 ring-blue-100 shadow-sm hover:shadow-md hover:border-blue-400 hover:ring-blue-200'
              : selected
                ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm hover:shadow-md'
                : 'border-slate-200 shadow-sm hover:shadow-md'}`}
    >
      {box.status === 'sealed' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400 rounded-l-xl" />}
      {box.status === 'in_transit' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l-xl" />}
      {isDragging ? (
        /* Minimal state — same root div stays mounted so dragend fires */
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-blue-50/50">
          <span className={`p-1.5 rounded-lg ${statusColor(box.status)} shrink-0`}>
            <StatusIcon status={box.status} />
          </span>
          <span className="text-sm font-bold text-slate-600 truncate">{box.inventory_number}</span>
          {box.label && <span className="text-xs text-slate-400 truncate">{box.label}</span>}
        </div>
      ) : (
        <>
          <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${statusColor(box.status)}`}>
                <StatusIcon status={box.status} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{box.inventory_number}</h3>
                {isRenaming ? (
                  <input
                    autoFocus
                    defaultValue={box.label ?? ''}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      e.stopPropagation();
                      if (e.key === 'Enter') { onRename?.((e.target as HTMLInputElement).value); }
                      if (e.key === 'Escape') { escapeRef.current = true; onRenameCancel?.(); }
                    }}
                    onBlur={e => { if (!escapeRef.current) onRename?.(e.target.value); escapeRef.current = false; }}
                    placeholder="Friendly name..."
                    className="text-xs text-slate-500 bg-transparent border-b border-blue-400 outline-none w-36 placeholder-slate-300 mt-0.5"
                  />
                ) : (
                  box.label && <p className="text-xs text-slate-500 truncate max-w-[160px]">{box.label}</p>
                )}
              </div>
            </div>
            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-full shrink-0">
              {items} items
            </span>
          </div>

          <div className="p-4 flex-1 space-y-2">
            {box.status === 'in_transit' && box.transit_record ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <ArrowRight size={13} className="text-blue-500 shrink-0" />
                  <span className="font-medium truncate">{box.transit_record.destination}</span>
                </div>
                <div className="bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                  <div className="text-[10px] text-blue-700 font-medium">{box.transit_record.carrier}</div>
                  <div className="text-[10px] font-mono text-blue-500 tracking-wider">{box.transit_record.tracking_number}</div>
                  <div className="text-[10px] text-blue-400 mt-1">ETA: {box.transit_record.estimated_arrival}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin size={12} className="shrink-0 text-slate-400" />
                <span className="truncate">{box.location?.name ?? 'Nepoznato'}</span>
              </div>
            )}
            <div className="flex gap-1.5 flex-wrap mt-1">
              {box.assets.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                  <Cpu size={10} /> {box.assets.length}
                </span>
              )}
              {box.stock_items.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-medium">
                  <Package size={10} /> {box.stock_items.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
              {box.consumables.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium">
                  <Zap size={10} /> {box.consumables.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
              {box.accessories.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-medium">
                  <Puzzle size={10} /> {box.accessories.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
              {childCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                  <BoxIcon size={10} /> {childCount}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function BoxesDashboard({ boxes: initialBoxes = [] }: { boxes?: BoxData[] } = {}) {
  const locationTree = useLocationTree();
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

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-19), localBoxes]);
  }, [localBoxes]);

  const selectBox = (box: BoxData) => { setSelectedBox(box); setViewedBox(box); };
  const closeBox = useCallback(() => { setSelectedBox(null); setViewedBox(null); }, []);

  React.useEffect(() => {
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
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedBox, hoveredBox, closeBox, localBoxes]);

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
        carrier: '—',
        tracking_number: '—',
        estimated_arrival: '—',
      },
    });
    setLocalBoxes(prev => updateBoxInTree(prev, box.id, patch));
    if (selectedBox?.id === box.id) setSelectedBox(patch(box));
    if (viewedBox?.id === box.id) setViewedBox(patch(box));
    setDropContext(null);
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
  };

  const handleUnseal = (box: BoxData) => {
    pushUndo();
    const unseal = (b: BoxData): BoxData => ({ ...b, status: 'open' });
    setLocalBoxes(prev => updateBoxInTree(prev, box.id, unseal));
    setSelectedBox(prev => prev ? updateBoxInTree([prev], box.id, unseal)[0] : null);
    setViewedBox(prev => prev ? updateBoxInTree([prev], box.id, unseal)[0] : null);
  };

  const handleRelease = (box: BoxData) => {
    pushUndo();
    const parent = findParentInTree(localBoxes, box.id);
    const released = { ...box, location: parent?.location, parent_box_id: undefined };
    setLocalBoxes(prev => [...removeFromTree(prev, box.id), released]);
    setSelectedBox(prev => prev ? removeFromTree([prev], box.id)[0] ?? null : null);
    setViewedBox(prev => prev?.id === box.id ? null : prev ? removeFromTree([prev], box.id)[0] ?? null : null);
  };

  const handleChildMoveTo = (child: BoxData, targetId: string) => {
    if (child.id === targetId) return;
    if (containsId(child, targetId)) return;
    pushUndo();
    setLocalBoxes(prev => addChildToNode(removeFromTree(prev, child.id), targetId, child));
    setSelectedBox(prev => prev ? removeFromTree([prev], child.id)[0] ?? null : null);
    setViewedBox(prev => prev?.id === child.id ? null : prev ? removeFromTree([prev], child.id)[0] ?? null : null);
    setChildRelocateContext(null);
  };

  const handleRename = (box: BoxData, newLabel: string) => {
    const label = newLabel.trim() || undefined;
    setLocalBoxes(prev => updateBoxInTree(prev, box.id, b => ({ ...b, label })));
    if (selectedBox?.id === box.id) setSelectedBox(b => b ? { ...b, label } : null);
    if (viewedBox?.id === box.id) setViewedBox(b => b ? { ...b, label } : null);
    setRenamingBoxId(null);
  };

  const handleNewBoxCreate = (type: 'box' | 'pallet', location: LocationNode) => {
    pushUndo();
    const prefix = type === 'pallet' ? 'PAL' : 'BOX';
    const inventoryNumber = nextInventoryNumber(localBoxes, prefix);
    setLocalBoxes(prev => [...prev, {
      id: `${prefix.toLowerCase()}-${Date.now()}`,
      inventory_number: inventoryNumber,
      status: 'open',
      location: { id: location.id, name: location.name },
      assets: [],
      stock_items: [],
      consumables: [],
      accessories: [],
      children: [],
    }]);
    setNewBoxContext(null);
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
