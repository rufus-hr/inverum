import React, { useState, useContext } from 'react';
import {
  Trash2, ChevronRight, Check, X, Edit2, AlertTriangle, Plus,
} from 'lucide-react';
import {
  SettingsContext, TenantConfigData, AssetCategory, NamingSchema, ReferenceGroup, ReferenceItem,
  SectionHeader, Input, Select, apiFetch,
} from './SettingsShared';

// ---------------------------------------------------------------------------
// Asset Types Tab — full CRUD & wired to /asset-categories/ + tenantConfig
// ---------------------------------------------------------------------------

export function AssetTypesTab() {
  const {
    assetCategories: categories,
    setAssetCategories: setCategories,
    namingSchemas,
    setNamingSchemas,
    saveTenantSettings,
  } = useContext(SettingsContext);
  const typesWithSchema = new Set(namingSchemas.map(s => s.typeId));
  const [expandedCat, setExpandedCat] = useState<string | null>('c1');
  const [addingField, setAddingField] = useState<string | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [addingType, setAddingType] = useState<string | null>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState('');

  const persistCategories = (next: AssetCategory[], nextSchemas?: NamingSchema[]) => {
    setCategories(next);
    if (nextSchemas) {
      setNamingSchemas(nextSchemas);
      void saveTenantSettings({ asset_categories: next, naming_schemas: nextSchemas });
    } else {
      void saveTenantSettings({ asset_categories: next });
    }
  };

  const addField = (typeId: string) => {
    if (!newFieldName.trim()) return;
    const next = categories.map(c => ({
      ...c,
      types: c.types.map(t => t.id === typeId ? { ...t, fields: [...t.fields, { id: Date.now().toString(), name: newFieldName.trim() }] } : t),
    }));
    persistCategories(next);
    setNewFieldName(''); setAddingField(null);
  };
  const removeField = (typeId: string, fieldId: string) => {
    const next = categories.map(c => ({
      ...c,
      types: c.types.map(t => t.id === typeId ? { ...t, fields: t.fields.filter(f => f.id !== fieldId) } : t),
    }));
    persistCategories(next);
  };
  const addType = (catId: string) => {
    if (!newTypeName.trim()) return;
    const trimmed = newTypeName.trim();
    const next = categories.map(c => c.id === catId ? { ...c, types: [...c.types, { id: Date.now().toString(), name: trimmed, fields: [] }] } : c);
    persistCategories(next);
    void apiFetch('/asset-categories/', {
      method: 'POST',
      body: JSON.stringify({ name: trimmed, code: trimmed.toUpperCase().slice(0, 10) }),
    }).catch(() => {});
    setNewTypeName(''); setAddingType(null);
  };
  const removeType = (catId: string, typeId: string) => {
    const next = categories.map(c => c.id === catId ? { ...c, types: c.types.filter(t => t.id !== typeId) } : c);
    const cleanedSchemas = namingSchemas.filter(s => s.typeId !== typeId);
    persistCategories(next, cleanedSchemas);
  };
  const saveTypeName = (typeId: string) => {
    if (!editTypeName.trim()) return;
    const next = categories.map(c => ({
      ...c,
      types: c.types.map(t => t.id === typeId ? { ...t, name: editTypeName.trim() } : t),
    }));
    persistCategories(next);
    setEditingType(null);
  };
  const addCategory = () => {
    if (!newCatName.trim()) return;
    const next = [...categories, { id: Date.now().toString(), name: newCatName.trim(), types: [] }];
    persistCategories(next);
    setNewCatName(''); setAddingCat(false);
  };
  const removeCategory = (catId: string) => {
    const removedTypeIds = new Set(categories.find(c => c.id === catId)?.types.map(t => t.id) ?? []);
    const next = categories.filter(c => c.id !== catId);
    const cleanedSchemas = namingSchemas.filter(s => !removedTypeIds.has(s.typeId));
    persistCategories(next, cleanedSchemas);
  };

  return (
    <div className="max-w-3xl">
      <SectionHeader title="Asset Categories & Types" description="Custom fields are added per asset type and shown in the asset detail panel" />
      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.id} className="border border-theme-border rounded-lg overflow-hidden">
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-theme-surface-hover transition-colors text-left" onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}>
              <div className="flex items-center gap-3">
                <span className="text-theme-sm font-semibold text-theme-text">{cat.name}</span>
                <span className="text-theme-xs text-theme-text-subtle">{cat.types.length} types</span>
              </div>
              <div className="flex items-center gap-1">
                <span onClick={(e) => { e.stopPropagation(); removeCategory(cat.id); }} className="p-1.5 text-theme-text-subtle hover:text-theme-danger transition-colors rounded cursor-pointer"><Trash2 size={13} /></span>
                <ChevronRight size={14} className={`text-theme-text-subtle transition-transform ${expandedCat === cat.id ? 'rotate-90' : ''}`} />
              </div>
            </button>
            {expandedCat === cat.id && (
              <div className="border-t border-theme-border">
                {cat.types.map((type) => (
                  <div key={type.id} className="px-4 py-3 border-b border-theme-border last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {editingType === type.id ? (
                          <div className="flex items-center gap-2 mb-2">
                            <Input value={editTypeName} onChange={setEditTypeName} className="w-48" onKeyDown={(e) => { if (e.key === 'Enter') saveTypeName(type.id); if (e.key === 'Escape') setEditingType(null); }} />
                            <button onClick={() => saveTypeName(type.id)} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                            <button onClick={() => setEditingType(null)} className="p-1 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-theme-sm font-medium text-theme-text">{type.name}</p>
                            <button onClick={() => { setEditingType(type.id); setEditTypeName(type.name); }} className="p-0.5 text-theme-text-subtle hover:text-theme-text transition-colors"><Edit2 size={11} /></button>
                            {!typesWithSchema.has(type.id) && (
                              <span title="No naming schema defined" className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                <AlertTriangle size={10} /> no schema
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {type.fields.map((f) => (
                            <span key={f.id} className="group/field inline-flex items-center gap-1 px-1.5 py-0.5 bg-theme-bg border border-theme-border rounded text-theme-xs text-theme-text-muted">
                              {f.name}
                              <button onClick={() => removeField(type.id, f.id)} className="opacity-0 group-hover/field:opacity-100 transition-opacity text-theme-text-subtle hover:text-theme-danger"><X size={9} /></button>
                            </span>
                          ))}
                          {addingField === type.id ? (
                            <span className="inline-flex items-center gap-1">
                              <Input value={newFieldName} onChange={setNewFieldName} placeholder="Field name" className="w-28 py-0.5 px-1.5 text-theme-xs h-auto" onKeyDown={(e) => { if (e.key === 'Enter') addField(type.id); if (e.key === 'Escape') { setAddingField(null); setNewFieldName(''); } }} />
                              <button onClick={() => addField(type.id)} className="p-0.5 text-emerald-600 hover:text-emerald-700"><Check size={11} /></button>
                              <button onClick={() => { setAddingField(null); setNewFieldName(''); }} className="p-0.5 text-theme-text-subtle hover:text-theme-text"><X size={11} /></button>
                            </span>
                          ) : (
                            <button onClick={() => { setAddingField(type.id); setNewFieldName(''); }} className="px-1.5 py-0.5 border border-dashed border-theme-border rounded text-theme-xs text-theme-text-subtle hover:text-theme-primary hover:border-theme-primary transition-colors">+ field</button>
                          )}
                        </div>
                      </div>
                      <button onClick={() => removeType(cat.id, type.id)} className="p-1.5 text-theme-text-subtle hover:text-theme-danger transition-colors ml-2 shrink-0"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2.5">
                  {addingType === cat.id ? (
                    <div className="flex items-center gap-2">
                      <Input value={newTypeName} onChange={setNewTypeName} placeholder="Type name" className="w-44" onKeyDown={(e) => { if (e.key === 'Enter') addType(cat.id); if (e.key === 'Escape') { setAddingType(null); setNewTypeName(''); } }} />
                      <button onClick={() => addType(cat.id)} className="p-1.5 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                      <button onClick={() => { setAddingType(null); setNewTypeName(''); }} className="p-1.5 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingType(cat.id); setNewTypeName(''); }} className="text-theme-xs text-theme-primary hover:text-theme-primary-hover flex items-center gap-1 transition-colors"><Plus size={12} /> Add type</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {addingCat ? (
          <div className="flex items-center gap-2 mt-2">
            <Input value={newCatName} onChange={setNewCatName} placeholder="Category name" className="w-52" onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') { setAddingCat(false); setNewCatName(''); } }} />
            <button onClick={addCategory} className="p-1.5 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
            <button onClick={() => { setAddingCat(false); setNewCatName(''); }} className="p-1.5 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
          </div>
        ) : (
          <button onClick={() => setAddingCat(true)} className="flex items-center gap-2 text-theme-sm text-theme-primary hover:text-theme-primary-hover mt-2 transition-colors"><Plus size={14} /> Add category</button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Naming Schemas Tab
// ---------------------------------------------------------------------------

export function NamingTab() {
  const { isOrg, selectedOrg, orgs, assetCategories, namingSchemas: schemas, setNamingSchemas: setSchemas, setTenantConfig } = useContext(SettingsContext);

  const orgOptions = Array.from(new Set(['All', ...orgs.filter(o => !o.isTenant).map(o => o.name)]));
  const allTypes = assetCategories.flatMap(c => c.types);
  const typesWithSchema = new Set(schemas.map(s => s.typeId));
  const missingCount = allTypes.filter(t => !typesWithSchema.has(t.id)).length;

  const [addingForType, setAddingForType] = useState<string | null>(null);
  const emptyNew = (typeId: string) => ({ typeId, prefix: '', start: 1, end: null as number | null, padding: 4, org: isOrg ? selectedOrg.name : 'All' });
  const [newSchema, setNewSchema] = useState(emptyNew(''));

  const persistSchemas = (next: NamingSchema[]) => {
    setSchemas(next);
    apiFetch<TenantConfigData>('/tenants/config/settings', {
      method: 'PATCH',
      body: JSON.stringify({ naming_schemas: next }),
    }).then(setTenantConfig).catch(() => {});
  };

  const addSchema = () => {
    if (!newSchema.typeId || !newSchema.prefix.trim()) return;
    persistSchemas([...schemas, { ...newSchema, id: Date.now().toString(), used: 0, capacity: newSchema.end }]);
    setAddingForType(null);
  };
  const removeSchema = (id: string) => persistSchemas(schemas.filter(x => x.id !== id));

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-theme-lg font-semibold text-theme-text">Naming Schemas</h2>
          <p className="text-theme-xs text-theme-text-muted mt-0.5">Auto-generated inventory numbers per asset type. Once assigned, numbers are never reused.</p>
        </div>
        {missingCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-theme-xs shrink-0">
            <AlertTriangle size={13} />
            {missingCount} asset type{missingCount > 1 ? 's' : ''} without a schema
          </div>
        )}
      </div>

      <div className="space-y-2">
        {assetCategories.map(cat => (
          <div key={cat.id}>
            <p className="text-theme-xs font-semibold text-theme-text-subtle uppercase tracking-wider mb-1.5 px-1">{cat.name}</p>
            <div className="border border-theme-border rounded-lg overflow-hidden mb-3">
              <table className="w-full text-theme-sm">
                <thead>
                  <tr className="border-b border-theme-border bg-theme-bg">
                    {['Asset Type', 'Prefix', 'Range', 'Capacity', 'Org', ''].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-theme-xs font-medium text-theme-text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cat.types.map(type => {
                    const schema = schemas.find(s => s.typeId === type.id);
                    const pct = schema?.capacity ? Math.round((schema.used / schema.capacity) * 100) : null;
                    return (
                      <React.Fragment key={type.id}>
                        {schema ? (
                          <tr className="border-b border-theme-border last:border-0 hover:bg-theme-surface-hover">
                            <td className="px-4 py-3 font-medium text-theme-text">{type.name}</td>
                            <td className="px-4 py-3"><code className="text-theme-xs bg-theme-bg px-1.5 py-0.5 rounded text-theme-primary border border-theme-border">{schema.prefix}</code></td>
                            <td className="px-4 py-3 text-theme-xs text-theme-text-muted">
                              {String(schema.start).padStart(schema.padding, '0')} → {schema.end ? String(schema.end).padStart(schema.padding, '0') : '∞'}
                            </td>
                            <td className="px-4 py-3">
                              {schema.capacity ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-1.5 bg-theme-bg rounded-full overflow-hidden border border-theme-border">
                                    <div className={`h-full rounded-full ${pct! > 80 ? 'bg-amber-400' : 'bg-theme-primary'}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-theme-xs text-theme-text-muted">{schema.used}/{schema.capacity}</span>
                                </div>
                              ) : <span className="text-theme-xs text-theme-text-subtle">Unlimited</span>}
                            </td>
                            <td className="px-4 py-3 text-theme-xs text-theme-text-muted">{schema.org}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => removeSchema(schema.id)} className="p-1 text-theme-text-subtle hover:text-theme-danger transition-colors"><Trash2 size={13} /></button>
                            </td>
                          </tr>
                        ) : addingForType === type.id ? (
                          <tr className="border-b border-theme-border bg-theme-bg">
                            <td className="px-4 py-2 text-theme-sm font-medium text-theme-text">{type.name}</td>
                            <td className="px-4 py-2"><Input value={newSchema.prefix} onChange={(v) => setNewSchema(s => ({ ...s, prefix: v }))} placeholder="PREFIX-" className="w-24" /></td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1">
                                <Input value={String(newSchema.start)} onChange={(v) => setNewSchema(s => ({ ...s, start: parseInt(v) || 1 }))} className="w-14" placeholder="1" />
                                <span className="text-theme-text-subtle text-theme-xs">→</span>
                                <Input value={newSchema.end !== null ? String(newSchema.end) : ''} onChange={(v) => setNewSchema(s => ({ ...s, end: v ? parseInt(v) || null : null }))} placeholder="∞" className="w-14" />
                              </div>
                            </td>
                            <td className="px-4 py-2"><span className="text-theme-xs text-theme-text-subtle">—</span></td>
                            <td className="px-4 py-2"><Select value={newSchema.org} onChange={(v) => setNewSchema(s => ({ ...s, org: v }))} options={orgOptions} className="w-32" /></td>
                            <td className="px-4 py-2">
                              <div className="flex gap-1">
                                <button onClick={addSchema} className="p-1 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                                <button onClick={() => setAddingForType(null)} className="p-1 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr className="border-b border-theme-border last:border-0 bg-amber-50/50 hover:bg-amber-50">
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-2 text-theme-sm text-amber-700">
                                <AlertTriangle size={12} className="shrink-0" /> {type.name}
                              </span>
                            </td>
                            <td colSpan={4} className="px-4 py-2.5 text-theme-xs text-amber-600 italic">No naming schema defined</td>
                            <td className="px-4 py-2.5">
                              <button onClick={() => { setAddingForType(type.id); setNewSchema(emptyNew(type.id)); }}
                                className="flex items-center gap-1 text-theme-xs text-theme-primary hover:text-theme-primary-hover transition-colors">
                                <Plus size={11} /> Add
                              </button>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reference Data Tab — full CRUD with inline edit, synced via SettingsContext
// ---------------------------------------------------------------------------

export function ReferenceDataTab() {
  const { referenceGroups: groups, setReferenceGroups: setGroups, saveTenantSettings } = useContext(SettingsContext);
  const [expanded, setExpanded] = useState<string | null>('classification');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editColor, setEditColor] = useState('');
  const [addingInGroup, setAddingInGroup] = useState<string | null>(null);
  const [newVal, setNewVal] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  const persistGroups = (next: ReferenceGroup[]) => {
    setGroups(next);
    void saveTenantSettings({ reference_groups: next });
  };

  const startEdit = (item: ReferenceItem) => {
    setEditingItem(item.id);
    setEditVal(item.label);
    setEditCode(item.code || '');
    setEditColor(item.color || '#6b7280');
  };
  const saveEdit = (groupId: string) => {
    const next = groups.map(g => g.id === groupId ? {
      ...g,
      items: g.items.map(i => i.id === editingItem ? {
        ...i,
        label: editVal.trim() || i.label,
        code: editCode.trim() ? editCode.trim().toUpperCase() : i.code,
        color: editColor,
      } : i),
    } : g);
    persistGroups(next);
    setEditingItem(null);
  };
  const removeItem = (groupId: string, itemId: string) => {
    const next = groups.map(g => g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g);
    persistGroups(next);
  };
  const addItem = (groupId: string) => {
    if (!newVal.trim()) return;
    const next = groups.map(g => g.id === groupId ? {
      ...g,
      items: [
        ...g.items,
        {
          id: Date.now().toString(),
          label: newVal.trim(),
          code: newCode.trim() ? newCode.trim().toUpperCase() : newVal.trim().toUpperCase().replace(/\s+/g, '_'),
          color: newColor,
        },
      ],
    } : g);
    persistGroups(next);
    setNewVal(''); setNewCode(''); setNewColor('#6b7280'); setAddingInGroup(null);
  };
  const removeGroup = (groupId: string) => {
    persistGroups(groups.filter(g => g.id !== groupId));
  };
  const addGroup = () => {
    if (!newGroupLabel.trim()) return;
    persistGroups([
      ...groups,
      {
        id: Date.now().toString(),
        name: newGroupLabel.trim(),
        description: newGroupDesc.trim() || 'Custom reference data group',
        hasColor: true,
        items: [],
      },
    ]);
    setNewGroupLabel(''); setNewGroupDesc(''); setAddingGroup(false);
  };

  return (
    <div className="max-w-2xl">
      <SectionHeader title="Reference Data" description="Tenant-managed lookup lists shared with Security (Classification Levels), Integrations (Scope Filters), and Work Orders" />
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.id} className="border border-theme-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 hover:bg-theme-surface-hover transition-colors">
              <button className="flex items-center gap-2 flex-1 text-left" onClick={() => setExpanded(expanded === g.id ? null : g.id)}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-theme-sm font-medium text-theme-text">{g.name}</span>
                    <span className="text-theme-xs text-theme-text-subtle">{g.items.length} items</span>
                  </div>
                  {g.description && <p className="text-theme-xs text-theme-text-subtle mt-0.5">{g.description}</p>}
                </div>
              </button>
              <div className="flex items-center gap-1">
                {!['classification', 'employee_tags', 'asset_conditions', 'wo_types'].includes(g.id) && (
                  <button onClick={() => removeGroup(g.id)} className="p-1.5 text-theme-text-subtle hover:text-theme-danger transition-colors"><Trash2 size={12} /></button>
                )}
                <ChevronRight size={14} className={`text-theme-text-subtle transition-transform ${expanded === g.id ? 'rotate-90' : ''}`} />
              </div>
            </div>
            {expanded === g.id && (
              <div className="border-t border-theme-border px-4 py-3 space-y-2">
                {g.items.map((item) => (
                  <div key={item.id}>
                    {editingItem === item.id ? (
                      <div className="flex items-center gap-2">
                        <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 shrink-0" />
                        <Input value={editVal} onChange={setEditVal} className="w-36" placeholder="Label" onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(g.id); if (e.key === 'Escape') setEditingItem(null); }} />
                        <Input value={editCode} onChange={setEditCode} className="flex-1 font-mono text-theme-xs" placeholder="CODE (optional)" onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(g.id); if (e.key === 'Escape') setEditingItem(null); }} />
                        <button onClick={() => saveEdit(g.id)} className="p-1 text-emerald-600 hover:text-emerald-700 shrink-0"><Check size={13} /></button>
                        <button onClick={() => setEditingItem(null)} className="p-1 text-theme-text-subtle hover:text-theme-text shrink-0"><X size={13} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 group/item">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color || '#64748b' }} />
                        <span className="text-theme-sm font-medium text-theme-text w-44">{item.label}</span>
                        <span className="text-theme-xs font-mono text-theme-text-muted flex-1">{item.code || ''}</span>
                        <button onClick={() => startEdit(item)} className="p-1 text-theme-text-subtle hover:text-theme-text transition-colors opacity-0 group-hover/item:opacity-100"><Edit2 size={12} /></button>
                        {!item.system && (
                          <button onClick={() => removeItem(g.id, item.id)} className="p-1 text-theme-text-subtle hover:text-theme-danger transition-colors opacity-0 group-hover/item:opacity-100"><Trash2 size={12} /></button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {addingInGroup === g.id ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 shrink-0" />
                    <Input value={newVal} onChange={setNewVal} placeholder="Label" className="w-36" onKeyDown={(e) => { if (e.key === 'Enter') addItem(g.id); if (e.key === 'Escape') { setAddingInGroup(null); setNewVal(''); setNewCode(''); } }} />
                    <Input value={newCode} onChange={setNewCode} placeholder="CODE (optional)" className="flex-1 font-mono text-theme-xs" onKeyDown={(e) => { if (e.key === 'Enter') addItem(g.id); if (e.key === 'Escape') { setAddingInGroup(null); setNewVal(''); setNewCode(''); } }} />
                    <button onClick={() => addItem(g.id)} className="p-1 text-emerald-600 hover:text-emerald-700 shrink-0"><Check size={13} /></button>
                    <button onClick={() => { setAddingInGroup(null); setNewVal(''); setNewCode(''); }} className="p-1 text-theme-text-subtle hover:text-theme-text shrink-0"><X size={13} /></button>
                  </div>
                ) : (
                  <button onClick={() => { setAddingInGroup(g.id); setNewVal(''); setNewCode(''); setNewColor('#6b7280'); }} className="flex items-center gap-1.5 text-theme-xs text-theme-primary hover:text-theme-primary-hover mt-1 transition-colors"><Plus size={12} /> Add item</button>
                )}
              </div>
            )}
          </div>
        ))}
        {addingGroup ? (
          <div className="flex items-center gap-2 mt-2">
            <Input value={newGroupLabel} onChange={setNewGroupLabel} placeholder="Group name" className="w-44" onKeyDown={(e) => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') { setAddingGroup(false); setNewGroupLabel(''); } }} />
            <Input value={newGroupDesc} onChange={setNewGroupDesc} placeholder="Description" className="flex-1" onKeyDown={(e) => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') { setAddingGroup(false); setNewGroupLabel(''); } }} />
            <button onClick={addGroup} className="p-1.5 text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
            <button onClick={() => { setAddingGroup(false); setNewGroupLabel(''); setNewGroupDesc(''); }} className="p-1.5 text-theme-text-subtle hover:text-theme-text"><X size={13} /></button>
          </div>
        ) : (
          <button onClick={() => setAddingGroup(true)} className="flex items-center gap-2 text-theme-sm text-theme-primary hover:text-theme-primary-hover mt-2 transition-colors"><Plus size={14} /> Add group</button>
        )}
      </div>
    </div>
  );
}
