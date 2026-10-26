import React, { useState } from 'react';
import { X, Printer, FileCheck2 } from 'lucide-react';
import type { Asset, ActivePanel } from '../../types';
import { HistoryTimeline } from '../HistoryTimeline';
import { AssetEditForm } from './AssetEditForm';

interface AssetDetailPanelProps {
  asset: Asset | null;
  activePanel: ActivePanel;
  onClose: () => void;
  onSaveEdit: (asset: Asset) => void;
  onPanelChange: (panel: ActivePanel) => void;
  mockAuditLog: Array<{ id: string; date: string; action: string; user: string; details: string }>;
}

export function AssetDetailPanel({
  asset, activePanel, onClose, onSaveEdit, onPanelChange, mockAuditLog,
}: AssetDetailPanelProps) {
  const [generatingPdf, setGeneratingPdf] = useState(false);

  if (!asset || !activePanel) return null;

  const handlePrintSticker = async () => {
    const token = localStorage.getItem('inverum_access_token') || localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/documents/stickers/asset/${asset.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Sticker generation failed');
      const svgText = await res.text();
      const win = window.open('', '_blank', 'width=520,height=320');
      if (win) {
        win.document.write(
          `<!DOCTYPE html><html><head><title>Sticker ${asset.inventoryNumber}</title><style>@page{size:62mm 29mm;margin:0}body{margin:12px;display:flex;flex-direction:column;align-items:center;font-family:sans-serif;background:#f8fafc}</style></head><body>${svgText}<div style="margin-top:12px"><button onclick="window.print()" style="padding:6px 14px;background:#0f172a;color:#fff;border:0;border-radius:6px;cursor:pointer;font-size:12px">Print 62x29mm Label</button></div></body></html>`
        );
        win.document.close();
      }
    } catch {
      // Fallback blob download
    }
  };

  const handleGenerateHandoverPdf = async () => {
    setGeneratingPdf(true);
    const token = localStorage.getItem('inverum_access_token') || localStorage.getItem('token');
    try {
      const res = await fetch(`/api/v1/documents/handover/${asset.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          employee_name: asset.assignee || 'Custodian',
          action_type: asset.status === 'Retired' ? 'decommission' : 'handover',
        }),
      });
      if (!res.ok) throw new Error('Failed to generate signed PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `revers_${asset.inventoryNumber || asset.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{asset.name}</h2>
            <p className="text-xs text-slate-500 font-mono">{asset.inventoryNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintSticker}
              title="ISO A.5.13 — Print 62x29mm QR + Code128 Sticker"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Printer size={13} /> Print Sticker
            </button>
            <button
              onClick={handleGenerateHandoverPdf}
              disabled={generatingPdf}
              title="ISO A.5.10 / A.5.11 — Generate PAdES-B-LTA Signed Handover PDF"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              <FileCheck2 size={13} /> {generatingPdf ? 'Signing…' : 'Handover PDF (Revers)'}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 shrink-0">
          {(['details', 'history', 'edit'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => onPanelChange(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                ${activePanel === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activePanel === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                  <p className="text-sm font-medium text-slate-800 mt-1">{asset.status}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Type</label>
                  <p className="text-sm font-medium text-slate-800 mt-1">{asset.type}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Assignee</label>
                  <p className="text-sm font-medium text-slate-800 mt-1">{asset.assignee}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Location</label>
                  <p className="text-sm font-mono text-slate-600 mt-1">{asset.locId}</p>
                </div>
                {asset.serial_number && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Serial #</label>
                    <p className="text-sm font-mono text-slate-600 mt-1">{asset.serial_number}</p>
                  </div>
                )}
                {asset.purchase_date && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Purchase Date</label>
                    <p className="text-sm text-slate-600 mt-1">{asset.purchase_date}</p>
                  </div>
                )}
              </div>
              {asset.custom_fields && Object.keys(asset.custom_fields).length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">Custom Fields</label>
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-lg p-4 border border-slate-200">
                    {Object.entries(asset.custom_fields).map(([k, v]) => (
                      <div key={k}>
                        <p className="text-xs text-slate-400">{k}</p>
                        <p className="text-sm font-medium text-slate-700">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activePanel === 'history' && (
            <HistoryTimeline events={mockAuditLog} />
          )}

          {activePanel === 'edit' && (
            <AssetEditForm
              asset={asset}
              onSave={onSaveEdit}
              onCancel={() => onPanelChange('details')}
            />
          )}
        </div>
      </div>
    </>
  );
}
