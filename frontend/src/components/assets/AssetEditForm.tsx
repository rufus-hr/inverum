import React, { useState } from 'react';
import type { Asset } from '../../types';

interface AssetEditFormProps {
  asset: Asset;
  onSave: (updated: Asset) => void;
  onCancel: () => void;
}

export function AssetEditForm({ asset, onSave, onCancel }: AssetEditFormProps) {
  const [form, setForm] = useState<Asset>({ ...asset, custom_fields: { ...asset.custom_fields } });

  const handleChange = (field: keyof Asset, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCustomFieldChange = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      custom_fields: { ...(prev.custom_fields ?? {}), [key]: value },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className="w-full bg-white border border-slate-200 text-sm px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Serial Number</label>
        <input
          type="text"
          value={form.serial_number ?? ''}
          onChange={(e) => handleChange('serial_number', e.target.value)}
          className="w-full bg-white border border-slate-200 text-sm px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Status</label>
        <select
          value={form.status}
          onChange={(e) => handleChange('status', e.target.value)}
          className="w-full bg-white border border-slate-200 text-sm px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {['active', 'in_stock', 'in_service', 'pending', 'retired'].map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Assignee</label>
        <input
          type="text"
          value={form.assignee}
          onChange={(e) => handleChange('assignee', e.target.value)}
          className="w-full bg-white border border-slate-200 text-sm px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {form.custom_fields && Object.keys(form.custom_fields).length > 0 && (
        <div className="border-t border-slate-200 pt-4">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Custom Fields</h4>
          <div className="space-y-3">
            {Object.entries(form.custom_fields).map(([key, value]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-500 mb-1">{key}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => handleCustomFieldChange(key, e.target.value)}
                  className="w-full bg-white border border-slate-200 text-sm px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-500 transition-colors"
        >
          Save Changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
