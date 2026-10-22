import type { Employee, AuditLogEntry, TreeNodeData } from '../types';

export const mockEmployees: Employee[] = [
  { id: 'e1', name: 'Ivan Štimac', department: 'IT', email: 'ivan.stimac@hp.hr', phone: '+385 91 234 5678', pebcak_score: 0, internal_tags: ['VIP', 'Admin'] },
  { id: 'e2', name: 'Iva Šarić', department: 'HR', email: 'iva.saric@hp.hr', phone: '+385 91 345 6789', pebcak_score: 1, internal_tags: [] },
  { id: 'e3', name: 'Mirko Mirkić', department: 'Sales', email: 'mirko.mirkic@hp.hr', phone: '+385 91 456 7890', pebcak_score: 6, internal_tags: ['PEBCAK'] },
  { id: 'e4', name: 'Ana Anić', department: 'Marketing', email: 'ana.anic@hp.hr', phone: '+385 91 567 8901', pebcak_score: 0, internal_tags: [] },
  { id: 'e5', name: 'Šime Ivančić', department: 'Finance', email: 'sime.ivancic@hp.hr', phone: '+385 91 678 9012', pebcak_score: 2, internal_tags: ['handle_with_care'] },
];

export const mockDeptTree: TreeNodeData[] = [
  {
    id: 'org1', label: 'Hrvatska Pošta d.d.', children: [
      {
        id: 'org1-1', label: 'Hrvatska Pošta d.o.o.', children: [
          { id: 'org1-1-1', label: 'IT Odjel', children: [{ id: 'e1', label: 'Ivan Štimac' }] },
          { id: 'org1-1-2', label: 'Ljudski Resursi', children: [{ id: 'e2', label: 'Iva Šarić' }] },
          { id: 'dept-sales', label: 'Prodaja', children: [{ id: 'e3', label: 'Mirko Mirkić' }] },
          { id: 'dept-mktg', label: 'Marketing', children: [{ id: 'e4', label: 'Ana Anić' }] },
          { id: 'dept-fin', label: 'Financije', children: [{ id: 'e5', label: 'Šime Ivančić' }] },
        ],
      },
      { id: 'org1-2', label: 'HP Vozni Park d.o.o.' },
    ],
  },
];

export const mockEmployeeEvents: AuditLogEntry[] = [
  { id: 'ee1', date: '2023-01-10 09:00', action: 'Onboarding', user: 'System', details: 'Kreiran profil, dodijeljen odjel Sales' },
  { id: 'ee2', date: '2023-01-12 10:30', action: 'Asset Assigned', user: 'Admin', details: 'Zadužio Lenovo T14 (INV-1002)' },
  { id: 'ee3', date: '2023-02-05 14:15', action: 'Asset Assigned', user: 'Admin', details: 'Zadužio iPhone 15 (MOB-012)' },
  { id: 'ee4', date: '2024-08-22 09:30', action: 'PEBCAK Update', user: 'System', details: 'PEBCAK Score +1 (Work Order WO-2024-089: Prolio kavu po tipkovnici)' },
  { id: 'ee5', date: '2025-01-15 11:00', action: 'Department Change', user: 'HR Admin', details: 'Prebačen iz Sales u Management' },
  { id: 'ee6', date: '2026-04-01 15:45', action: 'Asset Returned', user: 'Admin', details: 'Vratio iPhone 15 (MOB-012)' },
];
