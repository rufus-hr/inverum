import { Truck, Lock, Unlock } from 'lucide-react';

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

export interface LocationNode {
  id: string;
  name: string;
  children?: LocationNode[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function totalItems(box: BoxData): number {
  return box.assets.length + box.stock_items.length + box.consumables.length + box.accessories.length;
}

export function effectiveLocation(box: BoxData): string {
  if (box.status === 'in_transit') return `→ ${box.transit_record?.destination ?? '?'}`;
  return box.location?.name ?? 'Nepoznato';
}

export function allLocations(boxes: BoxData[]): string[] {
  const locs = new Set<string>();
  for (const b of boxes) {
    if (b.location?.name) locs.add(b.location.name);
    if (b.transit_record?.destination) locs.add(`→ ${b.transit_record.destination}`);
  }
  return ['Sve lokacije', ...Array.from(locs)];
}

export function boxMatchesSearch(box: BoxData, q: string): boolean {
  if (!q) return true;
  const lq = q.toLowerCase();
  if (box.inventory_number.toLowerCase().includes(lq)) return true;
  if ((box.label ?? '').toLowerCase().includes(lq)) return true;
  const hit = (items: { name: string; inventory_number: string }[]) =>
    items.some(i => i.name.toLowerCase().includes(lq) || i.inventory_number.toLowerCase().includes(lq));
  return hit(box.assets) || hit(box.stock_items) || hit(box.consumables) || hit(box.accessories);
}

export function nextInventoryNumber(boxes: BoxData[], prefix: string): string {
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
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

export function isBoxEmpty(box: BoxData): boolean {
  return totalItems(box) === 0 && box.children.every(isBoxEmpty);
}

export function sealTree(b: BoxData): BoxData {
  return { ...b, status: 'sealed', children: b.children.map(sealTree) };
}

export function updateBoxInTree(boxes: BoxData[], id: string, updater: (b: BoxData) => BoxData): BoxData[] {
  return boxes.map(b => {
    if (b.id === id) return updater(b);
    if (b.children.length) return { ...b, children: updateBoxInTree(b.children, id, updater) };
    return b;
  });
}

export function containsId(box: BoxData, id: string): boolean {
  if (box.id === id) return true;
  return box.children.some(c => containsId(c, id));
}

export function removeFromTree(boxes: BoxData[], id: string): BoxData[] {
  return boxes
    .filter(b => b.id !== id)
    .map(b => ({ ...b, children: removeFromTree(b.children, id) }));
}

export function addChildToNode(boxes: BoxData[], targetId: string, child: BoxData): BoxData[] {
  return boxes.map(b => {
    if (b.id === targetId) return { ...b, children: [...b.children, child] };
    return { ...b, children: addChildToNode(b.children, targetId, child) };
  });
}

export function findParentInTree(boxes: BoxData[], childId: string): BoxData | null {
  for (const b of boxes) {
    if (b.children.some(c => c.id === childId)) return b;
    const found = findParentInTree(b.children, childId);
    if (found) return found;
  }
  return null;
}

// ─── Status ───────────────────────────────────────────────────────────────────

export function StatusIcon({ status }: { status: BoxData['status'] }) {
  if (status === 'in_transit') return <Truck size={18} />;
  if (status === 'sealed') return <Lock size={18} />;
  return <Unlock size={18} />;
}

export function statusColor(status: BoxData['status']) {
  if (status === 'in_transit') return 'bg-blue-100 text-blue-600';
  if (status === 'sealed') return 'bg-emerald-100 text-emerald-600';
  return 'bg-slate-100 text-slate-500';
}
