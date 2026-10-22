import type { TreeNodeData } from '../types';

export const orgTree: TreeNodeData[] = [
  {
    id: 'org1',
    label: 'Hrvatska Pošta d.d.',
    children: [
      {
        id: 'org1-1',
        label: 'Hrvatska Pošta d.o.o.',
        children: [
          { id: 'org1-1-1', label: 'IT Odjel' },
          { id: 'org1-1-2', label: 'Ljudski Resursi' },
        ],
      },
      { id: 'org1-2', label: 'HP Vozni Park d.o.o.' },
    ],
  },
];

export const initialLocTree: TreeNodeData[] = [
  {
    id: 'org-1', label: 'Hrvatska Pošta d.d.', children: [
      {
        id: 'loc-hq', label: 'HQ Zagreb (Branimirova)', children: [
          {
            id: 'loc-hq-f1', label: 'Kat 1', children: [
              {
                id: 'loc-hq-f1-r101', label: 'Soba 101 (IT)', children: [
                  { id: 'ws-ivan', label: 'Workspace 1', assignedTo: 'Ivan Štimac' },
                  { id: 'ws-ana', label: 'Workspace 2', assignedTo: 'Ana Anić' },
                  { id: 'rack-a1', label: 'Rack A1', children: [] },
                  {
                    id: 'cab-b', label: 'Ormar B', children: [
                      { id: 'shelf-3c', label: 'Polica 3C' },
                    ],
                  },
                  {
                    id: 'cab-regal', label: 'Regalni Ormar', children: [
                      { id: 'shelf-a1', label: 'Polica A1' },
                      { id: 'shelf-a2', label: 'Polica A2' },
                      { id: 'shelf-a3', label: 'Polica A3' },
                      { id: 'shelf-a4', label: 'Polica A4' },
                      { id: 'shelf-b1', label: 'Polica B1' },
                      { id: 'shelf-b2', label: 'Polica B2' },
                      { id: 'shelf-b3', label: 'Polica B3' },
                      { id: 'shelf-b4', label: 'Polica B4' },
                      { id: 'shelf-c1', label: 'Polica C1' },
                      { id: 'shelf-c2', label: 'Polica C2' },
                      { id: 'shelf-c3', label: 'Polica C3' },
                      { id: 'shelf-c4', label: 'Polica C4' },
                    ],
                  },
                ],
              },
              {
                id: 'loc-hq-f1-r102', label: 'Soba 102 (HR)', children: [
                  { id: 'ws-marko', label: 'Workspace 1', assignedTo: 'Marko Horvat' },
                  { id: 'ws-open-1', label: 'Workspace 2', isOpenSpace: true },
                ],
              },
            ],
          },
          { id: 'loc-hq-f2', label: 'Kat 2 (Uprava)' },
          { id: 'loc-hq-f0', label: 'Skladište (Podrum)' },
        ],
      },
    ],
  },
];
