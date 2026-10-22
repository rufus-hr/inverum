import React, { useState } from 'react';
import { Search, Mail, Plus, ArrowRight, Trash2 } from 'lucide-react';
import Button from './Button';
import Badge from './Badge';
import Input from './Input';
import DataTable from './DataTable';
import type { Column } from './DataTable';
import type { StatusVariant } from '../../lib/statusStyles';

interface DemoAsset {
  id: string;
  inventoryNumber: string;
  name: string;
  type: string;
  assignee: string;
  status: StatusVariant;
}

const demoAssets: DemoAsset[] = [
  { id: '1', inventoryNumber: 'IT-LAP-300013', name: 'Lenovo T15 Gen5', type: 'Laptop', assignee: 'Mirko Mirkić', status: 'active' },
  { id: '2', inventoryNumber: '004592', name: 'Dell Latitude 5530', type: 'Laptop', assignee: 'Ana Anić', status: 'active' },
  { id: '3', inventoryNumber: 'IT-LAP-300015', name: 'MacBook Pro 14', type: 'Laptop', assignee: 'Ivan Horvat', status: 'checklist' },
  { id: '4', inventoryNumber: '100452', name: 'HP EliteBook 840', type: 'Laptop', assignee: 'Unassigned', status: 'neutral' },
  { id: '5', inventoryNumber: 'SRV-001', name: 'Dell PowerEdge R740', type: 'Server', assignee: 'IT Infra', status: 'active' },
  { id: '6', inventoryNumber: 'SW-004', name: 'Cisco Catalyst 9300', type: 'Switch', assignee: 'IT Infra', status: 'warning' },
];

const assetColumns: Column<DemoAsset>[] = [
  {
    key: 'inventoryNumber',
    header: 'Inv. Number',
    width: 'w-40',
    cell: (row) => <span className="font-mono text-xs text-blue-600 font-bold">{row.inventoryNumber}</span>,
  },
  {
    key: 'name',
    header: 'Asset Name',
    cell: (row) => <span className="font-semibold text-slate-900">{row.name}</span>,
  },
  {
    key: 'type',
    header: 'Type',
    cell: (row) => row.type,
  },
  {
    key: 'assignee',
    header: 'Assignee',
    cell: (row) => row.assignee,
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => <Badge variant={row.status}>{row.status}</Badge>,
  },
];

const allStatuses: StatusVariant[] = [
  'active', 'success', 'warning', 'pending', 'error', 'failed',
  'info', 'in_progress', 'neutral', 'indigo', 'checklist',
];

export default function UiDemo() {
  const [inputValue, setInputValue] = useState('');
  const [errorInput, setErrorInput] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === demoAssets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(demoAssets.map((a) => a.id)));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">UI Component Library</h1>
          <p className="text-slate-500 mt-2">Inverum v1.0.0 design system — preview and validate</p>
        </div>

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">Buttons</h2>

          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Variants</h3>
              <div className="flex flex-wrap gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Sizes</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">With Icons</h3>
              <div className="flex flex-wrap gap-3">
                <Button leftIcon={<Plus size={16} />}>Add Asset</Button>
                <Button rightIcon={<ArrowRight size={16} />}>Next Step</Button>
                <Button variant="danger" leftIcon={<Trash2 size={16} />}>Delete</Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">States</h3>
              <div className="flex flex-wrap gap-3">
                <Button disabled>Disabled</Button>
                <Button isLoading>Loading</Button>
              </div>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">Badges</h2>
          <div className="flex flex-wrap gap-2">
            {allStatuses.map((status) => (
              <Badge key={status} variant={status}>
                {status}
              </Badge>
            ))}
          </div>
        </section>

        {/* Inputs */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">Inputs</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            <Input
              label="Search"
              placeholder="Search assets..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              leftIcon={<Search size={16} />}
            />

            <Input
              label="Email"
              placeholder="user@company.com"
              leftIcon={<Mail size={16} />}
            />

            <Input
              label="Serial Number"
              placeholder="PF2B3XYZ"
              helperText="Enter the manufacturer's serial number"
            />

            <Input
              label="Required Field"
              placeholder="Cannot be empty"
              value={errorInput}
              onChange={(e) => setErrorInput(e.target.value)}
              error={errorInput === '' ? 'This field is required' : undefined}
            />

            <Input label="Disabled" placeholder="Cannot edit" disabled />
          </div>
        </section>

        {/* DataTable */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-2">Data Table</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
                With Selection
              </h3>
              <DataTable
                columns={assetColumns}
                data={demoAssets}
                keyExtractor={(row) => row.id}
                selectedIds={selectedIds}
                onSelectRow={toggleSelect}
                onSelectAll={toggleSelectAll}
              />
              <p className="text-xs text-slate-500 mt-2">
                Selected: {selectedIds.size} of {demoAssets.length}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Loading State</h3>
              <DataTable
                columns={assetColumns}
                data={[]}
                keyExtractor={(row) => row.id}
                isLoading
              />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Empty State</h3>
              <DataTable
                columns={assetColumns}
                data={[]}
                keyExtractor={(row) => row.id}
                emptyTitle="No assets found"
                emptyDescription="Try adjusting your search or filters to find what you're looking for."
                onClearFilters={() => alert('Clear filters clicked')}
              />
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="pt-8 border-t border-slate-200 text-center text-sm text-slate-500">
          Inverum UI Kit v1.0.0 — Built with React 19 + Tailwind CSS v4
        </div>
      </div>
    </div>
  );
}
