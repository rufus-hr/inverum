import type { TreeNodeData } from '../types';

export const getBranchIds = (node: TreeNodeData): string[] => {
  let ids = [node.id];
  if (node.children) {
    node.children.forEach(child => {
      ids = [...ids, ...getBranchIds(child)];
    });
  }
  return ids;
};
