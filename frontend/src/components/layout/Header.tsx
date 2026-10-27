import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Building2, MapPin, User } from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';
import { TreeNodeData } from '../../types';

// Helper for Header Dropdowns
interface HeaderDropdownProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive?: boolean;
  isSingleOption?: boolean;
}

const HeaderDropdown: React.FC<HeaderDropdownProps> = ({ title, subtitle, icon, children, isActive, isSingleOption }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (isSingleOption) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-transparent">
        {icon}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
          <span className="text-sm font-semibold text-slate-900">{subtitle}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div 
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors border ${isOpen || isActive ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {icon}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
          <span className={`text-sm font-semibold ${isActive ? 'text-blue-700' : 'text-slate-900'}`}>{subtitle}</span>
        </div>
        <ChevronDown size={14} className={`text-slate-400 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
            {children}
          </div>
        </>
      )}
    </div>
  );
};

// Tree Node for Dropdowns
const TreeNode = ({ node, selected, onToggle, depth = 0 }: { key?: React.Key, node: TreeNodeData, selected: Set<string>, onToggle: (n: TreeNodeData) => void, depth?: number }) => {
  const isSelected = selected.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  
  return (
    <div className="flex flex-col">
      <div 
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-slate-50 ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onToggle(node)}
      >
        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
          {isSelected && <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3 text-white"><path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
        <span className="text-sm font-medium truncate">{node.label}</span>
      </div>
      {hasChildren && node.children?.map(child => (
        <TreeNode key={child.id} node={child} selected={selected} onToggle={onToggle} depth={depth + 1} />
      ))}
    </div>
  );
};

export default function Header() {
  const { tenantName, currentUser, locTree } = useAppContext();
  const orgTree = locTree;
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set());
  const [selectedLocs, setSelectedLocs] = useState<Set<string>>(new Set());

  const getBranchIds = (node: TreeNodeData): string[] => {
    let ids = [node.id];
    if (node.children) {
      node.children.forEach(child => {
        ids = [...ids, ...getBranchIds(child)];
      });
    }
    return ids;
  };

  const toggleTreeNode = (node: TreeNodeData, selectedSet: Set<string>, setFunction: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const branchIds = getBranchIds(node);
    const newSet = new Set(selectedSet);
    
    if (newSet.has(node.id)) {
      branchIds.forEach(id => newSet.delete(id));
    } else {
      branchIds.forEach(id => newSet.add(id));
    }
    setFunction(newSet);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm">
      {/* Global Context Path (Tenant -> Org -> Loc) */}
      <div className="flex items-center gap-1">
        {/* Tenant */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-md transition-colors border border-transparent">
          <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
            {(tenantName || 'TN').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tenant</span>
            <span className="text-sm font-semibold text-slate-900">{tenantName || 'Tenant'}</span>
          </div>
        </div>

        <ChevronRight size={16} className="text-slate-300 mx-1" />

        {/* Organization Dropdown */}
        <HeaderDropdown 
          title="Organization" 
          subtitle={orgTree.length === 1 ? orgTree[0].label : (selectedOrgs.size > 0 ? `${selectedOrgs.size} selected` : 'All Organizations')}
          icon={<Building2 size={16} className="text-slate-400" />}
          isActive={selectedOrgs.size > 0}
          isSingleOption={orgTree.length === 1 && (!orgTree[0].children || orgTree[0].children.length === 0)}
        >
          <div className="p-2 max-h-80 overflow-y-auto w-72">
            {orgTree.map(node => (
              <TreeNode 
                key={node.id} 
                node={node} 
                selected={selectedOrgs} 
                onToggle={(n) => toggleTreeNode(n, selectedOrgs, setSelectedOrgs)} 
              />
            ))}
          </div>
        </HeaderDropdown>

        <ChevronRight size={16} className="text-slate-300 mx-1" />

        {/* Location Dropdown */}
        <HeaderDropdown 
          title="Location" 
          subtitle={locTree.length === 1 ? locTree[0].label : (selectedLocs.size > 0 ? `${selectedLocs.size} selected` : 'All Locations')}
          icon={<MapPin size={16} className="text-slate-400" />}
          isActive={selectedLocs.size > 0}
          isSingleOption={locTree.length === 1 && (!locTree[0].children || locTree[0].children.length === 0)}
        >
          <div className="p-2 max-h-80 overflow-y-auto w-72">
            {locTree.map(node => (
              <TreeNode 
                key={node.id} 
                node={node} 
                selected={selectedLocs} 
                onToggle={(n) => toggleTreeNode(n, selectedLocs, setSelectedLocs)} 
              />
            ))}
          </div>
        </HeaderDropdown>
      </div>

      {/* User Profile */}
      <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 px-2 py-1.5 rounded-md transition-colors">
        <span className="text-sm font-medium text-slate-700">{currentUser?.display_name || currentUser?.email || 'Admin'}</span>
        <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 border border-slate-300">
          <User size={16} />
        </div>
      </div>
    </header>
  );
}
