import { Asset, TreeNodeData } from '../types';
import React from 'react';
import { Laptop, Server, Box, Smartphone, Car, AlignJustify } from 'lucide-react';

export const mockAssets: Asset[] = [
  { id: '1', inventoryNumber: 'IT-LAP-300013', type: 'Laptop', name: 'Lenovo T15 Gen5', assignee: 'Mirko Mirkić', status: 'Active', orgId: 'org1-1-1', locId: 'loc1-1-1', mobility_type: 'Personal', imageUrl: 'https://picsum.photos/seed/lenovo1/200/150', custom_fields: { RAM: '16 GB', Storage: '512 GB SSD', CPU: 'i7-1165G7', 'MAC Address': '00:1B:44:11:3A:B7' } },
  { id: '2', inventoryNumber: '004592', type: 'Laptop', name: 'Dell Latitude 5530', assignee: 'Ana Anić', status: 'Active', orgId: 'org1-1-2', locId: 'loc1-1-2', mobility_type: 'Personal', imageUrl: 'https://picsum.photos/seed/dell1/200/150', custom_fields: { RAM: '8 GB', Storage: '256 GB SSD', CPU: 'i5-1235U', 'Warranty Expiry': '2027-05-12' } },
  { id: '3', inventoryNumber: 'IT-LAP-300015', type: 'Laptop', name: 'MacBook Pro 14', assignee: 'Ivan Horvat', status: 'Pending Checklist', pending_sop: 'User Offboarding', orgId: 'org1-1-1', locId: 'loc1-1-1', mobility_type: 'Personal', imageUrl: 'https://picsum.photos/seed/macbook1/200/150', custom_fields: { RAM: '32 GB', Storage: '1 TB SSD', CPU: 'M1 Pro', 'Color': 'Space Gray' } },
  { id: '4', inventoryNumber: '100452', type: 'Laptop', name: 'HP EliteBook 840', assignee: 'Unassigned', status: 'Storage', orgId: 'org1-1', locId: 'loc1-2', mobility_type: 'Personal', imageUrl: 'https://picsum.photos/seed/hp1/200/150', custom_fields: { RAM: '8 GB', Storage: '256 GB SSD', CPU: 'i5-8250U' } },
  { id: '5', inventoryNumber: 'IT-LAP-300018', type: 'Laptop', name: 'Lenovo T14 Gen3', assignee: 'Marko Marković', status: 'Active', orgId: 'org1-2', locId: 'loc1-1', mobility_type: 'Personal', imageUrl: 'https://picsum.photos/seed/lenovo2/200/150', custom_fields: { RAM: '16 GB', Storage: '512 GB SSD', CPU: 'Ryzen 5 PRO 6650U' } },
  { id: '6', inventoryNumber: 'SRV-001', type: 'Server', name: 'Dell PowerEdge R740', assignee: 'IT Infra', status: 'Active', orgId: 'org1-1-1', locId: 'loc1-1-1', mobility_type: 'Static', custom_fields: { 'IP Address': '10.0.0.15', 'MAC Address': '00:1A:2B:3C:4D:5E', 'OS': 'Ubuntu 22.04', 'Rack Unit': 'U12' } },
  { id: '7', inventoryNumber: 'SW-004', type: 'Switch', name: 'Cisco Catalyst 9300', assignee: 'IT Infra', status: 'Active', orgId: 'org1-1-1', locId: 'loc1-1-1', mobility_type: 'Static', custom_fields: { 'IP Address': '10.0.0.2', 'MAC Address': '00:1A:2B:3C:4D:5F', 'Ports': '48' } },
  { id: '8', inventoryNumber: 'MOB-012', type: 'Mobile Phone', name: 'iPhone 15 Pro', assignee: 'Mirko Mirkić', status: 'Active', orgId: 'org1-1-1', locId: 'loc1-1-1', mobility_type: 'Personal', custom_fields: { 'IMEI': '351234567890123', 'Phone Number': '+38591234567', 'Storage': '256 GB' } },
  { id: '9', inventoryNumber: 'CAR-001', type: 'Vehicle', name: 'Skoda Octavia', assignee: 'Sales Dept', status: 'Active', orgId: 'org1-1', locId: 'loc1-1', mobility_type: 'Shared', custom_fields: { 'License Plate': 'ZG-1234-AB', 'VIN': 'TMB1234567890', 'Next Service': '2026-10-01' } },
  { id: '10', inventoryNumber: 'IT-LAP-300020', type: 'Laptop', name: 'Dell XPS 15', assignee: 'New Hire', status: 'Pending Checklist', pending_sop: 'User Onboarding', orgId: 'org1-1-1', locId: 'loc1-1-1', mobility_type: 'Personal', imageUrl: 'https://picsum.photos/seed/xps1/200/150', custom_fields: { RAM: '32 GB', Storage: '1 TB SSD', CPU: 'i9-12900H' } },
];

export const mockEmployees = [
  { id: 'e1', name: 'Ivan Štimac', department: 'IT', email: 'ivan.stimac@rufus.hr', phone: '+385 91 234 5678', pebcak_score: 0, internal_tags: ['VIP', 'Admin'] },
  { id: 'e2', name: 'Iva Šarić', department: 'HR', email: 'iva.saric@abc.hr', phone: '+385 91 345 6789', pebcak_score: 1, internal_tags: [] },
  { id: 'e3', name: 'Mirko Mirkić', department: 'Sales', email: 'mirko.mirkic@abc.hr', phone: '+385 91 456 7890', pebcak_score: 6, internal_tags: ['PEBCAK'] },
  { id: 'e4', name: 'Ana Anić', department: 'Marketing', email: 'ana.anic@abc.hr', phone: '+385 91 567 8901', pebcak_score: 0, internal_tags: [] },
  { id: 'e5', name: 'Šime Ivančić', department: 'Finance', email: 'sime.ivancic@abc.hr', phone: '+385 91 678 9012', pebcak_score: 2, internal_tags: ['handle_with_care'] },
];

export const mockDeptTree: TreeNodeData[] = [
  {
    id: 'tenant-1', label: 'Inverum Corp (Tenant)', children: [
      {
        id: 'dept-global-it', label: 'Global IT', children: [
          { id: 'e6', label: 'Admin Root' }
        ]
      },
      {
        id: 'org-1', label: 'Hrvatska Pošta d.d.', children: [
          {
            id: 'dept-it', label: 'IT Odjel', children: [
              { id: 'e1', label: 'Ivan Štimac' }
            ]
          },
          {
            id: 'dept-hr', label: 'Ljudski Resursi', children: [
              { id: 'e2', label: 'Iva Šarić' }
            ]
          },
          {
            id: 'dept-sales', label: 'Prodaja', children: [
              { id: 'e3', label: 'Mirko Mirkić' }
            ]
          },
          {
            id: 'dept-mktg', label: 'Marketing', children: [
              { id: 'e4', label: 'Ana Anić' }
            ]
          },
          {
            id: 'dept-fin', label: 'Financije', children: [
              { id: 'e5', label: 'Šime Ivančić' }
            ]
          }
        ]
      }
    ]
  }
];

export const mockEmployeeEvents = [
  { id: 'ee1', date: '2023-01-10 09:00', action: 'Onboarding', user: 'System', details: 'Kreiran profil, dodijeljen odjel Sales' },
  { id: 'ee2', date: '2023-01-12 10:30', action: 'Asset Assigned', user: 'Admin', details: 'Zadužio Lenovo T14 (INV-1002)' },
  { id: 'ee3', date: '2023-02-05 14:15', action: 'Asset Assigned', user: 'Admin', details: 'Zadužio iPhone 15 (MOB-012)' },
  { id: 'ee4', date: '2024-08-22 09:30', action: 'PEBCAK Update', user: 'System', details: 'PEBCAK Score +1 (Work Order WO-2024-089: Prolio kavu po tipkovnici)' },
  { id: 'ee5', date: '2025-01-15 11:00', action: 'Department Change', user: 'HR Admin', details: 'Prebačen iz Sales u Management' },
  { id: 'ee6', date: '2026-04-01 15:45', action: 'Asset Returned', user: 'Admin', details: 'Vratio iPhone 15 (MOB-012)' },
];

export const mockAuditLog = [
  { id: 'a1', date: '2023-01-15 09:00', action: 'Asset Purchased', user: 'System', details: 'PO-2023-001' },
  { id: 'a2', date: '2023-01-20 10:30', action: 'Assigned to Employee', user: 'Admin', details: 'Assigned to Mirko Mirkić' },
  { id: 'a3', date: '2023-03-12 14:15', action: 'Ticket Opened', user: 'Mirko Mirkić', details: 'User reported screen flickering (TKT-1042)' },
  { id: 'a4', date: '2024-01-05 11:00', action: 'Maintenance', user: 'Agram Servis', details: 'Battery replacement & cleaning' },
  { id: 'a5', date: '2024-08-22 09:30', action: 'Ticket Opened', user: 'Mirko Mirkić', details: 'Keyboard key Space sticking (TKT-2891)' },
  { id: 'a6', date: '2026-02-28 15:45', action: 'Ticket Opened', user: 'Mirko Mirkić', details: 'Cannot connect to VPN (TKT-4012)' },
];

export const orgTree: TreeNodeData[] = [
  { 
    id: 'org1', 
    label: 'HP d.d. (Holding)', 
    children: [
      { 
        id: 'org1-1', 
        label: 'Hrvatska Pošta d.o.o.', 
        children: [
          { id: 'org1-1-1', label: 'IT Odjel' },
          { id: 'org1-1-2', label: 'Ljudski Resursi' }
        ]
      },
      { id: 'org1-2', label: 'HP Vozni Park d.o.o.' }
    ]
  }
];

export const locTree: TreeNodeData[] = [
  {
    id: 'tenant-1', label: 'Inverum Corp (Tenant)', children: [
      {
        id: 'loc-global-1', label: 'Global Data Center', children: [
          { id: 'loc-global-1-1', label: 'Server Room A' }
        ]
      },
      {
        id: 'org-1', label: 'Hrvatska Pošta d.d.', children: [
          {
            id: 'loc1',
            label: 'HQ Zagreb (Branimirova)',
            children: [
              {
                id: 'loc1-1',
                label: 'Kat 1',
                children: [
                  { id: 'loc1-1-1', label: 'Soba 101 (IT)' },
                  { id: 'loc1-1-2', label: 'Soba 102 (HR)' }
                ]
              },
              { id: 'loc1-2', label: 'Kat 2 (Uprava)' },
              { id: 'loc1-3', label: 'Skladište (Podrum)' }
            ]
          }
        ]
      }
    ]
  }
];

export const assetCategories = [
  {
    id: 'end-user',
    label: 'PC, Lap & Mob',
    icon: React.createElement(Laptop, { size: 14 }),
    types: ['Laptop', 'Desktop', 'Monitor', 'Mobile Phone', 'Tablet']
  },
  {
    id: 'infrastructure',
    label: 'Network & Server',
    icon: React.createElement(Server, { size: 14 }),
    types: ['Server', 'Router', 'Switch', 'Firewall', 'Access Point']
  },
  {
    id: 'peripherals',
    label: 'Peripherals & Other',
    icon: React.createElement(Box, { size: 14 }),
    types: ['Printer', 'Scanner', 'Docking Station', 'IP Phone', 'Vehicle']
  }
];

export const viewPresets = [
  { id: 'default', name: 'default_view', icon: React.createElement(AlignJustify, { size: 14 }), types: [], columns: ['type', 'assignee', 'location'] },
  { id: 'it-infra', name: 'it_infrastructure', icon: React.createElement(Server, { size: 14 }), types: ['Server', 'Router', 'Switch', 'Firewall', 'Access Point'], columns: ['type', 'location', 'IP Address', 'MAC Address', 'OS', 'Rack Unit'] },
  { id: 'mobile-fleet', name: 'mobile_fleet', icon: React.createElement(Smartphone, { size: 14 }), types: ['Laptop', 'Mobile Phone', 'Tablet'], columns: ['assignee', 'Storage', 'IMEI', 'Warranty Expiry', 'Phone Number'] },
  { id: 'vehicles', name: 'vehicles', icon: React.createElement(Car, { size: 14 }), types: ['Vehicle'], columns: ['assignee', 'License Plate', 'VIN', 'Next Service'] }
];
