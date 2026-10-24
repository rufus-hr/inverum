import React, { useState } from 'react';
import {
  Truck, MapPin, Package, Cpu, Zap, Puzzle, ChevronRight, ChevronDown, X,
} from 'lucide-react';
import { BoxData, BoxAsset, BoxStockItem, statusColor, StatusIcon } from './BoxTypesAndHelpers';

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

export function BoxDetail({ box, onClose }: { box: BoxData; onClose: () => void }) {
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
        {detailBox.assets.length === 0 &&
          detailBox.stock_items.length === 0 &&
          detailBox.consumables.length === 0 &&
          detailBox.accessories.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-400 italic">
              Ovaj box nema direktnih stavki.
            </div>
          )}
      </div>
    </div>
  );
}
