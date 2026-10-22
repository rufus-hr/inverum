import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, X, Settings, Users, Package, Wrench, Building2,
  MapPin, LayoutDashboard, FileText, ChevronRight, ArrowRight,
  User, Boxes, ShoppingCart, Award, Zap, Shield,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResultGroup = 'Navigation' | 'Settings' | 'Users' | 'Assets' | 'Actions';

interface CommandResult {
  id: string;
  group: ResultGroup;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  tag?: string;
  onSelect?: () => void;
}

// ---------------------------------------------------------------------------
// Mock data — in production these come from the API / router
// ---------------------------------------------------------------------------

const NAV_RESULTS: CommandResult[] = [
  { id: 'n1', group: 'Navigation', icon: <LayoutDashboard size={15} />, title: 'Dashboard',       subtitle: 'Overview and KPIs' },
  { id: 'n2', group: 'Navigation', icon: <Package size={15} />,         title: 'Assets',          subtitle: 'All assets across organizations' },
  { id: 'n3', group: 'Navigation', icon: <Users size={15} />,           title: 'Employees',       subtitle: 'People and assignments' },
  { id: 'n4', group: 'Navigation', icon: <Wrench size={15} />,          title: 'Work Orders',     subtitle: 'Maintenance and repairs' },
  { id: 'n5', group: 'Navigation', icon: <ShoppingCart size={15} />,    title: 'Supplies',        subtitle: 'Consumables, spare parts, accessories' },
  { id: 'n6', group: 'Navigation', icon: <Boxes size={15} />,           title: 'Storage & Boxes', subtitle: 'Storage units and box tracking' },
  { id: 'n7', group: 'Navigation', icon: <Award size={15} />,           title: 'Certificates',    subtitle: 'SSL, device and code-signing certs' },
  { id: 'n8', group: 'Navigation', icon: <Building2 size={15} />,       title: 'Vendors',         subtitle: 'Supplier management and contracts' },
];

const SETTINGS_RESULTS: CommandResult[] = [
  { id: 's1', group: 'Settings', icon: <Settings size={15} />,   title: 'General Settings',     subtitle: 'Branding, regional, language',     tag: 'Tenant → General' },
  { id: 's2', group: 'Settings', icon: <Shield size={15} />,     title: 'Security',             subtitle: 'Password policy, 2FA, session',    tag: 'Tenant → Security' },
  { id: 's3', group: 'Settings', icon: <Users size={15} />,      title: 'SSO / Identity',       subtitle: 'LDAP, SAML, Microsoft 365, Google', tag: 'Tenant → SSO' },
  { id: 's4', group: 'Settings', icon: <Users size={15} />,      title: 'Permissions & Roles',  subtitle: 'Role definitions and access scopes', tag: 'Tenant → Permissions' },
  { id: 's5', group: 'Settings', icon: <Users size={15} />,      title: 'Users',                subtitle: 'Invite, manage and deactivate users', tag: 'Tenant → Users' },
  { id: 's6', group: 'Settings', icon: <Package size={15} />,    title: 'Asset Types',          subtitle: 'Categories, types, custom fields',  tag: 'Tenant → Asset Data' },
  { id: 's7', group: 'Settings', icon: <FileText size={15} />,   title: 'Naming Schemas',       subtitle: 'Inventory number generation',       tag: 'Tenant → Asset Data' },
  { id: 's8', group: 'Settings', icon: <Zap size={15} />,        title: 'Integrations',         subtitle: 'Jira, Zabbix, Slack, SCCM',         tag: 'Tenant → Operations' },
  { id: 's9', group: 'Settings', icon: <Award size={15} />,      title: 'Certificates',         subtitle: 'CA, TSA, expiry thresholds',        tag: 'Tenant → Operations' },
  { id: 's10', group: 'Settings', icon: <Settings size={15} />,  title: 'CSV Separator',        subtitle: 'Semicolon, comma or tab',           tag: 'Tenant → General' },
  { id: 's11', group: 'Settings', icon: <Settings size={15} />,  title: 'Date Format',          subtitle: 'DD.MM.YYYY, ISO 8601...',           tag: 'Tenant → General' },
];

const USER_RESULTS: CommandResult[] = [
  { id: 'u1', group: 'Users', icon: <User size={15} />, title: 'Ivan Horvat',       subtitle: 'ivan.horvat@posta.hr',       tag: 'Super Admin' },
  { id: 'u2', group: 'Users', icon: <User size={15} />, title: 'Maja Kovač',        subtitle: 'maja.kovac@posta.hr',        tag: 'Asset Manager · LDAP' },
  { id: 'u3', group: 'Users', icon: <User size={15} />, title: 'Tomislav Blažević', subtitle: 'tomislav.blazevic@posta.hr', tag: 'IT Technician · LDAP' },
  { id: 'u4', group: 'Users', icon: <User size={15} />, title: 'Ana Marić',         subtitle: 'ana.maric@posta.hr',         tag: 'Viewer · SAML' },
  { id: 'u5', group: 'Users', icon: <User size={15} />, title: 'Nikola Šimić',      subtitle: 'nikola.simic@posta.hr',      tag: 'Warehouse · invited' },
];

const ASSET_RESULTS: CommandResult[] = [
  { id: 'a1', group: 'Assets', icon: <Package size={15} />, title: 'SRV-0042 — Dell PowerEdge R740',  subtitle: 'Server · Zagreb HQ, Server Room',   tag: 'active' },
  { id: 'a2', group: 'Assets', icon: <Package size={15} />, title: 'LPT-0312 — Lenovo ThinkPad X1',  subtitle: 'Laptop · Ana Marić',                tag: 'assigned' },
  { id: 'a3', group: 'Assets', icon: <Package size={15} />, title: 'LPT-0198 — HP EliteBook 840',    subtitle: 'Laptop · Split office',             tag: 'active' },
  { id: 'a4', group: 'Assets', icon: <Package size={15} />, title: 'SRV-0017 — HP ProLiant DL380',   subtitle: 'Server · Zagreb HQ',                tag: 'in_repair' },
  { id: 'a5', group: 'Assets', icon: <MapPin size={15} />,  title: 'Zagreb HQ',                      subtitle: '3 floors · 124 assets',             tag: 'location' },
];

const ALL_RESULTS = [...NAV_RESULTS, ...SETTINGS_RESULTS, ...USER_RESULTS, ...ASSET_RESULTS];

// ---------------------------------------------------------------------------
// Fuzzy match — all query words must appear in haystack
// ---------------------------------------------------------------------------

function fuzzyMatch(query: string, result: CommandResult): boolean {
  const hay = `${result.title} ${result.subtitle ?? ''} ${result.tag ?? ''}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}

// ---------------------------------------------------------------------------
// Group order and labels
// ---------------------------------------------------------------------------

const GROUP_ORDER: ResultGroup[] = ['Navigation', 'Settings', 'Users', 'Assets', 'Actions'];

const GROUP_ICONS: Record<ResultGroup, React.ReactNode> = {
  Navigation: <LayoutDashboard size={11} />,
  Settings:   <Settings size={11} />,
  Users:      <Users size={11} />,
  Assets:     <Package size={11} />,
  Actions:    <ArrowRight size={11} />,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery]         = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);

  const results = query.trim()
    ? ALL_RESULTS.filter(r => fuzzyMatch(query, r))
    : NAV_RESULTS; // default: show navigation

  // Group results preserving order
  const grouped = GROUP_ORDER
    .map(g => ({ group: g, items: results.filter(r => r.group === g) }))
    .filter(g => g.items.length > 0);

  const flat = grouped.flatMap(g => g.items);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Keyboard navigation
  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      flat[activeIdx]?.onSelect?.();
      onClose();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  }, [flat, activeIdx, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0); }, [query]);

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-theme-surface border border-theme-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh]">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-theme-border shrink-0">
          <Search size={16} className="text-theme-text-subtle shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search users, assets, settings…"
            className="flex-1 bg-transparent text-theme-base text-theme-text placeholder-theme-text-subtle focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-theme-text-subtle hover:text-theme-text transition-colors">
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-theme-bg border border-theme-border rounded text-[10px] text-theme-text-subtle font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto flex-1 py-2">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-theme-sm text-theme-text-muted">No results for "<span className="text-theme-text">{query}</span>"</p>
            </div>
          ) : grouped.map(({ group, items }) => (
            <div key={group} className="mb-1">
              <div className="flex items-center gap-1.5 px-4 py-1.5">
                <span className="text-theme-text-subtle">{GROUP_ICONS[group]}</span>
                <span className="text-[10px] font-semibold text-theme-text-subtle uppercase tracking-widest">{group}</span>
              </div>
              {items.map((result) => {
                const idx = flatIdx++;
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={result.id}
                    data-idx={idx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => { result.onSelect?.(); onClose(); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? 'bg-theme-primary/8 text-theme-primary' : 'hover:bg-theme-surface-hover text-theme-text'}`}
                  >
                    <span className={`shrink-0 ${isActive ? 'text-theme-primary' : 'text-theme-text-subtle'}`}>{result.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-theme-sm font-medium">{result.title}</span>
                      {result.subtitle && (
                        <span className="text-theme-xs text-theme-text-muted ml-2">{result.subtitle}</span>
                      )}
                    </div>
                    {result.tag && (
                      <span className="text-theme-xs text-theme-text-subtle bg-theme-bg border border-theme-border px-1.5 py-0.5 rounded shrink-0">
                        {result.tag}
                      </span>
                    )}
                    {isActive && <ChevronRight size={13} className="text-theme-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-theme-border bg-theme-bg shrink-0">
          {[
            { keys: ['↑', '↓'], label: 'navigate' },
            { keys: ['↵'],      label: 'open' },
            { keys: ['Esc'],    label: 'close' },
          ].map(({ keys, label }) => (
            <span key={label} className="flex items-center gap-1 text-[11px] text-theme-text-subtle">
              {keys.map(k => <kbd key={k} className="px-1 py-0.5 bg-theme-surface border border-theme-border rounded text-[10px] font-mono">{k}</kbd>)}
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
