import { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Users } from 'lucide-react';
import { TreeView } from '../components/TreeView';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { EditEmployeeModal } from '../components/EditModals';
import { apiFetch } from '../lib/api';
import type { TreeNodeData, Employee } from '../types';

export function EmployeesView() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deptTree, setDeptTree] = useState<TreeNodeData[]>([]);

  // Fetch employees from API
  useEffect(() => {
    apiFetch<{ items: any[] }>('/employees/?limit=200')
      .then(resp => {
        if (resp.items && resp.items.length > 0) {
          setEmployees(resp.items.map((e: any) => ({
            id: e.id,
            name: `${e.first_name} ${e.last_name}`,
            department: e.job_title || 'Employee',
            email: e.email || '',
            phone: e.phone || '',
            pebcak_score: e.pebcak_score || 0,
            internal_tags: e.internal_tags || [],
            department_id: e.department_id,
          })));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch departments tree from API, attach employees as leaves
  useEffect(() => {
    if (employees.length === 0) return;
    apiFetch<{ items: any[] }>('/departments/?limit=100')
      .then(resp => {
        if (resp.items && resp.items.length > 0) {
          const nodeMap = new Map<string, TreeNodeData>();
          const roots: TreeNodeData[] = [];
          for (const d of resp.items) {
            nodeMap.set(d.id, { id: d.id, label: d.name, children: [] });
          }
          for (const d of resp.items) {
            const node = nodeMap.get(d.id)!;
            if (d.parent_id && nodeMap.has(d.parent_id)) {
              nodeMap.get(d.parent_id)!.children!.push(node);
            } else {
              roots.push(node);
            }
          }
          // Attach employees as leaves under their department
          for (const emp of employees) {
            const deptId = (emp as any).department_id;
            const empNode: TreeNodeData = { id: emp.id, label: emp.name };
            if (deptId && nodeMap.has(deptId)) {
              nodeMap.get(deptId)!.children!.push(empNode);
            } else {
              // No department — add to first root
              if (roots.length > 0) roots[0].children!.push(empNode);
            }
          }
          if (roots.length > 0) setDeptTree(roots);
        }
      })
      .catch(() => {});
  }, [employees]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key.toLowerCase() === 'e') {
        if (selectedEmployeeId) {
          setIsEditEmployeeOpen(true);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEmployeeId]);

  return (
    <>
      <div className="flex-1 flex overflow-hidden bg-slate-50 p-6">
        <div className="w-80 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col h-full mr-6 shrink-0">
          <div className="p-4 border-b border-slate-100 font-bold text-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-blue-600" /> Departments
            </div>
            <button className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors" title="Add Root Department">
              <Plus size={16} />
            </button>
          </div>
          <div className="p-2 flex-1 overflow-y-auto">
            <TreeView
              data={deptTree}
              onSelect={(node) => {
                if (!node.children) {
                  setSelectedEmployeeId(node.id);
                }
              }}
              selectedId={selectedEmployeeId}
              onAdd={(id) => console.log('Add sub-department to', id)}
              onDelete={(id) => console.log('Delete department', id)}
            />
          </div>
        </div>
        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {selectedEmployeeId && employees.find(e => e.id === selectedEmployeeId) ? (() => {
            const emp = employees.find(e => e.id === selectedEmployeeId)!;
            return (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-white shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold border-4 border-white shadow-sm">
                      {emp.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-slate-900">{emp.name}</h2>
                        <button
                          onClick={() => setIsEditEmployeeOpen(true)}
                          className="flex items-center justify-center w-8 h-8 bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg transition-colors border border-slate-200 hover:border-blue-200"
                          title="Edit Profile (E)"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                      <div className="text-slate-500 font-medium flex items-center gap-2 mt-1">
                        <Building2 size={14} /> {emp.department}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditEmployeeOpen(true)}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors shadow-sm hidden"
                    >
                      Edit Profile
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 flex gap-6">
                  <div className="w-1/3 space-y-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Contact Info</h3>
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-slate-500 mb-0.5">Email</div>
                          <div className="text-sm font-medium text-slate-900">{emp.email}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-0.5">Phone</div>
                          <div className="text-sm font-medium text-slate-900">{emp.phone}</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">IT Metrics</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-slate-600">PEBCAK Score</div>
                          <div className={`text-sm font-bold px-2 py-0.5 rounded ${emp.pebcak_score > 5 ? 'bg-red-100 text-red-700' : emp.pebcak_score > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {emp.pebcak_score}
                          </div>
                        </div>
                        {emp.internal_tags && emp.internal_tags.length > 0 && (
                          <div>
                            <div className="text-xs text-slate-500 mb-2">Internal Tags</div>
                            <div className="flex flex-wrap gap-1">
                              {emp.internal_tags.map(tag => (
                                <span key={tag} className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded uppercase tracking-wider">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-2/3">
                    <HistoryTimeline events={[]} />
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Users size={48} className="mx-auto mb-4 opacity-20" />
                <p>Select an employee to view details and history.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <EditEmployeeModal
        isOpen={isEditEmployeeOpen}
        onClose={() => setIsEditEmployeeOpen(false)}
        employeeId={selectedEmployeeId}
        onSave={(id, data) => {
          console.log('Save employee', id, data);
          setIsEditEmployeeOpen(false);
        }}
        initialData={selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId) : undefined}
      />
    </>
  );
}

export default EmployeesView;
