import React, { useState } from 'react';
import {
  ChevronRight, Plus, Folder, File, Globe, Building2, Users, User,
  MapPin, Server, Archive, Lock, Layers, Inbox
} from 'lucide-react';
import type { TreeNodeData } from '../types';

export function TreeView({ data, onSelect, selectedId, onAdd, onDelete, showWorkspaces = true, showStorageUnits = true, showRacks = true }: {
  data: TreeNodeData[];
  onSelect: (node: TreeNodeData) => void;
  selectedId: string | null;
  onAdd?: (id: string) => void;
  onDelete?: (id: string) => void;
  showWorkspaces?: boolean;
  showStorageUnits?: boolean;
  showRacks?: boolean;
}) {
  return (
    <div className="space-y-1">
      {data.map(node => (
        <TreeItem key={node.id} node={node} onSelect={onSelect} selectedId={selectedId} level={0} onAdd={onAdd} onDelete={onDelete} showWorkspaces={showWorkspaces} showStorageUnits={showStorageUnits} showRacks={showRacks} />
      ))}
    </div>
  );
}

const TreeItem: React.FC<{
  node: TreeNodeData;
  onSelect: (node: TreeNodeData) => void;
  selectedId: string | null;
  level: number;
  onAdd?: (id: string) => void;
  onDelete?: (id: string) => void;
  showWorkspaces?: boolean;
  showStorageUnits?: boolean;
  showRacks?: boolean;
}> = ({ node, onSelect, selectedId, level, onAdd, onDelete, showWorkspaces = true, showStorageUnits = true, showRacks = true }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const isLeaf = !node.children || node.children.length === 0;
  const isSelected = selectedId === node.id;

  const isTenant = node.id.startsWith('tenant');
  const isOrg = node.id.startsWith('org');
  const isDept = node.id.startsWith('dept');
  const isWorkspace = node.id.startsWith('ws');
  const isRack = node.id.startsWith('rack');
  const isShelf = node.id.startsWith('shelf');
  const isCabinet = node.id.startsWith('cab');
  const isSafe = node.id.startsWith('safe');
  const isDrawer = node.id.startsWith('drawer');
  const isLoc = node.id.startsWith('loc');
  const isEmployee = node.id.startsWith('e');

  const isStorageUnit = isCabinet || isSafe || isShelf || isDrawer;

  if (isWorkspace && !showWorkspaces) return null;
  if (isStorageUnit && !showStorageUnits) return null;
  if (isRack && !showRacks) return null;

  let Icon = Folder;
  let iconColor = "text-blue-400";

  if (isTenant) { Icon = Globe; iconColor = "text-indigo-500"; }
  else if (isOrg) { Icon = Building2; iconColor = "text-blue-500"; }
  else if (isDept) { Icon = Users; iconColor = "text-emerald-500"; }
  else if (isWorkspace) { Icon = User; iconColor = node.isOpenSpace ? "text-teal-500" : node.assignedTo ? "text-amber-500" : "text-slate-400"; }
  else if (isRack) { Icon = Server; iconColor = "text-slate-600"; }
  else if (isCabinet) { Icon = Archive; iconColor = "text-slate-500"; }
  else if (isSafe) { Icon = Lock; iconColor = "text-slate-700"; }
  else if (isShelf) { Icon = Layers; iconColor = "text-slate-400"; }
  else if (isDrawer) { Icon = Inbox; iconColor = "text-slate-400"; }
  else if (isLoc) { Icon = MapPin; iconColor = "text-purple-500"; }
  else if (isEmployee) { Icon = User; iconColor = "text-slate-400"; }
  else if (isLeaf) { Icon = File; iconColor = "text-slate-400"; }

  const getAssetCount = (node: TreeNodeData): number => {
    const base = (node.id.length * 7) % 50;
    if (node.children) {
      return base + node.children.reduce((acc, child) => acc + getAssetCount(child), 0);
    }
    return base;
  };

  const assetCount = getAssetCount(node);

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors group ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
        style={{ paddingLeft: `${level * 1.25 + 0.5}rem` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {!isLeaf ? (
          <div
            className="cursor-pointer p-0.5 rounded hover:bg-slate-200"
            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          >
            <ChevronRight size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </div>
        ) : (
          <span className="w-[18px]"></span>
        )}
        <div
          className="flex items-center gap-2 flex-1 cursor-pointer overflow-hidden"
          onClick={() => onSelect(node)}
        >
          {isWorkspace ? (
            <div className="relative flex items-center group/tooltip">
              <Icon size={14} className={iconColor} />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 z-50 pointer-events-none
                opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150
                bg-slate-900 text-white text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
                {node.isOpenSpace ? 'Open space' : node.assignedTo ? `Assigned to: ${node.assignedTo}` : 'Unassigned'}
              </div>
            </div>
          ) : (
            <Icon size={14} className={iconColor} />
          )}
          <span className={`text-sm flex-1 truncate ${isSelected ? 'font-bold' : 'font-medium'}`}>
            {node.label}
            {assetCount > 0 && (
              <span className="ml-1 text-[10px] text-slate-400 font-normal">({assetCount})</span>
            )}
          </span>
        </div>

        {isHovered && !isEmployee && (
          <div className="flex items-center gap-1">
            {onAdd && (
              <button
                onClick={(e) => { e.stopPropagation(); onAdd(node.id); }}
                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                title="Add Sub-item"
              >
                <Plus size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      {isOpen && !isLeaf && (
        <div className="mt-0.5">
          {node.children!.map(child => (
            <TreeItem key={child.id} node={child} onSelect={onSelect} selectedId={selectedId} level={level + 1} onAdd={onAdd} onDelete={onDelete} showWorkspaces={showWorkspaces} showStorageUnits={showStorageUnits} showRacks={showRacks} />
          ))}
        </div>
      )}
    </div>
  );
};
