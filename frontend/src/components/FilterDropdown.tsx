import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Filter } from 'lucide-react';
import type { TreeNodeData } from '../types';
import type { UseFilterResult } from '../hooks/useFilter';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FilterDepth =
  | 'organizations'  // root.children, no sub-children (e.g. dashboard org filter)
  | 'departments'    // root.children[*].children (leaf departments only)
  | 'all'            // root.children with full subtree (e.g. assets org filter)
  | 'full';          // entire tree including root

export interface FilterConfig {
  title: string;
  allLabel: string;
  icon: React.ReactNode;
  tree: TreeNodeData[];
  depth: FilterDepth;
}

// ─── Tree slice helper ────────────────────────────────────────────────────────

function getNodes(tree: TreeNodeData[], depth: FilterDepth): TreeNodeData[] {
  const root = tree[0];
  if (!root) return [];
  switch (depth) {
    case 'full':
      return tree;
    case 'organizations':
      return (root.children ?? []).map(({ children: _c, ...n }) => n);
    case 'departments':
      return (root.children ?? [])
        .flatMap(org => org.children ?? [])
        .map(({ children: _c, ...n }) => n);
    case 'all':
      return root.children ?? [];
  }
}

// ─── TreeNode ─────────────────────────────────────────────────────────────────

export const TreeNode: React.FC<{
  node: TreeNodeData;
  selected: Set<string>;
  onToggle: (node: TreeNodeData) => void;
  level?: number;
  maxDepth?: number;
}> = ({ node, selected, onToggle, level = 0, maxDepth }) => {
  const [expanded, setExpanded] = useState(true);
  const isSelected = selected.has(node.id);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const canExpand = hasChildren && (maxDepth === undefined || level < maxDepth);

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 pr-2 rounded cursor-pointer group transition-colors
          ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <div className="w-4 flex items-center justify-center">
          {canExpand && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="p-0.5 text-slate-400 hover:text-slate-700 rounded"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 flex-1 cursor-pointer">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(node)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className={`text-sm truncate transition-colors
            ${isSelected ? 'text-blue-700 font-bold' : 'text-slate-700 font-semibold group-hover:text-slate-900'}`}>
            {node.label}
          </span>
        </label>
      </div>
      {canExpand && expanded && (
        <div className="mt-0.5">
          {node.children!.map(child => (
            <TreeNode key={child.id} node={child} selected={selected} onToggle={onToggle} level={level + 1} maxDepth={maxDepth} />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── HeaderDropdown ───────────────────────────────────────────────────────────

export function HeaderDropdown({
  title,
  subtitle,
  icon,
  isActive,
  disabled = false,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  isActive: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors border
          ${disabled
            ? 'border-transparent cursor-not-allowed opacity-35'
            : isActive
              ? 'bg-blue-50 border-blue-200 hover:bg-blue-100 cursor-pointer'
              : 'border-transparent hover:border-slate-200 hover:bg-slate-50 cursor-pointer'}`}
      >
        <div className="flex flex-col">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive && !disabled ? 'text-blue-600' : 'text-slate-500'}`}>
            {title}
          </span>
          <span className={`text-sm font-semibold flex items-center gap-1.5 ${isActive && !disabled ? 'text-blue-800' : 'text-slate-900'}`}>
            {icon} {subtitle}
          </span>
        </div>
        {!disabled && <ChevronDown size={14} className={`${isActive ? 'text-blue-500' : 'text-slate-400'} ml-1`} />}
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── FilterDropdown ───────────────────────────────────────────────────────────

export function FilterDropdown({ config, filter }: { config: FilterConfig; filter: UseFilterResult }) {
  const nodes = getNodes(config.tree, config.depth);
  const subtitle = filter.selected.size > 0 ? `${filter.selected.size} selected` : config.allLabel;

  return (
    <HeaderDropdown
      title={config.title}
      subtitle={subtitle}
      icon={config.icon}
      isActive={filter.selected.size > 0}
    >
      <div className="p-2 max-h-80 overflow-y-auto w-72">
        {nodes.map(node => (
          <TreeNode key={node.id} node={node} selected={filter.selected} onToggle={filter.toggle} />
        ))}
      </div>
    </HeaderDropdown>
  );
}

// ─── CategoryFilter ───────────────────────────────────────────────────────────
// Uses HeaderDropdown for consistent header styling.
// selected = Set of type strings (e.g. 'Laptop', 'Server').

export function CategoryFilter({ selected, onChange, disabled = false, categories = [] }: { selected: Set<string>; onChange: (s: Set<string>) => void; disabled?: boolean; categories?: { id: string; label: string; icon: React.ReactNode; types: string[] }[] }) {
  const assetCategories = categories;
  const toggleCategory = (types: string[]) => {
    const allSel = types.every(t => selected.has(t));
    const next = new Set(selected);
    types.forEach(t => allSel ? next.delete(t) : next.add(t));
    onChange(next);
  };

  const toggleType = (type: string) => {
    const next = new Set(selected);
    next.has(type) ? next.delete(type) : next.add(type);
    onChange(next);
  };

  const subtitle = selected.size > 0 ? `${selected.size} selected` : 'All Categories';

  return (
    <HeaderDropdown
      title="Asset Categories"
      subtitle={subtitle}
      icon={<Filter size={16} className="text-slate-400" />}
      disabled={disabled}
      isActive={selected.size > 0}
    >
      <div className="p-4 w-72 max-h-[60vh] overflow-y-auto">
        {assetCategories.map(cat => {
          const allSel = cat.types.every(t => selected.has(t));
          const someSel = cat.types.some(t => selected.has(t));
          return (
            <div key={cat.id} className="mb-4 last:mb-0">
              <div
                className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => toggleCategory(cat.types)}
              >
                <input
                  type="checkbox"
                  checked={allSel}
                  ref={input => { if (input) input.indeterminate = someSel && !allSel; }}
                  readOnly
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                {cat.icon} {cat.label}
              </div>
              <div className="space-y-1.5 pl-7">
                {cat.types.map(type => (
                  <label key={type} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
                    <input
                      type="checkbox"
                      checked={selected.has(type)}
                      onChange={() => toggleType(type)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </HeaderDropdown>
  );
}
