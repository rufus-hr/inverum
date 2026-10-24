import { useState, useEffect, useMemo } from 'react';
import { Building2, Plus, Edit2, Users, Laptop, RotateCcw, Search, Check } from 'lucide-react';
import { TreeView } from '../components/TreeView';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { EditEmployeeModal } from '../components/EditModals';
import { useApiQuery, useApiMutation } from '../hooks/useApi';
import type { TreeNodeData, Employee, AuditLogEntry } from '../types';
import type {
  PagedResponse,
  CursorPagedResponse,
  EmployeeResponse,
  DepartmentResponse,
  AssetAssignmentResponse,
  AssetAssignCreatePayload,
  AssetResponse,
} from '../types/api';

export function EmployeesView() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedAssetToAssign, setSelectedAssetToAssign] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState('');

  const { data: empData, refetch: refetchEmployees } = useApiQuery<PagedResponse<EmployeeResponse>>('/employees/?limit=200');
  const { data: deptData, refetch: refetchDepts } = useApiQuery<PagedResponse<DepartmentResponse>>('/departments/?limit=100');
  const { data: assetsData, refetch: refetchAssets } = useApiQuery<CursorPagedResponse<AssetResponse>>('/assets/?limit=200');
  const { data: assignmentsData, refetch: refetchAssignments } = useApiQuery<PagedResponse<AssetAssignmentResponse>>(
    `/asset-assignments/?assigned_to_id=${selectedEmployeeId ?? ''}&limit=50`,
    { skip: !selectedEmployeeId, deps: [selectedEmployeeId] }
  );

  const updateEmployeeMutation = useApiMutation<Record<string, any>, EmployeeResponse>('/employees/', 'PUT');
  const assignAssetMutation = useApiMutation<AssetAssignCreatePayload, AssetAssignmentResponse>('/asset-assignments/', 'POST');
  const returnAssetMutation = useApiMutation<{ notes?: string }, AssetAssignmentResponse>('/asset-assignments/', 'POST');
  const createDeptMutation = useApiMutation<Record<string, any>, DepartmentResponse>('/departments/', 'POST');
  const deleteDeptMutation = useApiMutation<void, void>('/departments/', 'DELETE');

  const employees: (Employee & { department_id?: string | null; is_active?: boolean; employee_number?: string | null })[] = useMemo(() => {
    if (!empData?.items) return [];
    const deptNameMap = new Map<string, string>();
    for (const d of deptData?.items ?? []) {
      deptNameMap.set(d.id, d.name);
    }
    return empData.items.map((e) => ({
      id: e.id,
      name: e.name || `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim() || 'Unnamed Employee',
      department: (e.department_id && deptNameMap.get(e.department_id)) || e.job_title || 'Employee',
      email: e.email || '',
      phone: e.phone || '',
      pebcak_score: e.pebcak_score ?? 0,
      internal_tags: e.internal_tags || [],
      department_id: e.department_id,
      is_active: e.is_active ?? true,
      employee_number: e.employee_number,
    }));
  }, [empData, deptData]);

  const deptTree: TreeNodeData[] = useMemo(() => {
    const depts = deptData?.items ?? [];
    const q = searchQuery.trim().toLowerCase();
    const filteredEmps = q
      ? employees.filter(e => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.department.toLowerCase().includes(q))
      : employees;

    if (depts.length === 0) {
      return filteredEmps.map(e => ({ id: e.id, label: e.name }));
    }

    const nodeMap = new Map<string, TreeNodeData>();
    const roots: TreeNodeData[] = [];
    for (const d of depts) {
      nodeMap.set(d.id, { id: d.id, label: d.name, children: [] });
    }
    for (const d of depts) {
      const node = nodeMap.get(d.id)!;
      const parentId = (d as any).parent_id;
      if (parentId && nodeMap.has(parentId)) {
        nodeMap.get(parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }
    for (const emp of filteredEmps) {
      const empNode: TreeNodeData = { id: emp.id, label: emp.name };
      if (emp.department_id && nodeMap.has(emp.department_id)) {
        nodeMap.get(emp.department_id)!.children!.push(empNode);
      } else if (roots.length > 0) {
        roots[0].children!.push(empNode);
      }
    }
    return q ? roots.filter(r => (r.children?.length ?? 0) > 0) : roots;
  }, [deptData, employees, searchQuery]);

  // Auto-select first employee when loaded
  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  const assetById = useMemo(() => {
    const map = new Map<string, AssetResponse>();
    for (const a of assetsData?.items ?? []) {
      map.set(a.id, a);
    }
    return map;
  }, [assetsData]);

  const activeAssignments = useMemo(
    () => (assignmentsData?.items ?? []).filter(a => a.is_active && !a.returned_at),
    [assignmentsData]
  );

  const availableAssetsForAssign = useMemo(
    () => (assetsData?.items ?? []).filter(a => a.mobility_type !== 'fixed' && a.status !== 'retired'),
    [assetsData]
  );

  const timelineEvents: AuditLogEntry[] = useMemo(() => {
    const events: AuditLogEntry[] = [];
    for (const a of assignmentsData?.items ?? []) {
      const asset = assetById.get(a.asset_id);
      const assetLabel = asset ? `${asset.name ?? 'Asset'} (${asset.inventory_number ?? asset.serial_number ?? a.asset_id.slice(0, 8)})` : `Asset ${a.asset_id.slice(0, 8)}`;
      events.push({
        id: `${a.id}-assign`,
        date: new Date(a.assigned_at).toLocaleDateString('hr-HR'),
        action: `Assigned: ${assetLabel}`,
        details: a.notes || 'Oprema zadužena zaposleniku',
        user: 'IT Admin',
      });
      if (a.returned_at) {
        events.push({
          id: `${a.id}-return`,
          date: new Date(a.returned_at).toLocaleDateString('hr-HR'),
          action: `Returned: ${assetLabel}`,
          details: a.notes || 'Oprema vraćena na skladište',
          user: 'IT Admin',
        });
      }
    }
    return events;
  }, [assignmentsData, assetById]);

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

  const handleAssignAsset = async () => {
    if (!selectedEmployeeId || !selectedAssetToAssign) return;
    try {
      await assignAssetMutation.mutate({
        asset_id: selectedAssetToAssign,
        assigned_to_type: 'employee',
        assigned_to_id: selectedEmployeeId,
        notes: assignNotes || undefined,
      });
      setIsAssignModalOpen(false);
      setSelectedAssetToAssign('');
      setAssignNotes('');
      refetchAssignments();
      refetchAssets();
    } catch (err) {
      console.error('Failed to assign asset:', err);
    }
  };

  const handleReturnAsset = async (assignmentId: string) => {
    try {
      await returnAssetMutation.mutate(
        { notes: 'Razduženo kroz Employees ekran' },
        `/asset-assignments/${assignmentId}/return`
      );
      refetchAssignments();
      refetchAssets();
    } catch (err) {
      console.error('Failed to return asset:', err);
    }
  };

  return (
    <>
      <div className="flex-1 flex overflow-hidden bg-slate-50 p-6">
        <div className="w-80 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col h-full mr-6 shrink-0">
          <div className="p-4 border-b border-slate-100 font-bold text-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-blue-600" /> Departments ({employees.length})
            </div>
            <button
              onClick={async () => {
                const name = window.prompt('Naziv novog odjela (Department):');
                if (!name?.trim()) return;
                const orgId = deptData?.items?.[0]?.organization_id || empData?.items?.[0]?.organization_id;
                if (!orgId) return;
                await createDeptMutation.mutate({
                  organization_id: orgId,
                  name: name.trim(),
                  code: name.trim().slice(0, 6).toUpperCase(),
                  is_active: true,
                });
                refetchDepts();
              }}
              className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors"
              title="Add Department"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="px-3 pt-3 pb-1 border-b border-slate-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pretraži zaposlenike..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
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
              onDelete={async (id) => {
                if (deptData?.items?.some(d => d.id === id)) {
                  await deleteDeptMutation.mutate(undefined, `/departments/${id}`);
                  refetchDepts();
                }
              }}
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
                        {emp.employee_number && (
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {emp.employee_number}
                          </span>
                        )}
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
                      onClick={() => setIsAssignModalOpen(!isAssignModalOpen)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Zaduži opremu
                    </button>
                  </div>
                </div>

                {isAssignModalOpen && (
                  <div className="px-6 py-4 bg-blue-50/60 border-b border-blue-100 flex items-center gap-3">
                    <select
                      value={selectedAssetToAssign}
                      onChange={(e) => setSelectedAssetToAssign(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Odaberi opremu za zaduženje...</option>
                      {availableAssetsForAssign.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name ?? 'Asset'} — {a.inventory_number ?? a.serial_number ?? a.id.slice(0, 8)} ({a.status})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={assignNotes}
                      onChange={(e) => setAssignNotes(e.target.value)}
                      placeholder="Napomena uz zaduženje (opcionalno)..."
                      className="w-64 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleAssignAsset}
                      disabled={!selectedAssetToAssign || assignAssetMutation.isLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-1"
                    >
                      <Check size={14} /> Potvrdi
                    </button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-6 flex gap-6">
                  <div className="w-1/3 space-y-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Contact Info</h3>
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-slate-500 mb-0.5">Email</div>
                          <div className="text-sm font-medium text-slate-900">{emp.email || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-0.5">Phone</div>
                          <div className="text-sm font-medium text-slate-900">{emp.phone || '—'}</div>
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

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Zadužena oprema ({activeAssignments.length})
                        </h3>
                      </div>
                      {activeAssignments.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Trenutno nema aktivnih zaduženja.</p>
                      ) : (
                        <div className="space-y-2">
                          {activeAssignments.map((aa) => {
                            const asset = assetById.get(aa.asset_id);
                            return (
                              <div
                                key={aa.id}
                                className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <Laptop size={15} className="text-blue-600 shrink-0" />
                                  <div className="truncate">
                                    <div className="text-xs font-bold text-slate-900 truncate">
                                      {asset?.name ?? `Asset ${aa.asset_id.slice(0, 8)}`}
                                    </div>
                                    <div className="text-[10px] font-mono text-blue-600 font-bold">
                                      {asset?.inventory_number ?? asset?.serial_number ?? aa.asset_id.slice(0, 8)}
                                    </div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleReturnAsset(aa.id)}
                                  title="Razduži opremu"
                                  className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-amber-700 bg-slate-100 hover:bg-amber-50 rounded border border-slate-200 hover:border-amber-200 flex items-center gap-1 shrink-0 transition-colors"
                                >
                                  <RotateCcw size={11} /> Razduži
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-2/3">
                    <HistoryTimeline events={timelineEvents} />
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
        onSave={async (id, data) => {
          try {
            await updateEmployeeMutation.mutate(
              {
                pebcak_score: data.pebcak_score,
                internal_tags: data.internal_tags,
                is_active: data.status ? data.status === 'Active' : true,
              },
              `/employees/${id}`
            );
            refetchEmployees();
          } catch (err) {
            console.error('Failed to update employee:', err);
          }
          setIsEditEmployeeOpen(false);
        }}
        initialData={selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId) : undefined}
      />
    </>
  );
}

export default EmployeesView;
