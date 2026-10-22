import type { StorageUnitData } from '../components/StorageUnitComponents';
import type { BoxData } from '../components/BoxComponents';

export const mockStorageUnitData: StorageUnitData = {
  storage_unit: {
    id: 'rack-a1',
    name: 'Rack A1',
    type: 'rack',
    security_level: 2,
    is_lockable: false,
    location: { id: 'loc-hq-f1-r101', name: 'Soba 101 (IT)' },
  },
  children: [
    { type: 'shelf', id: 'shelf-a1', name: 'Polica A1', item_count: 3 },
    { type: 'shelf', id: 'shelf-a2', name: 'Polica A2', item_count: 2 },
    { type: 'shelf', id: 'shelf-a3', name: 'Polica A3', item_count: 0 },
    { type: 'safe', id: 'shelf-b1', name: 'Polica B1', item_count: 3 },
  ],
  assets: [
    { id: 's02', inventory_number: 'SRV-002', name: 'Dell PowerEdge R740', status: 'active', security_level: 2 },
    { id: 'sw01', inventory_number: 'SW-001', name: 'Cisco Catalyst 9300-48P', status: 'active', security_level: 2 },
    { id: 'fw01', inventory_number: 'FW-001', name: 'Palo Alto PA-3220', status: 'active', security_level: 3 },
    { id: 's01', inventory_number: 'SRV-001', name: 'Dell PowerEdge R750', status: 'active', security_level: 2 },
  ],
  boxes: [
    { id: 'box-042', inventory_number: 'BOX-042', status: 'sealed', item_count: 8 },
  ],
  security_violations: [
    {
      asset_id: 'fw01',
      inventory_number: 'FW-001',
      asset_security_level: 3,
      storage_unit_security_level: 2,
      message: 'Asset security level exceeds storage unit clearance.',
    },
  ],
};

export const mockBoxesData: BoxData[] = [
  {
    id: 'pal-001',
    inventory_number: 'PAL-001',
    label: 'Paleta — Zamjenski laptopi',
    status: 'open',
    location: { id: 'loc-hq-f0', name: 'Skladište (Podrum)' },
    assets: [],
    stock_items: [],
    consumables: [],
    accessories: [],
    children: [
      {
        id: 'box-042',
        inventory_number: 'BOX-042',
        label: 'Laptopi — batch Q1 2026',
        status: 'open',
        assets: [
          { id: 'l10', inventory_number: 'IT-LAP-300010', name: 'Dell Inspiron 15', status: 'Storage' },
          { id: 'l17', inventory_number: 'IT-LAP-300017', name: 'Lenovo ThinkPad P16', status: 'Storage' },
          { id: 'l22', inventory_number: 'IT-LAP-300022', name: 'HP EliteBook 840 G10', status: 'Storage' },
        ],
        stock_items: [
          { id: 'si-001', inventory_number: 'SFP-10G-SR', name: 'SFP+ 10G SR Modul', quantity: 10 },
          { id: 'si-002', inventory_number: 'RAM-DDR5-32', name: 'RAM DDR5 32GB', quantity: 5 },
        ],
        consumables: [],
        accessories: [
          { id: 'ac-001', inventory_number: 'ACC-001', name: 'Lenovo ThinkPad torba', quantity: 3 },
        ],
        children: [
          {
            id: 'box-007',
            inventory_number: 'BOX-007',
            label: 'Antistatička — SSD rezerve',
            status: 'sealed',
            assets: [],
            stock_items: [
              { id: 'si-003', inventory_number: 'SSD-NVMe-1T', name: 'SSD NVMe 1TB Samsung', quantity: 8 },
              { id: 'si-004', inventory_number: 'SSD-NVMe-512', name: 'SSD NVMe 512GB WD', quantity: 4 },
            ],
            consumables: [],
            accessories: [],
            children: [],
          },
        ],
      },
      {
        id: 'box-105',
        inventory_number: 'BOX-105',
        label: 'Potrošni materijal',
        status: 'open',
        assets: [],
        stock_items: [],
        consumables: [
          { id: 'con-001', inventory_number: 'TON-HP-CF217A', name: 'HP CF217A Toner', quantity: 5 },
          { id: 'con-002', inventory_number: 'TON-BRO-TN2421', name: 'Brother TN-2421 Toner', quantity: 3 },
          { id: 'con-003', inventory_number: 'CAB-CAT6-2M', name: 'CAT6 patch kabel 2m', quantity: 20 },
        ],
        accessories: [],
        children: [],
      },
    ],
  },
  {
    id: 'box-089',
    inventory_number: 'BOX-089',
    label: 'Server oprema — isporuka Branimirova',
    status: 'in_transit',
    transit_record: {
      id: 'TR-001',
      destination: 'HQ Zagreb (Branimirova)',
      carrier: 'SecureLogistics d.o.o.',
      tracking_number: 'SL-9988776655',
      estimated_arrival: '2026-04-10 14:00',
    },
    assets: [
      { id: 'srv-016', inventory_number: 'SRV-016', name: 'Dell PowerEdge R650', status: 'Storage' },
    ],
    stock_items: [
      { id: 'si-005', inventory_number: 'SW-CABLE-1M', name: 'SFP+ DAC kabel 1m', quantity: 4 },
    ],
    consumables: [],
    accessories: [
      { id: 'ac-002', inventory_number: 'ACC-002', name: 'Rack mounting kit Dell', quantity: 1 },
    ],
    children: [],
  },
  {
    id: 'box-201',
    inventory_number: 'BOX-201',
    label: 'Mrežna oprema — Kat 2',
    status: 'sealed',
    location: { id: 'loc-hq-f2', name: 'Kat 2 (Uprava)' },
    assets: [
      { id: 'ap-008', inventory_number: 'AP-008', name: 'Aruba AP-515', status: 'Storage' },
      { id: 'sw-009', inventory_number: 'SW-009', name: 'Cisco SG350-10', status: 'Storage' },
    ],
    stock_items: [],
    consumables: [
      { id: 'con-004', inventory_number: 'CAB-CAT6A-5M', name: 'CAT6A patch kabel 5m', quantity: 10 },
    ],
    accessories: [],
    children: [],
  },
  {
    id: 'box-303',
    inventory_number: 'BOX-303',
    label: 'Mobilni uređaji — offboarding',
    status: 'open',
    location: { id: 'loc-hq-f1-r102', name: 'Soba 102 (HR)' },
    assets: [
      { id: 'mob-006', inventory_number: 'MOB-006', name: 'Motorola Edge 40', status: 'Storage' },
      { id: 'tab-005', inventory_number: 'TAB-005', name: 'iPad Pro 11"', status: 'Storage' },
    ],
    stock_items: [],
    consumables: [],
    accessories: [
      { id: 'ac-003', inventory_number: 'ACC-003', name: 'iPhone punjač USB-C', quantity: 2 },
      { id: 'ac-004', inventory_number: 'ACC-004', name: 'Zaštitna maska iPad', quantity: 2 },
    ],
    children: [],
  },
];
