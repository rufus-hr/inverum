import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, X, Lock, FileText, GripVertical,
  ArrowUp, ArrowDown, Trash2, Edit2, ToggleLeft, ToggleRight,
} from 'lucide-react';
import {
  SopTemplate, ChecklistItemDef, Frequency,
  TRIGGER_EVENTS, TRIGGER_COLOR_CLASSES, ASSET_TYPE_TREE,
  ALL_ASSET_TYPES, FREQUENCY_LABELS, USER_GROUPS,
  getTriggerBadge, genId,
} from './ChecklistTypesAndHelpers';

// ── Templates Tab ───────────────────────────────────────────────────────────

export function TemplateListPanel({
  templates,
  selectedId,
  onSelect,
  onCreate,
  searchQuery,
  onSearchChange,
  filterTrigger,
  onFilterTriggerChange,
  filterCategory,
  onFilterCategoryChange,
}: {
  templates: SopTemplate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterTrigger: string;
  onFilterTriggerChange: (t: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (c: string) => void;
}) {
  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterTrigger && !t.triggers.includes(filterTrigger)) return false;
      if (filterCategory && !t.assetCategories.includes(filterCategory)) return false;
      return true;
    });
  }, [templates, searchQuery, filterTrigger, filterCategory]);

  return (
    <div className="w-80 flex-shrink-0 border-r border-slate-200 flex flex-col h-full bg-white">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800">SOP Templates</h2>
          <button
            onClick={onCreate}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            New Template
          </button>
        </div>
        <div className="relative mb-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <select
            value={filterTrigger}
            onChange={e => onFilterTriggerChange(e.target.value)}
            className="flex-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Triggers</option>
            {TRIGGER_EVENTS.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={e => onFilterCategoryChange(e.target.value)}
            className="flex-1 text-xs border border-slate-200 rounded-md px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {ASSET_TYPE_TREE.map(cat => (
              <optgroup key={cat.category} label={cat.category}>
                {cat.types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-4 text-center text-sm text-slate-400">No templates found</div>
        )}
        {filtered.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors ${
              selectedId === t.id
                ? 'bg-blue-50 border-l-2 border-l-blue-600'
                : 'hover:bg-slate-50 border-l-2 border-l-transparent'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-800 truncate">{t.name}</span>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </div>
            <div className="flex items-center gap-1 flex-wrap mb-1">
              {t.triggers.map(tr => {
                const b = getTriggerBadge(tr);
                return (
                  <span key={tr} className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${b.colorClass}`}>
                    {b.label}
                  </span>
                );
              })}
            </div>
            <span className="text-xs text-slate-400">{t.items.length} items</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Template Editor ─────────────────────────────────────────────────────────

export function TemplateEditor({
  template,
  onUpdate,
  onDeleteTemplate,
}: {
  template: SopTemplate;
  onUpdate: (updated: SopTemplate) => void;
  onDeleteTemplate?: (id: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(template.name);
  const [showTriggerDropdown, setShowTriggerDropdown] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');
  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const newItemRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameValue(template.name);
    setEditingName(false);
    setEditingItemId(null);
    setShowTriggerDropdown(false);
  }, [template.id, template.name]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const saveName = () => {
    if (nameValue.trim()) {
      onUpdate({ ...template, name: nameValue.trim() });
    } else {
      setNameValue(template.name);
    }
    setEditingName(false);
  };

  const unselectedTriggers = TRIGGER_EVENTS.filter(t => !template.triggers.includes(t.id));

  const addTrigger = (triggerId: string) => {
    onUpdate({ ...template, triggers: [...template.triggers, triggerId] });
    setShowTriggerDropdown(false);
  };

  const removeTrigger = (triggerId: string) => {
    onUpdate({ ...template, triggers: template.triggers.filter(t => t !== triggerId) });
  };

  const updateItem = (itemId: string, patch: Partial<ChecklistItemDef>) => {
    onUpdate({
      ...template,
      items: template.items.map(it => it.id === itemId ? { ...it, ...patch } : it),
    });
  };

  const deleteItem = (itemId: string) => {
    const newItems = template.items
      .filter(it => it.id !== itemId)
      .map((it, idx) => ({
        ...it,
        orderIndex: idx,
        dependsOn: it.dependsOn === itemId ? null : it.dependsOn,
      }));
    onUpdate({ ...template, items: newItems });
  };

  const moveItem = (itemId: string, direction: 'up' | 'down') => {
    const items = [...template.items].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = items.findIndex(i => i.id === itemId);
    if (direction === 'up' && idx > 0) {
      [items[idx], items[idx - 1]] = [items[idx - 1], items[idx]];
    } else if (direction === 'down' && idx < items.length - 1) {
      [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
    }
    onUpdate({ ...template, items: items.map((it, i) => ({ ...it, orderIndex: i })) });
  };

  const addItem = () => {
    const newId = genId('item_');
    const newItem: ChecklistItemDef = {
      id: newId,
      text: '',
      orderIndex: template.items.length,
      isBlocking: false,
      requiresNote: false,
      dependsOn: null,
    };
    onUpdate({ ...template, items: [...template.items, newItem] });
    setEditingItemId(newId);
    setEditingItemText('');
    setTimeout(() => newItemRef.current?.focus(), 50);
  };

  const saveItemText = (itemId: string) => {
    if (editingItemText.trim()) {
      updateItem(itemId, { text: editingItemText.trim() });
    }
    setEditingItemId(null);
  };

  const sortedItems = [...template.items].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameValue(template.name); setEditingName(false); } }}
              onBlur={saveName}
              className="text-xl font-semibold text-slate-800 border-b-2 border-blue-500 focus:outline-none bg-transparent"
            />
          ) : (
            <button
              onClick={() => { setEditingName(true); setNameValue(template.name); }}
              className="text-xl font-semibold text-slate-800 hover:text-blue-600 flex items-center gap-2 group"
            >
              {template.name}
              <Edit2 size={14} className="text-slate-400 group-hover:text-blue-500" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdate({ ...template, isActive: !template.isActive })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              template.isActive
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {template.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            {template.isActive ? 'Active' : 'Inactive'}
          </button>
          {onDeleteTemplate && (
            <button
              onClick={() => onDeleteTemplate(template.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
              title="Delete template"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">Trigger Events</label>
        <div className="flex items-center gap-2 flex-wrap">
          {template.triggers.map(tr => {
            const b = getTriggerBadge(tr);
            return (
              <span key={tr} className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${b.colorClass}`}>
                {b.label}
                <button onClick={() => removeTrigger(tr)} className="hover:opacity-70">
                  <X size={12} />
                </button>
              </span>
            );
          })}
          <div className="relative">
            <button
              onClick={() => setShowTriggerDropdown(!showTriggerDropdown)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
            >
              <Plus size={12} />
              Add trigger
            </button>
            {showTriggerDropdown && unselectedTriggers.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 min-w-[180px]">
                {unselectedTriggers.map(t => {
                  const cc = TRIGGER_COLOR_CLASSES[t.color] || '';
                  return (
                    <button
                      key={t.id}
                      onClick={() => addTrigger(t.id)}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <span className={`w-2 h-2 rounded-full ${cc.split(' ')[0]}`} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Applies to Asset Types
          {template.assetCategories.length === 0
            ? <span className="ml-2 text-xs text-slate-400 font-normal">All types</span>
            : <span className="ml-2 text-xs text-slate-400 font-normal">{template.assetCategories.length} selected</span>
          }
        </label>
        {template.assetCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {template.assetCategories.map(id => {
              const t = ALL_ASSET_TYPES.find(at => at.id === id);
              return t ? (
                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                  {t.name}
                  <button onClick={() => onUpdate({ ...template, assetCategories: template.assetCategories.filter(c => c !== id) })}
                    className="hover:text-blue-900">×</button>
                </span>
              ) : null;
            })}
            <button
              onClick={() => onUpdate({ ...template, assetCategories: [] })}
              className="text-xs text-slate-400 hover:text-slate-600 px-1"
            >Clear all</button>
          </div>
        )}
        <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
          {ASSET_TYPE_TREE.map(cat => {
            const catTypeIds = cat.types.map(t => t.id);
            const allSelected = catTypeIds.every(id => template.assetCategories.includes(id));
            const someSelected = !allSelected && catTypeIds.some(id => template.assetCategories.includes(id));
            return (
              <div key={cat.category}>
                <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={() => {
                      if (allSelected) {
                        onUpdate({ ...template, assetCategories: template.assetCategories.filter(id => !catTypeIds.includes(id)) });
                      } else {
                        const merged = new Set([...template.assetCategories, ...catTypeIds]);
                        onUpdate({ ...template, assetCategories: [...merged] });
                      }
                    }}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{cat.category}</span>
                </label>
                {cat.types.map(type => (
                  <label key={type.id} className="flex items-center gap-2 px-3 py-1.5 pl-8 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={template.assetCategories.includes(type.id)}
                      onChange={() => {
                        const has = template.assetCategories.includes(type.id);
                        onUpdate({
                          ...template,
                          assetCategories: has
                            ? template.assetCategories.filter(id => id !== type.id)
                            : [...template.assetCategories, type.id],
                        });
                      }}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-sm text-slate-700">{type.name}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">Frequency</label>
        <div className="flex gap-4">
          {(Object.entries(FREQUENCY_LABELS) as [Frequency, string][]).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`freq-${template.id}`}
                checked={template.frequency === val}
                onChange={() => onUpdate({ ...template, frequency: val })}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-6 flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            onClick={() => onUpdate({ ...template, isRequired: !template.isRequired })}
            className={`relative w-9 h-5 rounded-full transition-colors ${template.isRequired ? 'bg-blue-600' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${template.isRequired ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
          <span className="text-sm text-slate-700">Required</span>
          <span className="text-xs text-slate-400">(blocks transition)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            onClick={() => onUpdate({ ...template, requiresConfirmation: !template.requiresConfirmation })}
            className={`relative w-9 h-5 rounded-full transition-colors ${template.requiresConfirmation ? 'bg-blue-600' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${template.requiresConfirmation ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
          <span className="text-sm text-slate-700">Requires 4-Eyes Confirmation</span>
        </label>
      </div>

      {template.requiresConfirmation && (
        <div className="mb-6 ml-11">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Confirmation Group</label>
          <select
            value={template.confirmationGroupId || ''}
            onChange={e => onUpdate({ ...template, confirmationGroupId: e.target.value || null })}
            className="w-64 text-sm border border-slate-200 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Any user with confirm permission</option>
            {USER_GROUPS.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Only members of this group can perform the second sign-off.</p>
        </div>
      )}

      <div className="border-t border-slate-200 my-6" />

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          Checklist Items <span className="text-slate-400 font-normal">({sortedItems.length})</span>
        </h3>
      </div>

      <div className="space-y-2 mb-4">
        {sortedItems.map((item, idx) => {
          const isEditing = editingItemId === item.id;
          const previousItems = sortedItems.filter(it => it.orderIndex < item.orderIndex);
          return (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 group"
            >
              <GripVertical size={16} className="text-slate-300 flex-shrink-0 cursor-grab" />
              <span className="text-xs font-medium text-slate-400 w-5 flex-shrink-0">{idx + 1}.</span>

              {isEditing ? (
                <input
                  ref={item.text === '' ? newItemRef : undefined}
                  value={editingItemText}
                  onChange={e => setEditingItemText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveItemText(item.id); if (e.key === 'Escape') setEditingItemId(null); }}
                  onBlur={() => saveItemText(item.id)}
                  placeholder="Enter item text..."
                  className="flex-1 text-sm text-slate-800 bg-white border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              ) : (
                <button
                  onClick={() => { setEditingItemId(item.id); setEditingItemText(item.text); }}
                  className="flex-1 text-left text-sm text-slate-800 hover:text-blue-600 truncate"
                >
                  {item.text || <span className="text-slate-400 italic">Click to edit...</span>}
                </button>
              )}

              <button
                onClick={() => updateItem(item.id, { isBlocking: !item.isBlocking })}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors flex-shrink-0 ${
                  item.isBlocking ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'
                }`}
                title="Blocking"
              >
                <Lock size={11} />
                Blocking
              </button>

              <button
                onClick={() => updateItem(item.id, { requiresNote: !item.requiresNote })}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors flex-shrink-0 ${
                  item.requiresNote ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'
                }`}
                title="Note Required"
              >
                <FileText size={11} />
                Note
              </button>

              <select
                value={item.dependsOn || ''}
                onChange={e => updateItem(item.id, { dependsOn: e.target.value || null })}
                className="text-xs border border-slate-200 rounded px-1.5 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[120px] flex-shrink-0"
                title="Depends on"
              >
                <option value="">None</option>
                {previousItems.map(pi => (
                  <option key={pi.id} value={pi.id}>
                    {pi.orderIndex + 1}. {pi.text.slice(0, 20)}{pi.text.length > 20 ? '...' : ''}
                  </option>
                ))}
              </select>

              <button
                onClick={() => moveItem(item.id, 'up')}
                disabled={idx === 0}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 flex-shrink-0"
                title="Move up"
              >
                <ArrowUp size={14} />
              </button>
              <button
                onClick={() => moveItem(item.id, 'down')}
                disabled={idx === sortedItems.length - 1}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 flex-shrink-0"
                title="Move down"
              >
                <ArrowDown size={14} />
              </button>

              <button
                onClick={() => deleteItem(item.id)}
                className="p-1 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                title="Delete item"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={addItem}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
      >
        <Plus size={14} />
        Add Item
      </button>
    </div>
  );
}
