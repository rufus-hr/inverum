import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, Plus, X, ChevronRight, Star, Phone, Globe, Mail, FileText,
  ExternalLink, MoreHorizontal, Edit2, Archive, Trash2, Users, Package,
  BarChart3, TrendingUp, AlertTriangle, DollarSign, Shield,
} from 'lucide-react';
import {
  Vendor,
  VendorContract,
  DetailTab,
  ContractType,
  CONTRACT_TYPE_LABELS,
  INDUSTRY_AVG,
  ReliabilityBar,
  TypeChips,
  StatusDot,
  formatCurrency,
  formatDate,
  daysUntil,
  ComparisonIndicator,
  ContractDetailModal,
} from './VendorTypesAndHelpers';

export function VendorDetailScreen({
  vendor,
  onBack,
  onEditVendor,
  onArchiveVendor,
  onAddContact,
  onDeleteContact,
  onAddContract,
}: {
  vendor: Vendor;
  onBack: () => void;
  onEditVendor: () => void;
  onArchiveVendor: () => void;
  onAddContact: (c: { name: string; role: string; email: string; phone: string; is_primary: boolean; notes: string }) => void;
  onDeleteContact: (contactId: string) => void;
  onAddContract: (c: { contract_number: string; contract_type: ContractType; start_date: string; end_date: string; value: number; auto_renew: boolean; notes: string }) => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [actionsOpen, setActionsOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<VendorContract | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);

  // Contact form
  const [cName, setCName] = useState('');
  const [cRole, setCRole] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cPrimary, setCPrimary] = useState(false);
  const [cNotes, setCNotes] = useState('');

  // Contract form
  const [ctNumber, setCtNumber] = useState('');
  const [ctType, setCtType] = useState<ContractType>('support');
  const [ctFrom, setCtFrom] = useState('2026-01-01');
  const [ctTo, setCtTo] = useState('2026-12-31');
  const [ctValue, setCtValue] = useState('');
  const [ctRenew, setCtRenew] = useState(true);
  const [ctNotes, setCtNotes] = useState('');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedContract) {
          setSelectedContract(null);
        } else if (showContactModal) {
          setShowContactModal(false);
        } else if (showContractModal) {
          setShowContractModal(false);
        } else {
          onBack();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onBack, selectedContract, showContactModal, showContractModal]);

  const primaryContact = vendor.contacts.find(c => c.isPrimary);
  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'contacts', label: `Contacts (${vendor.contacts.length})` },
    { id: 'contracts', label: `Contracts (${vendor.contracts.length})` },
    { id: 'assets', label: `Assets (${vendor.assets.length})` },
    { id: 'reliability', label: 'Reliability' },
    { id: 'financials', label: 'Financials' },
  ];

  const submitContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim()) return;
    onAddContact({
      name: cName.trim(),
      role: cRole.trim(),
      email: cEmail.trim(),
      phone: cPhone.trim(),
      is_primary: cPrimary,
      notes: cNotes.trim(),
    });
    setCName(''); setCRole(''); setCEmail(''); setCPhone(''); setCPrimary(false); setCNotes('');
    setShowContactModal(false);
  };

  const submitContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctNumber.trim()) return;
    onAddContract({
      contract_number: ctNumber.trim(),
      contract_type: ctType,
      start_date: ctFrom,
      end_date: ctTo,
      value: ctValue ? Number(ctValue) : 0,
      auto_renew: ctRenew,
      notes: ctNotes.trim(),
    });
    setCtNumber(''); setCtValue(''); setCtNotes('');
    setShowContractModal(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Sticky header */}
      <div className="px-6 pt-4 pb-0 border-b border-slate-200 bg-white sticky top-0 z-10">
        {/* Breadcrumb row */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span>Vendors</span>
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-slate-900 font-medium">{vendor.name}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onEditVendor}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
            <div className="relative">
              <button
                onClick={() => setActionsOpen(!actionsOpen)}
                className="p-1.5 text-slate-500 border border-slate-300 rounded-md hover:bg-slate-50"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {actionsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-52 bg-white border border-slate-200 rounded-md shadow-lg py-1">
                    <button
                      onClick={() => { setActionsOpen(false); setShowContractModal(true); }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <FileText className="w-4 h-4 text-slate-400" />
                      Add contract
                    </button>
                    <button
                      onClick={() => { setActionsOpen(false); setShowContactModal(true); }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <Users className="w-4 h-4 text-slate-400" />
                      Add contact
                    </button>
                    <button
                      onClick={() => { setActionsOpen(false); setActiveTab('assets'); }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <Package className="w-4 h-4 text-slate-400" />
                      View assets in list
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={() => { setActionsOpen(false); onArchiveVendor(); }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-red-50 flex items-center gap-2 text-red-600"
                    >
                      <Archive className="w-4 h-4" />
                      Archive vendor
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Vendor name + types */}
        <div className="mb-2">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-slate-900">{vendor.name}</h1>
            <TypeChips types={vendor.types} max={5} />
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
            {vendor.oib && (
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" />
                OIB {vendor.oib}
              </span>
            )}
            {vendor.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {vendor.phone}
              </span>
            )}
            {vendor.website && (
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                {vendor.website}
              </span>
            )}
            {primaryContact && (
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {primaryContact.firstName} {primaryContact.lastName} &mdash; {primaryContact.email}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && <OverviewTab vendor={vendor} onTabChange={setActiveTab} />}
        {activeTab === 'contacts' && (
          <ContactsTab
            vendor={vendor}
            onOpenNewContact={() => setShowContactModal(true)}
            onDeleteContact={onDeleteContact}
          />
        )}
        {activeTab === 'contracts' && (
          <ContractsTab
            vendor={vendor}
            onSelectContract={setSelectedContract}
            onOpenNewContract={() => setShowContractModal(true)}
          />
        )}
        {activeTab === 'assets' && <AssetsTab vendor={vendor} />}
        {activeTab === 'reliability' && <ReliabilityTab vendor={vendor} />}
        {activeTab === 'financials' && <FinancialsTab vendor={vendor} />}
      </div>

      {selectedContract && (
        <ContractDetailModal contract={selectedContract} onClose={() => setSelectedContract(null)} />
      )}

      {/* New Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowContactModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Add Contact</h3>
              <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitContact} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                <input required value={cName} onChange={e => setCName(e.target.value)} placeholder="Marko Marković" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Role / Position</label>
                  <input value={cRole} onChange={e => setCRole(e.target.value)} placeholder="Account Manager" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                  <input value={cPhone} onChange={e => setCPhone(e.target.value)} placeholder="+385 91..." className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} placeholder="marko@vendor.hr" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={cPrimary} onChange={e => setCPrimary(e.target.checked)} />
                Primary contact
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowContactModal(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-md">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Save Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Contract Modal */}
      {showContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowContractModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">New Contract</h3>
              <button onClick={() => setShowContractModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitContract} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contract Number / Name *</label>
                <input required value={ctNumber} onChange={e => setCtNumber(e.target.value)} placeholder="SLA-2026-01" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                  <select value={ctType} onChange={e => setCtType(e.target.value as ContractType)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
                    {(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map(t => (
                      <option key={t} value={t}>{CONTRACT_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Value (EUR)</label>
                  <input type="number" step="0.01" value={ctValue} onChange={e => setCtValue(e.target.value)} placeholder="15000" className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                  <input type="date" value={ctFrom} onChange={e => setCtFrom(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                  <input type="date" value={ctTo} onChange={e => setCtTo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={ctRenew} onChange={e => setCtRenew(e.target.checked)} />
                Auto-renew
              </label>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <input value={ctNotes} onChange={e => setCtNotes(e.target.value)} placeholder="Optional notes..." className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowContractModal(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-md">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Create Contract</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Overview ───────────────────────────────────────────────────────────

function OverviewTab({ vendor, onTabChange }: { vendor: Vendor; onTabChange: (tab: DetailTab) => void }) {
  const primaryContact = vendor.contacts.find(c => c.isPrimary);
  const activeContracts = vendor.contracts.filter(c => c.status === 'active' || c.status === 'expiring');
  const expiringContracts = vendor.contracts.filter(c => c.status === 'expiring');

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Assets</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-1">{vendor.assetCount}</p>
          <p className="text-sm text-slate-500">{formatCurrency(vendor.spend)} spend</p>
          <button onClick={() => onTabChange('assets')} className="text-xs font-medium text-blue-600 hover:text-blue-700 mt-3 inline-flex items-center gap-1">
            View list <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Active Contracts</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-1">{activeContracts.length}</p>
          {expiringContracts.length > 0 ? (
            <p className="text-sm text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {expiringContracts.length} expiring soon
            </p>
          ) : (
            <p className="text-sm text-slate-500">All contracts active</p>
          )}
          <button onClick={() => onTabChange('contracts')} className="text-xs font-medium text-blue-600 hover:text-blue-700 mt-3 inline-flex items-center gap-1">
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Reliability</span>
          </div>
          {vendor.reliability !== null ? (
            <>
              <div className="mb-2">
                <ReliabilityBar score={vendor.reliability} size="lg" />
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span>Failure {vendor.failureRate}%</span>
                <span>MTTR {vendor.mttr}d</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Not enough data</p>
          )}
          <button onClick={() => onTabChange('reliability')} className="text-xs font-medium text-blue-600 hover:text-blue-700 mt-3 inline-flex items-center gap-1">
            View details <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Company info + Primary contact */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">Company Info</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex">
              <dt className="w-24 text-slate-500 shrink-0">Legal name</dt>
              <dd className="text-slate-900">{vendor.name}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-slate-500 shrink-0">OIB</dt>
              <dd className="text-slate-900 font-mono">{vendor.oib || '—'}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-slate-500 shrink-0">Address</dt>
              <dd className="text-slate-900">{vendor.address || '—'}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-slate-500 shrink-0">Website</dt>
              <dd className="text-blue-600">{vendor.website || '—'}</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-slate-500 shrink-0">Types</dt>
              <dd><TypeChips types={vendor.types} max={5} /></dd>
            </div>
          </dl>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">Primary Contact</h3>
          {primaryContact ? (
            <div className="space-y-3 text-sm">
              <p className="text-slate-900 font-medium text-base">
                {primaryContact.firstName} {primaryContact.lastName}
              </p>
              <p className="text-slate-500">{primaryContact.position}</p>
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {primaryContact.email}
              </div>
              {primaryContact.phone && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {primaryContact.phone}
                </div>
              )}
              <button onClick={() => onTabChange('contacts')} className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                View all contacts <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No primary contact set</p>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">Recent Activity</h3>
        {vendor.activity.length > 0 ? (
          <div className="space-y-3">
            {vendor.activity.slice(0, 5).map(act => (
              <div key={act.id} className="flex items-start gap-3 text-sm">
                <span className="text-slate-400 shrink-0 w-24 font-mono text-xs pt-0.5">{act.date}</span>
                <span className="text-slate-700">{act.description}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No recent activity</p>
        )}
      </div>
    </div>
  );
}

// ── Tab: Contacts ───────────────────────────────────────────────────────────

function ContactsTab({
  vendor,
  onOpenNewContact,
  onDeleteContact,
}: {
  vendor: Vendor;
  onOpenNewContact: () => void;
  onDeleteContact: (id: string) => void;
}) {
  const sortedContacts = useMemo(() => {
    return [...vendor.contacts].sort((a, b) => {
      if (a.isPrimary) return -1;
      if (b.isPrimary) return 1;
      return a.lastName.localeCompare(b.lastName);
    });
  }, [vendor.contacts]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-700">
          Contacts ({vendor.contacts.length})
        </h3>
        <button
          onClick={onOpenNewContact}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          <Plus className="w-3.5 h-3.5" />
          Add contact
        </button>
      </div>

      {sortedContacts.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No contacts yet — add one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedContacts.map(contact => (
            <div key={contact.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600 shrink-0">
                    {(contact.firstName[0] ?? 'C')}{(contact.lastName[0] ?? '')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      {contact.isPrimary && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                      <span className="font-medium text-slate-900">
                        {contact.firstName} {contact.lastName}
                      </span>
                      <span className="text-sm text-slate-500">{contact.position}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-600">
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {contact.email}
                        </span>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {contact.phone}
                        </span>
                      )}
                    </div>
                    {contact.notes && (
                      <p className="text-xs text-slate-500 mt-2">{contact.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onDeleteContact(contact.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Contracts ──────────────────────────────────────────────────────────

function ContractsTab({
  vendor,
  onSelectContract,
  onOpenNewContract,
}: {
  vendor: Vendor;
  onSelectContract: (c: VendorContract) => void;
  onOpenNewContract: () => void;
}) {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let result = vendor.contracts;
    if (typeFilter !== 'all') {
      result = result.filter(c => c.type === typeFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q));
    }
    return result;
  }, [vendor.contracts, typeFilter, statusFilter, search]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All types</option>
          {(Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).map(t => (
            <option key={t} value={t}>{CONTRACT_TYPE_LABELS[t]}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="expiring">Expiring 90d</option>
          <option value="expired">Expired</option>
          <option value="draft">Draft</option>
        </select>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contracts..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={onOpenNewContract}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          <Plus className="w-3.5 h-3.5" />
          New Contract
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-1">
            {vendor.contracts.length === 0
              ? 'No contracts yet — add one to start tracking SLAs, support periods, and framework agreements.'
              : 'No contracts match these filters.'
            }
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Valid Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-10">Doc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => {
                const remaining = daysUntil(c.validTo);
                return (
                  <tr
                    key={c.id}
                    onClick={() => onSelectContract(c)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{CONTRACT_TYPE_LABELS[c.type] ?? c.type}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <div>{formatDate(c.validFrom)}</div>
                      <div className="text-slate-400">to {formatDate(c.validTo)}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{formatCurrency(c.value)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusDot status={c.status} />
                        <span className="text-sm capitalize text-slate-700">{c.status}</span>
                        {c.status === 'expiring' && remaining > 0 && (
                          <span className="text-xs font-medium text-amber-600">{remaining}d left</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <FileText className="w-4 h-4 text-slate-400 hover:text-blue-600" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Assets ─────────────────────────────────────────────────────────────

function AssetsTab({ vendor }: { vendor: Vendor }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-700">
          Assets purchased from {vendor.name} ({vendor.assets.length})
        </h3>
        <a
          href="/assets"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open in Asset list
        </a>
      </div>

      {vendor.assets.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No assets linked to this vendor.</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tag</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Model</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Assigned To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Purchased</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendor.assets.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-slate-900">{a.tag}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{a.model}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      a.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
                      a.status === 'deployed' ? 'bg-emerald-100 text-emerald-700' :
                      a.status === 'in_service' ? 'bg-amber-100 text-amber-700' :
                      a.status === 'in_stock' ? 'bg-slate-100 text-slate-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {a.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {a.assignedTo || <span className="text-slate-400">&mdash;</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(a.purchasedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Reliability ────────────────────────────────────────────────────────

function ReliabilityTab({ vendor }: { vendor: Vendor }) {
  const hasEnoughData = vendor.reliability !== null && vendor.serviceRecords.length >= 3;

  if (!hasEnoughData) {
    return (
      <div className="text-center py-16">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">Not enough service history</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          At least 3 closed work orders are needed to calculate a reliability score. This vendor currently has {vendor.serviceRecords.length} service record{vendor.serviceRecords.length !== 1 ? 's' : ''}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">Reliability Score</h3>
        <div className="mb-6">
          <ReliabilityBar score={vendor.reliability} size="lg" />
          <span className="text-sm text-slate-500 ml-2">/ 100</span>
        </div>
        <div className="grid grid-cols-2 gap-y-4 gap-x-8">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-600">Failure rate</span>
              <span className="text-sm font-medium text-slate-900 ml-2">{vendor.failureRate}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">(avg {INDUSTRY_AVG.failureRate}%)</span>
              <ComparisonIndicator value={vendor.failureRate!} avg={INDUSTRY_AVG.failureRate} lowerIsBetter />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-600">Avg MTTR</span>
              <span className="text-sm font-medium text-slate-900 ml-2">{vendor.mttr}d</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">(avg {INDUSTRY_AVG.mttr}d)</span>
              <ComparisonIndicator value={vendor.mttr!} avg={INDUSTRY_AVG.mttr} lowerIsBetter />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-600">Repeat failures</span>
              <span className="text-sm font-medium text-slate-900 ml-2">{vendor.repeatFailure}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">(avg {INDUSTRY_AVG.repeatFailure}%)</span>
              <ComparisonIndicator value={vendor.repeatFailure!} avg={INDUSTRY_AVG.repeatFailure} lowerIsBetter />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-600">Warranty honored</span>
              <span className="text-sm font-medium text-slate-900 ml-2">{vendor.warrantyHonored}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">(avg {INDUSTRY_AVG.warrantyHonored}%)</span>
              <ComparisonIndicator value={vendor.warrantyHonored!} avg={INDUSTRY_AVG.warrantyHonored} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">Service History (Last 12 Months)</h3>
        <div className="h-48 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <div className="text-center">
            <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Service trend across closed work orders</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">
          Recent Service Records ({vendor.serviceRecords.length})
        </h3>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">WO #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Asset</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Issue</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendor.serviceRecords.map(sr => (
                <tr key={sr.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(sr.date)}</td>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">{sr.woNumber}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-700">{sr.assetTag}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{sr.issue}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{sr.durationDays} day{sr.durationDays !== 1 ? 's' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Financials ─────────────────────────────────────────────────────────

function FinancialsTab({ vendor }: { vendor: Vendor }) {
  const activeContractsTotal = vendor.contracts
    .filter(c => c.status === 'active' || c.status === 'expiring')
    .reduce((s, c) => s + c.value, 0);

  const avgCostPerAsset = vendor.assetCount > 0 ? Math.round(vendor.spend / vendor.assetCount) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Total Spend</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(vendor.spend)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Active Contracts Value</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(activeContractsTotal)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">Avg Cost per Asset</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {vendor.assetCount > 0 ? formatCurrency(avgCostPerAsset) : <span className="text-slate-400">&mdash;</span>}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="text-xs font-medium text-slate-500 uppercase mb-4">Annual Spend</h3>
        <div className="h-56 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <div className="text-center">
            <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Annual spend breakdown (2022–2026)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
