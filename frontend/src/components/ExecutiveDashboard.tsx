import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  TrendingUp, AlertTriangle, CheckCircle2, ShieldCheck, Activity,
  Box, ArrowUpRight, ArrowDownRight, DollarSign, ShieldAlert,
  HardDrive, Trash2, CheckCircle, ClipboardList, Filter, X,
  ChevronDown, Building2, Layers
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area, ComposedChart
} from 'recharts';
import type { Asset, AuditLogEntry } from '../types';

type AssetCategory = { id: string; label: string; icon: React.ReactNode; types: string[] };

type TopTabType = 'overview' | 'summary' | 'lifecycle' | 'risk' | 'capex' | 'vendors';

interface ExecutiveDashboardProps {
  assets: Asset[];
  auditLog: AuditLogEntry[];
  selectedOrgs: Set<string>;
  activeTab: TopTabType;
  setActiveTab: (tab: TopTabType) => void;
  catSelected: Set<string>;
  assetCategories?: AssetCategory[];
}

type TopTab = TopTabType;

const COLORS = ['#10b981', '#f59e0b', '#94a3b8', '#ef4444', '#8b5cf6', '#3b82f6'];

const TIMEFRAME_OPTIONS = ['3m', '6m', '1y', '2y', '5y'];

// Returns category IDs active for a given type selection (empty = all)
function activeCatIds(selected: Set<string>, assetCategories: AssetCategory[]): Set<string> {
  if (selected.size === 0) return new Set(assetCategories.map(c => c.id));
  const ids = new Set<string>();
  assetCategories.forEach(cat => { if (cat.types.some(t => selected.has(t))) ids.add(cat.id); });
  return ids;
}

// --- Filter bar component ---
function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter size={13} className="text-slate-400 shrink-0" />
      {children}
    </div>
  );
}

function FilterSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md pl-2.5 pr-6 py-1.5 focus:outline-none focus:border-blue-400 hover:border-slate-300 transition-colors cursor-pointer"
      >
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

function TimeframePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex bg-slate-100 p-0.5 rounded-md ml-auto">
      {TIMEFRAME_OPTIONS.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${value === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// --- KPI Card ---
function KpiCard({ title, value, sub, icon, trend, trendUp }: {
  title: string; value: string | number; sub: string;
  icon: React.ReactNode; trend?: string; trendUp?: boolean;
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="flex items-center gap-1 text-xs">
        {trend && (
          <>
            {trendUp
              ? <ArrowUpRight size={13} className="text-emerald-500" />
              : <ArrowDownRight size={13} className="text-emerald-500" />}
            <span className="text-emerald-600 font-semibold">{trend}</span>
            <span className="text-slate-400 ml-1">{sub}</span>
          </>
        )}
        {!trend && <span className="text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

// ─── TAB: OVERVIEW ────────────────────────────────────────────────────────────
function OverviewTab({ assets, auditLog }: { assets: Asset[]; auditLog: AuditLogEntry[] }) {
  const totalAssets = assets.length;
  const activeAssets = assets.filter(a => a.status === 'Active').length;
  const inRepairAssets = assets.filter(a => a.status === 'In Repair').length;
  const storageAssets = assets.filter(a => a.status === 'Storage').length;
  const pendingAssets = assets.filter(a => a.status === 'Pending Checklist').length;

  const totalValue = useMemo(() => assets.reduce((acc, a) => {
    if (a.type === 'Server') return acc + 5000;
    if (a.type === 'Laptop') return acc + 1200;
    if (a.type === 'Mobile Phone') return acc + 800;
    if (a.type === 'Switch') return acc + 2000;
    return acc + 500;
  }, 0), [assets]);

  const top5 = [
    { name: 'Laptops', count: 450, color: '#3b82f6' },
    { name: 'Monitors', count: 320, color: '#6366f1' },
    { name: 'Servers', count: 150, color: '#10b981' },
    { name: 'Switches', count: 85, color: '#f59e0b' },
    { name: 'Mobile', count: 60, color: '#8b5cf6' },
  ];
  const maxTop5 = Math.max(...top5.map(a => a.count));

  const statusData = [
    { name: 'Active', value: activeAssets },
    { name: 'In Repair', value: inRepairAssets },
    { name: 'Storage', value: storageAssets },
    { name: 'Pending', value: pendingAssets },
  ];

  return (
    <div className="flex flex-1 overflow-hidden gap-0">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-5 gap-4">
          <KpiCard title="Total Assets" value={totalAssets} sub="vs last year" trend="12%" trendUp icon={<Box size={15} />} />
          <KpiCard title="Est. Value" value={`€${totalValue.toLocaleString()}`} sub="vs last year" trend="4.3%" trendUp icon={<DollarSign size={15} />} />
          <KpiCard title="In Repair" value={inRepairAssets} sub="vs last month" trend="2%" trendUp={false} icon={<AlertTriangle size={15} />} />
          <KpiCard title="Utilisation" value={`${Math.round((activeAssets / totalAssets) * 100)}%`} sub="Target: 85%" icon={<Activity size={15} />} />
          <KpiCard title="Open Tasks" value={42} sub="12 wipes · 5 DC ops" icon={<ClipboardList size={15} />} />
        </div>

        {/* Top 5 + Pie */}
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-5">Top 5 Asset Categories</h3>
            <div className="space-y-4">
              {top5.map(a => (
                <div key={a.name} className="flex items-center gap-3">
                  <div className="w-28 text-sm font-medium text-slate-600 shrink-0">{a.name}</div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(a.count / maxTop5) * 100}%`, backgroundColor: a.color }} />
                  </div>
                  <div className="w-10 text-right text-sm font-bold text-slate-900">{a.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Status Breakdown</h3>
            <div className="h-44 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value">
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-900">{totalAssets}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1">
              {statusData.map((s, i) => (
                <div key={s.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-xs text-slate-600">{s.name} <span className="font-bold">{s.value}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Audit Log */}
      <div className="w-72 border-l border-slate-200 bg-white flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-slate-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Live Audit Log</span>
          </div>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="relative border-l-2 border-slate-100 ml-3 space-y-5 pb-4">
            {auditLog.map(log => (
              <div key={log.id} className="relative pl-5">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center">
                  <div className={`w-1.5 h-1.5 rounded-full ${log.action.includes('Ticket') ? 'bg-amber-500' : log.action.includes('Assigned') ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{log.date}</p>
                <p className="text-xs font-semibold text-slate-900 mt-0.5">{log.action}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{log.details}</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-200 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-slate-600">{log.user.charAt(0)}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{log.user}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: LIFECYCLE ───────────────────────────────────────────────────────────
const lifecycleData: Record<string, { month: string; new: number; repairs: number; tickets: number; decommissioned: number; totalAssets: number }[]> = {
  '3m': [
    { month: 'Feb', new: 20, repairs: 14, tickets: 38, decommissioned: 5,  totalAssets: 1158 },
    { month: 'Mar', new: 25, repairs: 16, tickets: 42, decommissioned: 10, totalAssets: 1173 },
    { month: 'Apr', new: 18, repairs: 11, tickets: 31, decommissioned: 7,  totalAssets: 1184 },
  ],
  '6m': [
    { month: 'Nov', new: 25, repairs: 12, tickets: 35, decommissioned: 10, totalAssets: 1088 },
    { month: 'Dec', new: 30, repairs: 18, tickets: 50, decommissioned: 15, totalAssets: 1103 },
    { month: 'Jan', new: 50, repairs: 10, tickets: 45, decommissioned: 10, totalAssets: 1143 },
    { month: 'Feb', new: 20, repairs: 14, tickets: 38, decommissioned: 5,  totalAssets: 1158 },
    { month: 'Mar', new: 25, repairs: 16, tickets: 42, decommissioned: 10, totalAssets: 1173 },
    { month: 'Apr', new: 18, repairs: 11, tickets: 31, decommissioned: 7,  totalAssets: 1184 },
  ],
  '1y': [
    { month: 'May', new: 15, repairs: 8,  tickets: 28, decommissioned: 3,  totalAssets: 1000 },
    { month: 'Jun', new: 18, repairs: 9,  tickets: 30, decommissioned: 4,  totalAssets: 1014 },
    { month: 'Jul', new: 22, repairs: 11, tickets: 33, decommissioned: 6,  totalAssets: 1030 },
    { month: 'Aug', new: 10, repairs: 7,  tickets: 25, decommissioned: 2,  totalAssets: 1038 },
    { month: 'Sep', new: 28, repairs: 13, tickets: 37, decommissioned: 8,  totalAssets: 1058 },
    { month: 'Oct', new: 20, repairs: 15, tickets: 40, decommissioned: 5,  totalAssets: 1073 },
    { month: 'Nov', new: 25, repairs: 12, tickets: 35, decommissioned: 10, totalAssets: 1088 },
    { month: 'Dec', new: 30, repairs: 18, tickets: 50, decommissioned: 15, totalAssets: 1103 },
    { month: 'Jan', new: 50, repairs: 10, tickets: 45, decommissioned: 10, totalAssets: 1143 },
    { month: 'Feb', new: 20, repairs: 14, tickets: 38, decommissioned: 5,  totalAssets: 1158 },
    { month: 'Mar', new: 25, repairs: 16, tickets: 42, decommissioned: 10, totalAssets: 1173 },
    { month: 'Apr', new: 18, repairs: 11, tickets: 31, decommissioned: 7,  totalAssets: 1184 },
  ],
  '2y': [
    { month: 'Q1 25', new: 65, repairs: 30, tickets: 110, decommissioned: 18, totalAssets: 900  },
    { month: 'Q2 25', new: 55, repairs: 35, tickets: 95,  decommissioned: 22, totalAssets: 933  },
    { month: 'Q3 25', new: 70, repairs: 28, tickets: 105, decommissioned: 15, totalAssets: 988  },
    { month: 'Q4 25', new: 90, repairs: 40, tickets: 130, decommissioned: 30, totalAssets: 1048 },
    { month: 'Q1 26', new: 75, repairs: 32, tickets: 115, decommissioned: 20, totalAssets: 1103 },
    { month: 'Q2 26', new: 61, repairs: 38, tickets: 104, decommissioned: 24, totalAssets: 1140 },
  ],
  '5y': [
    { month: '2022', new: 220, repairs: 95,  tickets: 380, decommissioned: 60,  totalAssets: 600  },
    { month: '2023', new: 280, repairs: 120, tickets: 420, decommissioned: 85,  totalAssets: 795  },
    { month: '2024', new: 310, repairs: 140, tickets: 460, decommissioned: 100, totalAssets: 1005 },
    { month: '2025', new: 290, repairs: 130, tickets: 490, decommissioned: 110, totalAssets: 1185 },
    { month: '2026', new: 120, repairs: 55,  tickets: 200, decommissioned: 45,  totalAssets: 1260 },
  ],
};

const allAgingData = [
  { category: 'Servers',      categoryId: 'infrastructure', '0-2y': 30,  '2-4y': 45,  '4-6y': 40, '>6y': 35 },
  { category: 'Laptops',      categoryId: 'end-user',       '0-2y': 180, '2-4y': 150, '4-6y': 80, '>6y': 40 },
  { category: 'Desktops',     categoryId: 'end-user',       '0-2y': 60,  '2-4y': 80,  '4-6y': 55, '>6y': 25 },
  { category: 'Network',      categoryId: 'infrastructure', '0-2y': 25,  '2-4y': 35,  '4-6y': 15, '>6y': 10 },
  { category: 'Mobile',       categoryId: 'end-user',       '0-2y': 40,  '2-4y': 15,  '4-6y': 5,  '>6y': 0  },
  { category: 'Printers',     categoryId: 'peripherals',    '0-2y': 20,  '2-4y': 30,  '4-6y': 15, '>6y': 5  },
  { category: 'Monitors',     categoryId: 'end-user',       '0-2y': 100, '2-4y': 120, '4-6y': 60, '>6y': 40 },
  { category: 'Tablets',      categoryId: 'end-user',       '0-2y': 25,  '2-4y': 10,  '4-6y': 3,  '>6y': 0  },
  { category: 'Storage/NAS',  categoryId: 'infrastructure', '0-2y': 15,  '2-4y': 20,  '4-6y': 10, '>6y': 8  },
  { category: 'Peripherals',  categoryId: 'peripherals',    '0-2y': 45,  '2-4y': 60,  '4-6y': 30, '>6y': 15 },
  { category: 'Firewalls',    categoryId: 'infrastructure', '0-2y': 8,   '2-4y': 12,  '4-6y': 6,  '>6y': 3  },
  { category: 'Access Points','categoryId': 'infrastructure','0-2y': 18,  '2-4y': 22,  '4-6y': 8,  '>6y': 2  },
];
const DEFAULT_AGING_SHOWN = ['Servers', 'Laptops', 'Desktops', 'Network', 'Mobile', 'Printers'];
const MIN_AGING_COLS = 2;
const MAX_AGING_COLS = 12;

function LifecycleTab({ catSelected, assetCategories = [] }: { catSelected: Set<string>; assetCategories?: AssetCategory[] }) {
  const [timeframe, setTimeframe] = useState('1y');
  const [shownCategories, setShownCategories] = useState<string[]>(DEFAULT_AGING_SHOWN);

  const addColumn = () => {
    const next = allAgingData.find(d => !shownCategories.includes(d.category));
    if (next && shownCategories.length < Math.min(MAX_AGING_COLS, allAgingData.length)) {
      setShownCategories(prev => [...prev, next.category]);
    }
  };
  const removeColumn = () => {
    if (shownCategories.length > MIN_AGING_COLS) {
      setShownCategories(prev => prev.slice(0, -1));
    }
  };
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: string } | null>(null);
  const [cmSearch, setCmSearch] = useState('');
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const cmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (cmRef.current && !cmRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setCmSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  const catIds = activeCatIds(catSelected, assetCategories);
  const scale = catSelected.size === 0 ? 1 : (assetCategories.length > 0 ? catIds.size / assetCategories.length : 1);
  const trendData = lifecycleData[timeframe].map(d => ({
    ...d,
    new: Math.round(d.new * scale),
    repairs: Math.round(d.repairs * scale),
    tickets: Math.round(d.tickets * scale),
    decommissioned: Math.round(d.decommissioned * scale),
    totalAssets: Math.round(d.totalAssets * scale),
  }));

  const filteredAging = allAgingData.filter(d =>
    shownCategories.includes(d.category) && catIds.has(d.categoryId)
  );

  const agingDataPct = filteredAging.map(d => {
    const total = d['0-2y'] + d['2-4y'] + d['4-6y'] + d['>6y'];
    return {
      category: d.category,
      '0-2y': total ? Math.round(d['0-2y'] / total * 100) : 0,
      '2-4y': total ? Math.round(d['2-4y'] / total * 100) : 0,
      '4-6y': total ? Math.round(d['4-6y'] / total * 100) : 0,
      '>6y':  total ? Math.round(d['>6y']  / total * 100) : 0,
      _abs: { '0-2y': d['0-2y'], '2-4y': d['2-4y'], '4-6y': d['4-6y'], '>6y': d['>6y'], total },
    };
  });

  const availableToSwap = allAgingData
    .filter(d => !shownCategories.includes(d.category))
    .filter(d => cmSearch === '' || d.category.toLowerCase().includes(cmSearch.toLowerCase()));

  const swapCategory = (incoming: string) => {
    setShownCategories(prev => prev.map(c => c === contextMenu!.target ? incoming : c));
    setContextMenu(null);
    setCmSearch('');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Operational Trends</h3>
          <div className="flex items-center gap-3">
            <TimeframePicker value={timeframe} onChange={setTimeframe} />
          </div>
        </div>
        <div className="flex items-center gap-4 mb-1">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
            <span className="inline-block w-3 h-0.5 bg-slate-300 rounded" />
            Left axis — events / month
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-blue-400 font-medium">
            <span className="inline-block w-3 h-2 rounded-sm bg-blue-100 border border-blue-200" />
            Right axis — total assets
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendData} margin={{ top: 5, right: 40, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#93c5fd', fontSize: 11 }} />
              <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
              <Area yAxisId="right" type="monotone" dataKey="totalAssets" name="Total Assets" fill="#dbeafe" stroke="#93c5fd" strokeWidth={1.5} fillOpacity={0.35} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="new" name="New" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="repairs" name="Repairs" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="tickets" name="Tickets" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="decommissioned" name="Decommissioned" stroke="#ef4444" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Asset Age Distribution</h3>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-400">Right-click a column to swap</span>
            <div className="flex items-center gap-1">
              <button
                onClick={removeColumn}
                disabled={shownCategories.length <= MIN_AGING_COLS}
                className="w-5 h-5 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-sm leading-none"
              >−</button>
              <span className="text-xs text-slate-600 font-medium w-5 text-center">{shownCategories.length}</span>
              <button
                onClick={addColumn}
                disabled={shownCategories.length >= Math.min(MAX_AGING_COLS, allAgingData.length)}
                className="w-5 h-5 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-sm leading-none"
              >+</button>
            </div>
          </div>
        </div>
        <div
          className="h-64 relative"
          onContextMenu={(e) => {
            e.preventDefault();
            if (hoveredCategory) {
              setContextMenu({ x: e.clientX, y: e.clientY, target: hoveredCategory });
            }
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={agingDataPct}
              margin={{ top: 5, right: 20, left: -10, bottom: 0 }}
              onMouseMove={(state) => {
                if (state.isTooltipActive) setHoveredCategory(state.activeLabel as string ?? null);
              }}
              onMouseLeave={() => setHoveredCategory(null)}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} ticks={[0, 25, 50, 75, 100]} />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const abs = (payload[0]?.payload as any)?._abs;
                  const colors: Record<string, string> = { '0-2y': '#10b981', '2-4y': '#3b82f6', '4-6y': '#f59e0b', '>6y': '#ef4444' };
                  const names: Record<string, string> = { '0-2y': '0–2 years', '2-4y': '2–4 years', '4-6y': '4–6 years', '>6y': '>6 years' };
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-xl p-3 text-xs min-w-[180px]">
                      <div className="font-semibold text-slate-800 mb-2">{label}</div>
                      {payload.map((p: any) => (
                        <div key={p.dataKey} className="flex items-center justify-between gap-3 py-0.5">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colors[p.dataKey] }} />
                            <span className="text-slate-500">{names[p.dataKey]}</span>
                          </span>
                          <span className="font-medium text-slate-800 tabular-nums">
                            {p.value}% <span className="text-slate-400 font-normal">({abs?.[p.dataKey]})</span>
                          </span>
                        </div>
                      ))}
                      <div className="border-t border-slate-100 mt-1.5 pt-1.5 flex justify-between text-slate-500">
                        <span>Total</span>
                        <span className="font-medium text-slate-700">{abs?.total} units</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
              <Bar dataKey="0-2y" name="0–2 years" stackId="a" fill="#10b981" radius={[0, 0, 3, 3]} />
              <Bar dataKey="2-4y" name="2–4 years" stackId="a" fill="#3b82f6" />
              <Bar dataKey="4-6y" name="4–6 years" stackId="a" fill="#f59e0b" />
              <Bar dataKey=">6y" name=">6 years" stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {contextMenu && (
            <div
              ref={cmRef}
              style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
              className="bg-white border border-slate-200 rounded-lg shadow-xl p-2 w-52"
            >
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-2 pt-1 pb-1.5">
                Replace <span className="text-slate-700 normal-case font-bold">{contextMenu.target}</span> with:
              </div>
              <input
                autoFocus
                value={cmSearch}
                onChange={e => setCmSearch(e.target.value)}
                placeholder="Search types..."
                className="w-full text-xs border border-slate-200 rounded-md px-2.5 py-1.5 mb-1 focus:outline-none focus:border-blue-400"
              />
              <div className="max-h-44 overflow-y-auto">
                {availableToSwap.length === 0
                  ? <div className="text-xs text-slate-400 px-2 py-1.5">No results</div>
                  : availableToSwap.map(d => (
                    <div
                      key={d.category}
                      onClick={() => swapCategory(d.category)}
                      className="text-xs px-2 py-1.5 rounded cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors text-slate-700"
                    >
                      {d.category}
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TAB: RISK & COMPLIANCE ───────────────────────────────────────────────────
const riskRows = [
  // end-user
  { type: 'Laptop',          categoryId: 'end-user',       count: 120, avgAge: 2.5, eol12m: 22, risk: 'Medium' },
  { type: 'Desktop',         categoryId: 'end-user',       count: 65,  avgAge: 3.4, eol12m: 15, risk: 'Medium' },
  { type: 'Monitor',         categoryId: 'end-user',       count: 180, avgAge: 3.8, eol12m: 30, risk: 'Low' },
  { type: 'Mobile Phone',    categoryId: 'end-user',       count: 58,  avgAge: 1.8, eol12m: 12, risk: 'Low' },
  { type: 'Tablet',          categoryId: 'end-user',       count: 22,  avgAge: 2.2, eol12m: 5,  risk: 'Low' },
  // infrastructure
  { type: 'Server',          categoryId: 'infrastructure', count: 45,  avgAge: 4.8, eol12m: 18, risk: 'High' },
  { type: 'Firewall',        categoryId: 'infrastructure', count: 8,   avgAge: 5.1, eol12m: 8,  risk: 'Critical' },
  { type: 'Router',          categoryId: 'infrastructure', count: 14,  avgAge: 4.2, eol12m: 6,  risk: 'High' },
  { type: 'Switch',          categoryId: 'infrastructure', count: 85,  avgAge: 3.2, eol12m: 5,  risk: 'Low' },
  { type: 'Access Point',    categoryId: 'infrastructure', count: 32,  avgAge: 2.1, eol12m: 2,  risk: 'Low' },
  // peripherals
  { type: 'Printer',         categoryId: 'peripherals',    count: 30,  avgAge: 4.6, eol12m: 10, risk: 'High' },
  { type: 'Scanner',         categoryId: 'peripherals',    count: 12,  avgAge: 5.3, eol12m: 7,  risk: 'High' },
  { type: 'Docking Station', categoryId: 'peripherals',    count: 95,  avgAge: 2.8, eol12m: 18, risk: 'Medium' },
  { type: 'IP Phone',        categoryId: 'peripherals',    count: 40,  avgAge: 4.1, eol12m: 15, risk: 'High' },
];

const riskBadge = (r: string) => ({
  Critical: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-emerald-100 text-emerald-700',
}[r] ?? 'bg-slate-100 text-slate-600');

function RiskTab({ catSelected, assetCategories = [] }: { catSelected: Set<string>; assetCategories?: AssetCategory[] }) {
  const [riskFilter, setRiskFilter] = useState('All Levels');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const catIds = activeCatIds(catSelected, assetCategories);
  const filtered = riskRows
    .filter(r => catIds.has(r.categoryId) && (riskFilter === 'All Levels' || r.risk === riskFilter))
    .slice()
    .sort((a, b) => sortDir === 'desc' ? b.avgAge - a.avgAge : a.avgAge - b.avgAge);

  const riskCounts = ['Critical', 'High', 'Medium', 'Low'].map(level => ({
    name: level,
    value: filtered.filter(r => r.risk === level).length,
    color: level === 'Critical' ? '#ef4444' : level === 'High' ? '#f97316' : level === 'Medium' ? '#f59e0b' : '#10b981',
  })).filter(d => d.value > 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Risk Summary */}
      <div className="grid grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col items-center justify-center">
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskCounts} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                  {riskCounts.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
            {riskCounts.map(d => (
              <span key={d.name} className="flex items-center gap-1 text-xs text-slate-600">
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                {d.name} <span className="font-bold text-slate-800">{d.value}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-4 content-start">
          {['Critical', 'High', 'Medium', 'Low'].map(level => {
            const count = filtered.filter(r => r.risk === level).length;
            const color = level === 'Critical' ? 'bg-red-50 border-red-200 text-red-700' : level === 'High' ? 'bg-orange-50 border-orange-200 text-orange-700' : level === 'Medium' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
            const eolSum = filtered.filter(r => r.risk === level).reduce((s, r) => s + r.eol12m, 0);
            return (
              <div key={level} className={`rounded-xl border p-4 ${color}`}>
                <div className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">{level}</div>
                <div className="text-3xl font-bold">{count}</div>
                <div className="text-xs opacity-70 mt-1">{eolSum} assets EOL &lt;12m</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* EOL Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Aging Infrastructure & EOL Risk</h3>
          <FilterBar>
            <FilterSelect value={riskFilter} onChange={setRiskFilter} options={['All Levels', 'Critical', 'High', 'Medium', 'Low']} />
          </FilterBar>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Asset Category', 'Count'].map(h => (
                <th key={h} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
              <th
                className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-800 transition-colors"
                onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
              >
                <span className="flex items-center gap-1">
                  Avg. Age
                  <span className="text-slate-400">{sortDir === 'desc' ? '↓' : '↑'}</span>
                </span>
              </th>
              {['EOL < 12m', 'Risk'].map(h => (
                <th key={h} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((row, i) => {
              const lineColor =
                row.risk === 'Critical' ? 'bg-red-500' :
                row.risk === 'High'     ? 'bg-orange-500' :
                row.risk === 'Medium'   ? 'bg-amber-400' :
                                          'bg-emerald-500';
              return (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900 relative">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${lineColor} opacity-80`} />
                  {row.type}
                </td>
                <td className="px-5 py-3 text-slate-600">{row.count}</td>
                <td className="px-5 py-3 text-slate-600">{row.avgAge}y</td>
                <td className="px-5 py-3 font-bold text-slate-900">{row.eol12m}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${riskBadge(row.risk)}`}>{row.risk}</span>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      {/* NIST Pipeline */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-6">NIST 800-88 Sanitization Pipeline</h3>
        <div className="flex items-center justify-between max-w-3xl">
          {[
            { icon: <Box size={24} />, count: 45, label: 'Quarantine', color: 'bg-amber-50 text-amber-600 border-amber-200' },
            { icon: <HardDrive size={24} />, count: 12, label: 'Wiping', color: 'bg-blue-50 text-blue-600 border-blue-200' },
            { icon: <CheckCircle size={24} />, count: 128, label: 'Certified', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
            { icon: <Trash2 size={24} />, count: 350, label: 'Destroyed', color: 'bg-slate-800 text-slate-300 border-slate-700' },
          ].map((step, i, arr) => (
            <React.Fragment key={step.label}>
              <div className="flex flex-col items-center">
                <div className={`w-14 h-14 rounded-xl border flex items-center justify-center shadow-sm mb-2 ${step.color}`}>
                  {step.icon}
                </div>
                <span className="text-xl font-bold text-slate-900">{step.count}</span>
                <span className="text-xs text-slate-500 font-medium mt-0.5">{step.label}</span>
              </div>
              {i < arr.length - 1 && (
                <div className="flex-1 h-px bg-slate-200 mx-4 relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 border-t-2 border-r-2 border-slate-300 rotate-45" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TAB: CAPEX ───────────────────────────────────────────────────────────────
const capexData = [
  { quarter: 'Q3 2026', infrastructure: 120000, 'end-user': 95000, peripherals: 8000 },
  { quarter: 'Q4 2026', infrastructure: 45000,  'end-user': 60000, peripherals: 5000 },
  { quarter: 'Q1 2027', infrastructure: 250000, 'end-user': 30000, peripherals: 28000 },
  { quarter: 'Q2 2027', infrastructure: 50000,  'end-user': 45000, peripherals: 12000 },
  { quarter: 'Q3 2027', infrastructure: 90000,  'end-user': 80000, peripherals: 18000 },
];

const capexRows = [
  { item: 'Server Refresh (Prod)',       categoryId: 'infrastructure', quarter: 'Q1 2027', est: '€180,000', priority: 'Critical' },
  { item: 'Firewall Replacement',        categoryId: 'infrastructure', quarter: 'Q4 2026', est: '€45,000',  priority: 'High' },
  { item: 'Laptop Fleet Renewal',        categoryId: 'end-user',       quarter: 'Q3 2026', est: '€95,000',  priority: 'High' },
  { item: 'Desktop Refresh',             categoryId: 'end-user',       quarter: 'Q2 2027', est: '€60,000',  priority: 'Medium' },
  { item: 'Printer Fleet Renewal',       categoryId: 'peripherals',    quarter: 'Q3 2027', est: '€18,000',  priority: 'Medium' },
  { item: 'Scanner Replacement',         categoryId: 'peripherals',    quarter: 'Q1 2027', est: '€12,000',  priority: 'Low' },
  { item: 'Mobile Phone Refresh',        categoryId: 'end-user',       quarter: 'Q3 2027', est: '€28,000',  priority: 'Low' },
];

function CapexTab({ catSelected, assetCategories = [] }: { catSelected: Set<string>; assetCategories?: AssetCategory[] }) {
  const catIds = activeCatIds(catSelected, assetCategories);
  const filteredRows = capexRows.filter(r => catIds.has(r.categoryId));
  const catLabel = (id: string) => assetCategories.find(c => c.id === id)?.label ?? id;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Replacement Cost Forecast</h3>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={capexData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="quarter" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `€${v / 1000}k`} />
              <Tooltip formatter={(v: number) => `€${v.toLocaleString()}`} cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
              <Bar dataKey="infrastructure" name="Network & Server" stackId="a" fill="#3b82f6" radius={[0, 0, 3, 3]} />
              <Bar dataKey="end-user" name="PC, Lap & Mob" stackId="a" fill="#10b981" />
              <Bar dataKey="peripherals" name="Peripherals & Other" stackId="a" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Planned Replacements</h3>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Item', 'Category', 'Quarter', 'Est. Cost', 'Priority'].map(h => (
                <th key={h} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredRows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900">{row.item}</td>
                <td className="px-5 py-3 text-slate-500">{catLabel(row.categoryId)}</td>
                <td className="px-5 py-3 text-slate-600 font-mono text-xs">{row.quarter}</td>
                <td className="px-5 py-3 font-bold text-slate-900">{row.est}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${riskBadge(row.priority)}`}>{row.priority}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB: VENDORS ─────────────────────────────────────────────────────────────
const vendorRows = [
  { vendor: 'Dell',      category: 'PC, Lap & Mob',        assets: 210, failureRate: 2.4, mttr: 4,  score: 92 },
  { vendor: 'Lenovo',    category: 'PC, Lap & Mob',        assets: 185, failureRate: 3.1, mttr: 6,  score: 85 },
  { vendor: 'Apple',     category: 'PC, Lap & Mob',        assets: 55,  failureRate: 1.2, mttr: 3,  score: 95 },
  { vendor: 'HP',        category: 'PC, Lap & Mob',        assets: 40,  failureRate: 3.8, mttr: 8,  score: 78 },
  { vendor: 'Samsung',   category: 'PC, Lap & Mob',        assets: 35,  failureRate: 2.1, mttr: 5,  score: 88 },
  { vendor: 'Cisco',     category: 'Network & Server',     assets: 85,  failureRate: 0.8, mttr: 2,  score: 98 },
  { vendor: 'Aruba',     category: 'Network & Server',     assets: 32,  failureRate: 1.5, mttr: 3,  score: 91 },
  { vendor: 'Fortinet',  category: 'Network & Server',     assets: 8,   failureRate: 1.1, mttr: 4,  score: 93 },
  { vendor: 'Mikrotik',  category: 'Network & Server',     assets: 14,  failureRate: 2.8, mttr: 5,  score: 82 },
  { vendor: 'Brother',   category: 'Peripherals & Other',  assets: 18,  failureRate: 5.2, mttr: 9,  score: 68 },
  { vendor: 'Canon',     category: 'Peripherals & Other',  assets: 12,  failureRate: 4.1, mttr: 7,  score: 74 },
  { vendor: 'Logitech',  category: 'Peripherals & Other',  assets: 65,  failureRate: 1.8, mttr: 2,  score: 90 },
];

function VendorsTab({ catSelected, assetCategories = [] }: { catSelected: Set<string>; assetCategories?: AssetCategory[] }) {
  const [minScore, setMinScore] = useState('0');

  const activeCatLabels = catSelected.size === 0
    ? new Set(assetCategories.map(c => c.label))
    : new Set(assetCategories.filter(c => c.types.some(t => catSelected.has(t))).map(c => c.label));

  const filtered = vendorRows.filter(r =>
    activeCatLabels.has(r.category) && r.score >= Number(minScore)
  );

  const chartData = filtered.map(v => ({ name: v.vendor, mttr: v.mttr, score: v.score }));

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="grid grid-cols-2 gap-5">
        {/* MTTR Chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">MTTR by Vendor (days)</h3>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} unit="d" />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Bar dataKey="mttr" name="MTTR" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reliability Score */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Reliability Score</h3>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={45} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Bar dataKey="score" name="Score" radius={[0, 4, 4, 0]}
                  fill="#10b981"
                  label={{ position: 'right', fontSize: 11, fontWeight: 'bold', fill: '#475569' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Vendor Reliability Matrix</h3>
          <FilterBar>
            <FilterSelect value={minScore} onChange={setMinScore} options={['0', '70', '80', '90']} />
            {minScore !== '0' && <span className="text-xs text-blue-600 font-medium">Score ≥ {minScore}</span>}
          </FilterBar>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Vendor', 'Category', 'Assets', 'Failure Rate', 'MTTR', 'Score'].map(h => (
                <th key={h} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-bold text-slate-900">{row.vendor}</td>
                <td className="px-5 py-3 text-slate-500">{row.category}</td>
                <td className="px-5 py-3 text-slate-600">{row.assets}</td>
                <td className="px-5 py-3 font-medium text-slate-900">{row.failureRate}%</td>
                <td className="px-5 py-3 text-slate-600">{row.mttr}d</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${row.score >= 90 ? 'bg-emerald-500' : row.score >= 80 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${row.score}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">{row.score}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
// ─── TAB: ASSET SUMMARY ───────────────────────────────────────────────────────

function AssetSummaryTab({ assets, assetCategories = [] }: { assets: Asset[]; assetCategories?: AssetCategory[] }) {
  const statuses = ['Active', 'In Repair', 'Storage', 'Pending Checklist'] as const;
  const grand = { total: 0, Active: 0, 'In Repair': 0, Storage: 0, 'Pending Checklist': 0 };

  // Pre-compute all data before render
  const categoryData = assetCategories.map(cat => {
    const rows = cat.types.map(type => {
      const ta = assets.filter(a => a.type === type);
      if (ta.length === 0) return null;
      const counts = Object.fromEntries(statuses.map(s => [s, ta.filter(a => a.status === s).length])) as Record<string, number>;
      return { type, total: ta.length, counts };
    }).filter(Boolean) as { type: string; total: number; counts: Record<string, number> }[];

    if (rows.length === 0) return null;
    const sub = { total: rows.reduce((s, r) => s + r.total, 0), ...Object.fromEntries(statuses.map(s => [s, rows.reduce((a, r) => a + r.counts[s], 0)])) } as Record<string, number> & { total: number };
    grand.total += sub.total;
    statuses.forEach(s => { grand[s] += sub[s]; });
    return { cat, rows, sub };
  }).filter(Boolean) as { cat: typeof assetCategories[0]; rows: { type: string; total: number; counts: Record<string, number> }[]; sub: Record<string, number> & { total: number } }[];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Total</th>
              {statuses.map(s => (
                <th key={s} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categoryData.map(({ cat, rows, sub }) => (
              <React.Fragment key={cat.id}>
                {/* Category divider */}
                <tr className="bg-slate-50 border-y border-slate-200">
                  <td colSpan={6} className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">{cat.icon}</span>
                      <span className="text-sm font-bold text-slate-700">{cat.label}</span>
                      <span className="ml-auto text-xs font-medium text-slate-400">{sub.total} assets</span>
                    </div>
                  </td>
                </tr>
                {/* Type rows */}
                {rows.map(row => (
                  <tr key={row.type} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800 pl-9">{row.type}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900">{row.total}</td>
                    {statuses.map(s => (
                      <td key={s} className="px-5 py-3 text-right text-slate-600">
                        {row.counts[s] > 0 ? row.counts[s] : <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Subtotal */}
                <tr className="bg-slate-50 border-y border-slate-200">
                  <td className="px-5 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider pl-9">Subtotal</td>
                  <td className="px-5 py-2 text-right font-bold text-slate-800">{sub.total}</td>
                  {statuses.map(s => (
                    <td key={s} className="px-5 py-2 text-right font-semibold text-slate-600">
                      {sub[s] > 0 ? sub[s] : <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                </tr>
              </React.Fragment>
            ))}
            {/* Grand Total */}
            <tr className="bg-slate-900">
              <td className="px-5 py-4 text-xs font-bold text-white uppercase tracking-wider">Grand Total</td>
              <td className="px-5 py-4 text-right font-bold text-white text-base">{grand.total}</td>
              {statuses.map(s => (
                <td key={s} className="px-5 py-4 text-right font-semibold text-slate-300">
                  {grand[s] > 0 ? grand[s] : <span className="text-slate-600">—</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TABS: { id: TopTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'summary', label: 'Asset Summary' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'risk', label: 'Risk & Compliance' },
  { id: 'capex', label: 'CAPEX Forecast' },
  { id: 'vendors', label: 'Vendors' },
];

export default function ExecutiveDashboard({ assets, auditLog, selectedOrgs, activeTab, setActiveTab, catSelected, assetCategories = [] }: ExecutiveDashboardProps) {
  const filteredAssets = useMemo(() =>
    selectedOrgs.size === 0 ? assets : assets.filter(a =>
      [...selectedOrgs].some(orgId => a.orgId === orgId || a.orgId.startsWith(orgId + '-'))
    ),
    [assets, selectedOrgs]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      {/* Top tab bar */}
      <div className="bg-white border-b border-slate-200 px-6 shrink-0">
        <div className="flex items-center gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'overview' && <OverviewTab assets={filteredAssets} auditLog={auditLog} />}
        {activeTab === 'summary' && <AssetSummaryTab assets={filteredAssets} assetCategories={assetCategories} />}
        {activeTab === 'lifecycle' && <LifecycleTab catSelected={catSelected} assetCategories={assetCategories} />}
        {activeTab === 'risk' && <RiskTab catSelected={catSelected} assetCategories={assetCategories} />}
        {activeTab === 'capex' && <CapexTab catSelected={catSelected} assetCategories={assetCategories} />}
        {activeTab === 'vendors' && <VendorsTab catSelected={catSelected} assetCategories={assetCategories} />}
      </div>
    </div>
  );
}
