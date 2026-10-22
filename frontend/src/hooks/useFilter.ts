import { useState } from 'react';
import type { TreeNodeData } from '../types';
import { getBranchIds } from '../utils/tree';

export interface UseFilterResult {
  selected: Set<string>;
  toggle: (node: TreeNodeData) => void;
  clear: () => void;
}

export function useFilter(initial: Set<string> = new Set()): UseFilterResult {
  const [selected, setSelected] = useState<Set<string>>(initial);

  const toggle = (node: TreeNodeData) => {
    const branchIds = getBranchIds(node);
    const newSet = new Set(selected);
    if (newSet.has(node.id)) {
      branchIds.forEach(id => newSet.delete(id));
    } else {
      branchIds.forEach(id => newSet.add(id));
    }
    setSelected(newSet);
  };

  const clear = () => setSelected(new Set());

  return { selected, toggle, clear };
}
