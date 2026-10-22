import React, { useMemo } from 'react';
import ExecutiveDashboard from '../components/ExecutiveDashboard';
import { useApiQuery } from '../hooks/useApi';
import type { CursorPagedResponse, AssetResponse, DashboardStats } from '../types';

export default function Dashboard() {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'summary' | 'lifecycle' | 'risk' | 'capex' | 'vendors'>('overview');
  const [catSelected] = React.useState<Set<string>>(new Set());
  const { data: statsData, isLoading: statsLoading } = useApiQuery<DashboardStats>('/dashboard/stats');
  const { data: assetsData, isLoading: assetsLoading } = useApiQuery<CursorPagedResponse<AssetResponse>>('/assets/?limit=200');

  const isLoading = statsLoading || assetsLoading;

  // Convert API assets to UI Asset format
  const assets = useMemo(() => {
    if (!assetsData?.items) return [];
    return assetsData.items.map(a => ({
      id: a.id,
      inventoryNumber: a.inventory_number ?? a.id.slice(0, 8),
      type: 'asset',
      name: a.name ?? 'Unnamed',
      assignee: '—',
      status: (a.status as any) ?? 'in_stock',
      orgId: a.organization_id,
      locId: a.location_id ?? '',
      mobility_type: a.mobility_type ?? 'personal',
      custom_fields: a.custom_fields as Record<string, string> | undefined,
      serial_number: a.serial_number ?? undefined,
      vendor_id: a.vendor_id ?? undefined,
      purchase_date: a.purchase_date ?? undefined,
      purchase_cost: a.purchase_cost?.toString() ?? undefined,
    }));
  }, [assetsData]);

  // Convert recent activity to audit log format
  const auditLog = useMemo(() => {
    if (!statsData?.recent_activity) return [];
    return statsData.recent_activity.map(e => ({
      id: e.id,
      date: e.created_at ?? '',
      action: e.action,
      user: e.actor_type ?? 'system',
      details: `${e.entity_type} ${e.entity_id.slice(0, 8)}`,
    }));
  }, [statsData]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <ExecutiveDashboard
      assets={assets}
      auditLog={auditLog}
      selectedOrgs={new Set()}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      catSelected={catSelected}
      assetCategories={[]}
    />
  );
}
