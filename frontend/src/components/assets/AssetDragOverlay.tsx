import React from 'react';
import type { Asset } from '../../types';

interface AssetDragOverlayProps {
  draggingAssetId: string | null;
  assets: Asset[];
  onDragStart: (e: React.DragEvent, asset: Asset) => void;
  onDragEnd: () => void;
  onAssignOpen: (id: string) => void;
}

export function AssetDragOverlay({ draggingAssetId, assets, onDragStart, onDragEnd, onAssignOpen }: AssetDragOverlayProps) {
  // Drag ghost creation is handled inside onDragStart in the parent
  // This component is a thin wrapper to keep drag logic organized

  const handleDrop = (e: React.DragEvent, action: string) => {
    e.preventDefault();
    if (!draggingAssetId) return;

    if (action === 'assign') {
      onAssignOpen(draggingAssetId);
    } else if (action === 'stock') {
      console.log(`Asset ${draggingAssetId} returned to stock`);
    } else if (action === 'decommission') {
      console.log(`Asset ${draggingAssetId} decommissioned`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return null; // Drop zones rendered inline where needed
}

// Export drag start handler creator
export function createDragGhost(e: React.DragEvent, asset: Asset) {
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', asset.id);

  const ghost = document.createElement('div');
  ghost.id = 'drag-ghost';
  ghost.style.position = 'absolute';
  ghost.style.top = '-1000px';
  ghost.style.left = '-1000px';
  ghost.className = 'flex items-center gap-2 bg-slate-900 border border-slate-700 shadow-2xl rounded-lg px-3 py-2 font-mono text-sm font-bold text-white z-[9999]';

  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></svg>`;
  ghost.innerHTML = `${svgIcon}<span>${asset.inventoryNumber}</span>`;
  document.body.appendChild(ghost);

  e.dataTransfer.setDragImage(ghost, -10, -10);

  setTimeout(() => {
    if (document.body.contains(ghost)) document.body.removeChild(ghost);
  }, 0);
}
