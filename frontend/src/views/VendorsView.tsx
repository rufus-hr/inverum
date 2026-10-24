import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApiQuery } from '../hooks/useApi';
import { apiFetch } from '../lib/api';
import { useToast } from '../hooks/useToast';
import type { PagedResponse, CursorPagedResponse, AssetResponse } from '../types/api';
import {
  Vendor,
  VendorType,
  VendorContact,
  VendorContract,
  ContractType,
  ContractStatus,
  ViewMode,
  daysUntil,
  NewVendorModal,
} from '../components/vendors/VendorTypesAndHelpers';
import { VendorListScreen } from '../components/vendors/VendorList';
import { VendorDetailScreen } from '../components/vendors/VendorDetail';

function computeContractStatus(endDateStr: string | null, isActive: boolean): ContractStatus {
  if (!isActive) return 'draft';
  if (!endDateStr) return 'active';
  const rem = daysUntil(endDateStr);
  if (rem < 0) return 'expired';
  if (rem <= 90) return 'expiring';
  return 'active';
}

export function VendorsView() {
  const toast = useToast();
  const { data: vendorsResp, refetch: refetchVendors } = useApiQuery<PagedResponse<any>>('/vendors/?limit=100');
  const { data: contractsResp, refetch: refetchContracts } = useApiQuery<PagedResponse<any>>('/vendor-contracts/?limit=200');
  const { data: assetsResp } = useApiQuery<CursorPagedResponse<AssetResponse>>('/assets/?limit=200');

  const [contactsByVendor, setContactsByVendor] = useState<Record<string, VendorContact[]>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const fetchVendorContacts = useCallback((vendorId: string) => {
    apiFetch<any[]>(`/vendors/${vendorId}/contacts`)
      .then(list => {
        if (Array.isArray(list)) {
          setContactsByVendor(prev => ({
            ...prev,
            [vendorId]: list.map(c => {
              const parts = (c.name ?? 'Contact').trim().split(' ');
              const firstName = parts[0] ?? 'Contact';
              const lastName = parts.slice(1).join(' ') || '';
              return {
                id: c.id,
                firstName,
                lastName,
                position: c.role ?? '',
                email: c.email ?? '',
                phone: c.phone ?? null,
                notes: c.notes ?? null,
                isPrimary: !!c.is_primary,
              };
            }),
          }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedVendorId) {
      fetchVendorContacts(selectedVendorId);
    }
  }, [selectedVendorId, fetchVendorContacts]);

  const vendors: Vendor[] = useMemo(() => {
    const rawVendors = vendorsResp?.items ?? [];
    const rawContracts = contractsResp?.items ?? [];
    const rawAssets = assetsResp?.items ?? [];

    return rawVendors.map((v: any) => {
      const vContracts: VendorContract[] = rawContracts
        .filter((c: any) => c.vendor_id === v.id)
        .map((c: any) => ({
          id: c.id,
          name: c.contract_number || `${c.contract_type} Contract`,
          type: (c.contract_type as ContractType) || 'support',
          validFrom: c.start_date ?? '2026-01-01',
          validTo: c.end_date ?? '2026-12-31',
          value: Number(c.value ?? 0),
          currency: c.currency ?? 'EUR',
          autoRenew: !!c.auto_renew,
          status: computeContractStatus(c.end_date, c.is_active ?? true),
          notes: c.notes ?? null,
          linkedAssets: 0,
        }));

      const vAssets = rawAssets
        .filter((a: any) => a.vendor_id === v.id || a.purchased_from_vendor_id === v.id)
        .map(a => ({
          id: a.id,
          tag: a.inventory_number ?? a.serial_number ?? a.id.slice(0, 8),
          model: a.name ?? 'Asset',
          status: a.status ?? 'active',
          assignedTo: null,
          purchasedAt: a.purchase_date ?? a.created_at,
        }));

      const assetSpend = rawAssets
        .filter((a: any) => a.vendor_id === v.id || a.purchased_from_vendor_id === v.id)
        .reduce((sum, a) => sum + Number(a.purchase_cost ?? 0), 0);
      const contractSpend = vContracts.reduce((sum, c) => sum + c.value, 0);

      const types: VendorType[] = Array.isArray(v.vendor_types) && v.vendor_types.length > 0
        ? v.vendor_types
        : Array.isArray(v.types) && v.types.length > 0
          ? v.types
          : ['reseller'];

      return {
        id: v.id,
        name: v.name ?? '',
        types,
        oib: v.oib ?? v.vat_id ?? '',
        phone: v.phone ?? '',
        website: v.website ?? '',
        address: v.address ?? '',
        assetCount: vAssets.length,
        spend: assetSpend + contractSpend,
        openWO: 0,
        reliability: v.reliability ?? 90,
        failureRate: v.failure_rate ?? 2.4,
        mttr: v.mttr ?? 3.5,
        repeatFailure: v.repeat_failure ?? 6,
        warrantyHonored: v.warranty_honored ?? 97,
        isArchived: !(v.is_active ?? true),
        contacts: contactsByVendor[v.id] ?? [],
        contracts: vContracts,
        assets: vAssets,
        serviceRecords: [],
        activity: [
          {
            id: `act-${v.id}`,
            date: (v.created_at ?? new Date().toISOString()).slice(0, 10),
            description: 'Vendor registered in system',
          },
        ],
      };
    });
  }, [vendorsResp, contractsResp, assetsResp, contactsByVendor]);

  const selectedVendor = useMemo(() => {
    return vendors.find(v => v.id === selectedVendorId) ?? null;
  }, [vendors, selectedVendorId]);

  const handleSelectVendor = useCallback((id: string) => {
    setSelectedVendorId(id);
    setViewMode('detail');
  }, []);

  const handleBackToList = useCallback(() => {
    setViewMode('list');
    setSelectedVendorId(null);
  }, []);

  const handleSaveVendor = async (data: {
    name: string;
    types: VendorType[];
    oib: string;
    phone: string;
    website: string;
    address: string;
  }) => {
    try {
      const payload = {
        name: data.name,
        vendor_types: data.types,
        oib: data.oib || null,
        phone: data.phone || null,
        website: data.website || null,
        address: data.address || null,
        is_active: true,
      };
      if (editingVendor) {
        await apiFetch(`/vendors/${editingVendor.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success(`Vendor "${data.name}" ažuriran`);
      } else {
        const created = await apiFetch<any>('/vendors/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(`Vendor "${data.name}" kreiran`);
        setSelectedVendorId(created.id);
        setViewMode('detail');
      }
      setShowVendorModal(false);
      setEditingVendor(null);
      refetchVendors();
    } catch (err: any) {
      toast.error(err?.message || 'Greška pri spremanju vendora');
    }
  };

  const handleArchiveVendor = async () => {
    if (!selectedVendor) return;
    try {
      await apiFetch(`/vendors/${selectedVendor.id}`, { method: 'DELETE' });
      toast.success(`Vendor "${selectedVendor.name}" arhiviran`);
      setViewMode('list');
      setSelectedVendorId(null);
      refetchVendors();
    } catch (err: any) {
      toast.error(err?.message || 'Greška pri arhiviranju vendora');
    }
  };

  const handleAddContact = async (c: {
    name: string;
    role: string;
    email: string;
    phone: string;
    is_primary: boolean;
    notes: string;
  }) => {
    if (!selectedVendor) return;
    try {
      await apiFetch(`/vendors/${selectedVendor.id}/contacts`, {
        method: 'POST',
        body: JSON.stringify({
          name: c.name,
          role: c.role || null,
          email: c.email || null,
          phone: c.phone || null,
          is_primary: c.is_primary,
          notes: c.notes || null,
        }),
      });
      toast.success('Kontakt dodan');
      fetchVendorContacts(selectedVendor.id);
    } catch (err: any) {
      toast.error(err?.message || 'Greška pri dodavanju kontakta');
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!selectedVendor) return;
    try {
      await apiFetch(`/vendors/${selectedVendor.id}/contacts/${contactId}`, {
        method: 'DELETE',
      });
      toast.success('Kontakt obrisan');
      fetchVendorContacts(selectedVendor.id);
    } catch (err: any) {
      toast.error(err?.message || 'Greška pri brisanju kontakta');
    }
  };

  const handleAddContract = async (c: {
    contract_number: string;
    contract_type: ContractType;
    start_date: string;
    end_date: string;
    value: number;
    auto_renew: boolean;
    notes: string;
  }) => {
    if (!selectedVendor) return;
    try {
      await apiFetch('/vendor-contracts/', {
        method: 'POST',
        body: JSON.stringify({
          vendor_id: selectedVendor.id,
          contract_number: c.contract_number,
          contract_type: c.contract_type,
          start_date: c.start_date || null,
          end_date: c.end_date || null,
          value: c.value,
          currency: 'EUR',
          auto_renew: c.auto_renew,
          notes: c.notes || null,
          is_active: true,
        }),
      });
      toast.success(`Ugovor "${c.contract_number}" kreiran`);
      refetchContracts();
    } catch (err: any) {
      toast.error(err?.message || 'Greška pri kreiranju ugovora');
    }
  };

  return (
    <>
      {viewMode === 'detail' && selectedVendor ? (
        <VendorDetailScreen
          vendor={selectedVendor}
          onBack={handleBackToList}
          onEditVendor={() => {
            setEditingVendor(selectedVendor);
            setShowVendorModal(true);
          }}
          onArchiveVendor={handleArchiveVendor}
          onAddContact={handleAddContact}
          onDeleteContact={handleDeleteContact}
          onAddContract={handleAddContract}
        />
      ) : (
        <VendorListScreen
          vendors={vendors}
          onSelectVendor={handleSelectVendor}
          onNewVendor={() => {
            setEditingVendor(null);
            setShowVendorModal(true);
          }}
        />
      )}
      {showVendorModal && (
        <NewVendorModal
          initialVendor={editingVendor}
          onClose={() => {
            setShowVendorModal(false);
            setEditingVendor(null);
          }}
          onSave={handleSaveVendor}
        />
      )}
    </>
  );
}

export default VendorsView;
