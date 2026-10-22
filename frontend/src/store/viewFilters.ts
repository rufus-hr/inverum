import { create } from 'zustand';

export type ViewName = 'assets' | 'locations' | 'employees' | 'supplies' | 'work_orders' | 'vendors' | 'dashboard';
export type SupplyType = 'consumable' | 'stock_item' | 'accessory';

interface ViewFilter {
  orgId: string | null;
  orgLabel: string | null;
  locationId: string | null;
  locationLabel: string | null;
  supplyType: SupplyType | null;
}

type ViewFiltersState = {
  filters: Record<ViewName, ViewFilter>;
  setOrgFilter: (view: ViewName, id: string | null, label: string | null) => void;
  setLocationFilter: (view: ViewName, id: string | null, label: string | null) => void;
  setSupplyTypeFilter: (view: ViewName, type: SupplyType | null) => void;
  clearFilters: (view: ViewName) => void;
};

const emptyFilter = (): ViewFilter => ({
  orgId: null,
  orgLabel: null,
  locationId: null,
  locationLabel: null,
  supplyType: null,
});

const initialFilters: Record<ViewName, ViewFilter> = {
  assets: emptyFilter(),
  locations: emptyFilter(),
  employees: emptyFilter(),
  supplies: emptyFilter(),
  work_orders: emptyFilter(),
  vendors: emptyFilter(),
  dashboard: emptyFilter(),
};

export const useViewFilters = create<ViewFiltersState>((set) => ({
  filters: initialFilters,

  setOrgFilter: (view, id, label) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [view]: { ...state.filters[view], orgId: id, orgLabel: label },
      },
    })),

  setLocationFilter: (view, id, label) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [view]: { ...state.filters[view], locationId: id, locationLabel: label },
      },
    })),

  setSupplyTypeFilter: (view, type) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [view]: { ...state.filters[view], supplyType: type },
      },
    })),

  clearFilters: (view) =>
    set((state) => ({
      filters: { ...state.filters, [view]: emptyFilter() },
    })),
}));
