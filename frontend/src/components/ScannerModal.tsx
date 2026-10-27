import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, ScanLine, ArrowRight, CheckCircle2, AlertCircle,
  MapPin, FileCheck2, RefreshCw, Search, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import type { Asset } from '../types';
import { getAccessToken, getLastTenantSlug, apiFetch } from '../lib/api';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId?: string | null;
  locationName?: string;
  allAssets?: Asset[];
  locationAssetIds?: Set<string>;
  locNameMap?: Map<string, string>;
  onAuditCompleted?: () => void;
}

export function ScannerPlacementModal({
  isOpen,
  onClose,
  locationId,
  locationName = 'Odabrana lokacija',
  allAssets = [],
  locationAssetIds,
  locNameMap,
  onAuditCompleted,
}: ScannerModalProps) {
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [relocateMisplaced, setRelocateMisplaced] = useState(true);
  const [auditNotes, setAuditNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warn' | 'error'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setScannedCodes([]);
      setManualInput('');
      setFeedback(null);
      setAuditNotes('');
    }
  }, [isOpen]);

  // Expected assets in this location/subtree
  const expectedAssets = useMemo(() => {
    if (!locationId) return allAssets.slice(0, 15);
    if (locationAssetIds && locationAssetIds.size > 0) {
      return allAssets.filter(a => locationAssetIds.has(a.locId));
    }
    return allAssets.filter(a => a.locId === locationId);
  }, [allAssets, locationId, locationAssetIds]);

  const expectedIds = useMemo(() => new Set(expectedAssets.map(a => a.id)), [expectedAssets]);

  // Resolve scanned codes against allAssets
  const scannedAssetsMap = useMemo<Map<string, Asset>>(() => {
    const map = new Map<string, Asset>();
    for (const code of scannedCodes) {
      const normalized = code.trim().toUpperCase();
      const clean = normalized.replace(/^INVERUM:ASSET:/i, '').split(':')[0];
      const found = allAssets.find(
        a =>
          a.inventoryNumber.toUpperCase() === clean ||
          (a.serial_number && a.serial_number.toUpperCase() === clean) ||
          a.id.toUpperCase().startsWith(clean)
      );
      if (found) {
        map.set(found.id, found);
      }
    }
    return map;
  }, [scannedCodes, allAssets]);

  const matchedAssets = useMemo<Asset[]>(
    () => Array.from(scannedAssetsMap.values()).filter((a: Asset) => expectedIds.has(a.id)),
    [scannedAssetsMap, expectedIds]
  );

  const misplacedAssets = useMemo<Asset[]>(
    () => Array.from(scannedAssetsMap.values()).filter((a: Asset) => !expectedIds.has(a.id)),
    [scannedAssetsMap, expectedIds]
  );

  const missingAssets = useMemo<Asset[]>(
    () => expectedAssets.filter(a => !scannedAssetsMap.has(a.id)),
    [expectedAssets, scannedAssetsMap]
  );

  const handleScanCode = (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code) return;
    const clean = code.replace(/^INVERUM:ASSET:/i, '').split(':')[0];

    const found = allAssets.find(
      a =>
        a.inventoryNumber.toUpperCase() === clean ||
        (a.serial_number && a.serial_number.toUpperCase() === clean) ||
        a.id.toUpperCase().startsWith(clean)
    );

    if (!found) {
      setFeedback({ type: 'error', text: `Nepoznat barkod / inventarni broj: "${clean}"` });
      return;
    }

    setScannedCodes(prev => (prev.includes(found.inventoryNumber) ? prev : [...prev, found.inventoryNumber]));

    if (expectedIds.has(found.id)) {
      setFeedback({ type: 'success', text: `MATCHED: ${found.name} (${found.inventoryNumber}) je na točnoj lokaciji.` });
    } else {
      const otherLoc = (found.locId && locNameMap?.get(found.locId)) || found.locId || 'Druga lokacija';
      setFeedback({
        type: 'warn',
        text: `MISPLACED: ${found.name} (${found.inventoryNumber}) se u bazi vodi na "${otherLoc}"!`,
      });
    }
    setManualInput('');
    inputRef.current?.focus();
  };

  const handleRelocateSingle = async (asset: Asset) => {
    if (!locationId) return;
    try {
      await apiFetch(`/assets/${asset.id}`, {
        method: 'PUT',
        body: JSON.stringify({ location_id: locationId }),
      });
      setFeedback({
        type: 'success',
        text: `${asset.inventoryNumber} premješten na lokaciju ${locationName}.`,
      });
      onAuditCompleted?.();
    } catch {
      setFeedback({ type: 'error', text: `Greška pri premještanju ${asset.inventoryNumber}` });
    }
  };

  const handleFinalizeAudit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        location_id: locationId || null,
        location_name: locationName,
        relocate_misplaced: relocateMisplaced,
        notes: auditNotes.trim() || null,
        items: [
          ...matchedAssets.map(a => ({
            asset_id: a.id,
            inventory_number: a.inventoryNumber,
            name: a.name,
            expected_location: locationName,
            audit_status: 'matched',
          })),
          ...misplacedAssets.map(a => ({
            asset_id: a.id,
            inventory_number: a.inventoryNumber,
            name: a.name,
            expected_location: (a.locId && locNameMap?.get(a.locId)) || a.locId || 'Druga lokacija',
            audit_status: 'misplaced',
          })),
          ...missingAssets.map(a => ({
            asset_id: a.id,
            inventory_number: a.inventoryNumber,
            name: a.name,
            expected_location: locationName,
            audit_status: 'missing',
          })),
        ],
      };

      const token = getAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const slug = getLastTenantSlug();
      if (slug) headers['X-Tenant-Slug'] = slug;

      const res = await fetch('/api/v1/documents/inventory-audit', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventura_${locationName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      onAuditCompleted?.();
      onClose();
    } catch (err: any) {
      setFeedback({ type: 'error', text: `Greška pri potpisivanju zapisnika: ${err?.message || 'Nepoznata greška'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
              <ScanLine size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Fizička inventura & Barcode / QR Skener</h2>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Zebra HID / Camera Ready
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <MapPin size={12} className="text-blue-400" />
                Lokacija inventure: <strong className="text-white">{locationName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scanner Input Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-3 shrink-0">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleScanCode(manualInput);
            }}
            className="flex items-center gap-3"
          >
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                placeholder="Skeniraj QR / Code128 naljepnicu ili upiši inventarni / serijski broj pa pritisni Enter..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
            >
              <ScanLine size={15} /> Skeniraj
            </button>
            <button
              type="button"
              onClick={() => {
                for (const a of expectedAssets) {
                  setScannedCodes(prev => (prev.includes(a.inventoryNumber) ? prev : [...prev, a.inventoryNumber]));
                }
                setFeedback({
                  type: 'success',
                  text: `Svi očekivani uređaji na lokaciji (${expectedAssets.length}) označeni kao skenirani.`,
                });
              }}
              className="px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors shrink-0"
            >
              Skeniraj sve prisutne ({expectedAssets.length})
            </button>
          </form>

          {feedback && (
            <div
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : feedback.type === 'warn'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 size={15} className="shrink-0" />
              ) : feedback.type === 'warn' ? (
                <AlertTriangle size={15} className="shrink-0" />
              ) : (
                <AlertCircle size={15} className="shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}
        </div>

        {/* 3-Column Audit Breakdown: Matched / Misplaced / Missing */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-3 gap-4 bg-slate-50/50">
          {/* Column 1: MATCHED */}
          <div className="bg-white border border-emerald-200 rounded-xl flex flex-col overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-emerald-50/80 border-b border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                  Matched (Točna lokacija)
                </span>
              </div>
              <span className="px-2 py-0.5 text-xs font-extrabold rounded-full bg-emerald-200 text-emerald-900">
                {matchedAssets.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-64">
              {matchedAssets.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400 italic">Još nema potvrđenih uređaja.</p>
              ) : (
                matchedAssets.map(a => (
                  <div key={a.id} className="px-3.5 py-2.5 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{a.name}</p>
                      <p className="text-[11px] font-mono text-emerald-700 font-bold">{a.inventoryNumber}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      OK
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2: MISPLACED */}
          <div className="bg-white border border-amber-200 rounded-xl flex flex-col overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-amber-50/80 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900">
                  Misplaced (Kriva lokacija)
                </span>
              </div>
              <span className="px-2 py-0.5 text-xs font-extrabold rounded-full bg-amber-200 text-amber-900">
                {misplacedAssets.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-64">
              {misplacedAssets.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400 italic">Nema uređaja s drugih lokacija.</p>
              ) : (
                misplacedAssets.map(a => {
                  const expectedLoc = (a.locId && locNameMap?.get(a.locId)) || a.locId || 'Druga lokacija';
                  return (
                    <div key={a.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{a.name}</p>
                        <p className="text-[11px] font-mono text-amber-700 font-bold">{a.inventoryNumber}</p>
                        <p className="text-[10px] text-slate-500 truncate">Vodi se na: {expectedLoc}</p>
                      </div>
                      {locationId && (
                        <button
                          type="button"
                          onClick={() => handleRelocateSingle(a)}
                          className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-[10px] font-bold shrink-0 transition-colors"
                          title="Premjesti na ovu lokaciju"
                        >
                          Premjesti ovdje
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 3: MISSING */}
          <div className="bg-white border border-red-200 rounded-xl flex flex-col overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-red-50/80 border-b border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-600" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-red-900">
                  Missing (Nije skenirano)
                </span>
              </div>
              <span className="px-2 py-0.5 text-xs font-extrabold rounded-full bg-red-200 text-red-900">
                {missingAssets.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-64">
              {missingAssets.length === 0 ? (
                <p className="p-6 text-center text-xs text-emerald-600 font-bold">
                  Svi uređaji s ove lokacije su pronađeni!
                </p>
              ) : (
                missingAssets.map(a => (
                  <div key={a.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{a.name}</p>
                      <p className="text-[11px] font-mono text-red-600 font-bold">{a.inventoryNumber}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleScanCode(a.inventoryNumber)}
                      className="px-2 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded text-[10px] font-bold shrink-0 transition-colors"
                    >
                      + Skeniraj
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick simulation bar for testing misplaced scan from another room */}
        {allAssets.length > expectedAssets.length && (
          <div className="px-6 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Brzi test skeniranja uređaja koji pripada drugoj lokaciji (Misplaced):
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {allAssets
                .filter(a => !expectedIds.has(a.id) && !scannedAssetsMap.has(a.id))
                .slice(0, 3)
                .map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleScanCode(a.inventoryNumber)}
                    className="px-2 py-1 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 rounded font-mono text-[11px] font-bold transition-colors"
                  >
                    + {a.inventoryNumber}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={relocateMisplaced}
                onChange={e => setRelocateMisplaced(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Automatski premjesti Misplaced uređaje ({misplacedAssets.length}) na ovu lokaciju
            </label>
            <input
              type="text"
              value={auditNotes}
              onChange={e => setAuditNotes(e.target.value)}
              placeholder="Napomena revizora uz zapisnik..."
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setScannedCodes([]);
                setFeedback(null);
              }}
              className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Resetiraj
            </button>
            <button
              type="button"
              onClick={handleFinalizeAudit}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={15} className="animate-spin" /> Potpisivanje PAdES-B-LTA...
                </>
              ) : (
                <>
                  <FileCheck2 size={15} /> Zaključi inventuru & Preuzmi PAdES Zapisnik
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
