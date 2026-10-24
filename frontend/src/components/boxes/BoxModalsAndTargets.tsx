import { useState, useEffect, useRef } from 'react';
import {
  Box as BoxIcon, Truck, Lock, Unlock, ArrowRight, Package, X,
  ArrowRightToLine, Pencil, LogOut,
} from 'lucide-react';
import {
  BoxData, LocationNode, totalItems, containsId, statusColor, StatusIcon,
} from './BoxTypesAndHelpers';

// ─── Cascade location picker (opens LEFT) ────────────────────────────────────

export function CascadeLocationPicker({ nodes, onSelect, inline = false }: {
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

export function NewBoxTargets({ activeType, onTypeClick, onSelect, onClose, locationTree }: {
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

// ─── Drag drop targets ────────────────────────────────────────────────────────

export function DragDropTargets({ activeAction, onTargetDrop, onMove, onShipStart, onClose, locationTree }: {
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

export function DropIntoPanel({ targetBox, rect, draggingId, onDrop, onClose }: {
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
  const top = spaceBelow >= 320 ? rect.bottom + 6 : rect.top - 6;
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

export function ChildRelocatePanel({ box, allBoxes, x, y, onMoveTo, onRelease, onClose }: {
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

export function BoxContextMenu({ box, x, y, onSeal, onUnseal, onRename, onRelease, onMoveTo, onClose }: {
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
