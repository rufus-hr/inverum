import React, { useState, useRef } from 'react';
import {
  Box as BoxIcon, ArrowRight, MapPin, Package, Cpu, Zap, Puzzle,
  ChevronRight, ChevronDown,
} from 'lucide-react';
import { BoxData, totalItems, statusColor, StatusIcon } from './BoxTypesAndHelpers';

// ─── Child box tree ───────────────────────────────────────────────────────────

export function BoxTreeNode({ box, depth = 0, onSelect, activeId, onSeal, onUnseal, onContextMenu }: {
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

// ─── Box card ─────────────────────────────────────────────────────────────────

export function BoxCard({ box, selected, onClick, onDragStart, onDragEnd, isDragging, isDroppable, onBoxDrop, onContextMenu, isRenaming, onRename, onRenameCancel, onHoverEnter, onHoverLeave }: {
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
