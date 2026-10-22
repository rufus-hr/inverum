import React, { useState } from 'react';
import { 
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, XCircle, 
  ArrowRight, ArrowLeft, RefreshCcw, Settings2, Database, Loader2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { apiFetch, uploadFile as uploadApi, ApiError } from '../lib/api';

// --- Types ---
interface UploadResponse {
  job_id: string;
  filename: string;
  row_count: number;
  columns: string[];
}

interface MappingTemplate {
  id: string;
  name: string;
  mappings: Record<string, string>;
}

const INVERUM_FIELDS = [
  { id: 'inventory_number', label: 'Inventory Number', required: true },
  { id: 'serial_number', label: 'Serial Number', required: true },
  { id: 'name', label: 'Name / Model', required: false },
  { id: 'category_id', label: 'Category', required: false },
  { id: 'location_id', label: 'Location', required: true },
  { id: 'purchase_date', label: 'Purchase Date', required: false },
  { id: 'purchase_cost', label: 'Purchase Cost', required: false },
];

export default function ImportWizard() {
  const [step, setStep] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload result
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);

  // Mapping state
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);

  // Validation state
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validating, setValidating] = useState(false);

  const nextStep = () => setStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  // --- Step 1: Upload ---
  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) await uploadFile(files[0]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) await uploadFile(files[0]);
  };

  const uploadFile = async (f: File) => {
    setFile(f);
    setUploading(true);
    setError(null);
    try {
      const result = await uploadApi<UploadResponse>('/imports/upload', f);
      setUploadResult(result);
      nextStep();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // --- Step 2: Mapping ---
  const handleMappingSubmit = async () => {
    if (!uploadResult) return;
    try {
      await apiFetch(`/imports/${uploadResult.job_id}/map`, {
        method: 'POST',
        body: JSON.stringify({ mapping: mappings }),
      });
      nextStep();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mapping failed');
    }
  };

  // --- Step 3: Validate ---
  const handleValidate = async () => {
    if (!uploadResult) return;
    setValidating(true);
    try {
      const result = await apiFetch(`/imports/${uploadResult.job_id}/validate`, {
        method: 'POST',
      });
      setValidationResult(result);
      nextStep();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  // --- Step 4: Confirm ---
  const handleConfirm = async () => {
    if (!uploadResult) return;
    try {
      await apiFetch(`/imports/${uploadResult.job_id}/confirm`, {
        method: 'POST',
      });
      setStep(5); // Success step
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Confirm failed');
    }
  };

  // --- Render ---
  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="max-w-3xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Import Assets</h1>
          <p className="text-sm text-slate-500 mt-1">Upload CSV or XLSX files to bulk-import assets.</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8">
          {['Upload', 'Map', 'Validate', 'Confirm'].map((label, i) => (
            <React.Fragment key={label}>
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                step > i + 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                step === i + 1 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                'bg-white text-slate-400 border-slate-200'
              )}>
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                  step > i + 1 ? 'bg-emerald-500 text-white' :
                  step === i + 1 ? 'bg-blue-600 text-white' :
                  'bg-slate-200 text-slate-500'
                )}>
                  {step > i + 1 ? '✓' : i + 1}
                </span>
                {label}
              </div>
              {i < 3 && <div className={cn('h-px w-8', step > i + 1 ? 'bg-emerald-200' : 'bg-slate-200')} />}
            </React.Fragment>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <XCircle size={16} />
            </button>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="bg-white border border-slate-200 rounded-xl p-8">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              className={cn(
                'border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer',
                isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              )}
            >
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" id="file-upload" />
              <label htmlFor="file-upload" className="cursor-pointer">
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={40} className="text-blue-500 animate-spin" />
                    <p className="text-sm font-medium text-slate-600">Uploading...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                      <UploadCloud size={28} className="text-blue-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      Drop CSV or XLSX file here, or <span className="text-blue-600">browse</span>
                    </p>
                    <p className="text-xs text-slate-400">Maximum file size: 50 MB</p>
                  </div>
                )}
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Map columns */}
        {step === 2 && uploadResult && (
          <div className="bg-white border border-slate-200 rounded-xl p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Map Columns</h2>
            <p className="text-sm text-slate-500 mb-6">
              File: <span className="font-mono text-slate-700">{uploadResult.filename}</span> — {uploadResult.row_count} rows, {uploadResult.columns.length} columns
            </p>
            <div className="space-y-3">
              {uploadResult.columns.map((col) => (
                <div key={col} className="flex items-center gap-4">
                  <div className="w-48 shrink-0">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <FileSpreadsheet size={14} className="text-slate-400" />
                      <span className="text-sm font-mono text-slate-700 truncate">{col}</span>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-300 shrink-0" />
                  <select
                    value={mappings[col] || ''}
                    onChange={(e) => setMappings(prev => ({ ...prev, [col]: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">— Ignore —</option>
                    {INVERUM_FIELDS.map(f => (
                      <option key={f.id} value={f.id}>{f.label}{f.required ? ' *' : ''}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
              <button onClick={prevStep} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handleMappingSubmit} className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-500">
                Validate <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Validate */}
        {step === 3 && uploadResult && (
          <div className="bg-white border border-slate-200 rounded-xl p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Validate</h2>
            <p className="text-sm text-slate-500 mb-6">Review validation results before importing.</p>
            {validationResult ? (
              <div className="space-y-2">
                {(validationResult as any).records?.map((r: any, i: number) => (
                  <div key={i} className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm',
                    r.status === 'valid' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                    r.status === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                    'bg-red-50 border-red-200 text-red-700'
                  )}>
                    {r.status === 'valid' ? <CheckCircle2 size={16} /> :
                     r.status === 'warning' ? <AlertCircle size={16} /> :
                     <XCircle size={16} />}
                    <span className="font-mono text-xs">{r.tag || r.inventory_number || `Row ${i+1}`}</span>
                    <span className="text-slate-400">—</span>
                    <span>{r.msg || r.message || ''}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <RefreshCcw size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 mb-4">Click validate to check the imported data.</p>
                <button
                  onClick={handleValidate}
                  disabled={validating}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-500 disabled:opacity-50"
                >
                  {validating ? 'Validating...' : 'Run Validation'}
                </button>
              </div>
            )}
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
              <button onClick={prevStep} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
                <ArrowLeft size={14} /> Back
              </button>
              {validationResult && (
                <button onClick={nextStep} className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-500">
                  Review <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="bg-white border border-slate-200 rounded-xl p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Confirm Import</h2>
            <p className="text-sm text-slate-500 mb-6">
              You are about to import {uploadResult?.row_count ?? 0} records. This action cannot be undone.
            </p>
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
              <button onClick={prevStep} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={handleConfirm} className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-500">
                <Database size={14} /> Confirm Import
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Success */}
        {step === 5 && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Import Complete</h2>
            <p className="text-sm text-slate-500 mb-6">
              Successfully imported {uploadResult?.row_count ?? 0} assets.
            </p>
            <button
              onClick={() => { setStep(1); setFile(null); setUploadResult(null); setMappings({}); setValidationResult(null); }}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-500"
            >
              Start New Import
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
