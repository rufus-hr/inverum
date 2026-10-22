import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { TreeNodeData } from '../types';

interface AppContextValue {
  tenantName: string;
  setTenantName: (name: string) => void;
  locTree: TreeNodeData[];
  setLocTree: (tree: TreeNodeData[]) => void;
  assetCategories: { id: string; label: string; icon: React.ReactNode; types: string[] }[];
  setAssetCategories: (cats: { id: string; label: string; icon: React.ReactNode; types: string[] }[]) => void;
  isTerminalOpen: boolean;
  setIsTerminalOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [tenantName, setTenantName] = useState('');
  const [locTree, setLocTree] = useState<TreeNodeData[]>([]);
  const [assetCategories, setAssetCategories] = useState<{ id: string; label: string; icon: React.ReactNode; types: string[] }[]>([]);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  // Fetch orgs, locations, tenant config, asset categories on mount
  useEffect(() => {
    import('../lib/api').then(({ apiFetch }) => {
      apiFetch<{ name: string }>('/tenants/config')
        .then(resp => { if (resp.name) setTenantName(resp.name); })
        .catch(() => {});

      Promise.all([
        apiFetch<{ items: any[] }>('/organizations/?limit=100').catch(() => ({ items: [] })),
        apiFetch<{ items: any[] }>('/locations/?limit=200').catch(() => ({ items: [] })),
      ]).then(([orgsResp, locsResp]) => {
        const orgs = orgsResp.items ?? [];
        const locs = locsResp.items ?? [];
        const tree: TreeNodeData[] = [];
        // Add tenant root
        const tenantNode: TreeNodeData = { id: 'tenant-root', label: 'All', children: [] };
        orgs.forEach((org: any) => {
          const orgNode: TreeNodeData = { id: org.id, label: org.name, children: [] };
          locs.forEach((loc: any) => {
            if (loc.organization_id === org.id) {
              orgNode.children!.push({ id: loc.id, label: loc.name });
            }
          });
          tenantNode.children!.push(orgNode);
        });
        tree.push(tenantNode);
        setLocTree(tree);
      }).catch(() => {});

      apiFetch<{ items: any[] }>('/asset-categories/?limit=100')
        .then(resp => {
          if (resp.items?.length > 0) {
            const all = resp.items;
            const topLevel = all.filter((c: any) => !c.parent_id);
            setAssetCategories(topLevel.map((c: any) => ({
              id: c.id,
              label: c.name ?? c.id,
              icon: null as React.ReactNode,
              types: all.filter((sub: any) => sub.parent_id === c.id).map((sub: any) => sub.name ?? sub.id),
            })));
          }
        })
        .catch(() => {});
    });
  }, []);

  return (
    <AppContext.Provider value={{ tenantName, setTenantName, locTree, setLocTree, assetCategories, setAssetCategories, isTerminalOpen, setIsTerminalOpen }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
