/**
 * Status badge style utilities.
 * SINGLE SOURCE OF TRUTH for status colors.
 * Never hardcode status colors inline — always use these functions.
 */

export type StatusVariant =
  | 'active'
  | 'success'
  | 'warning'
  | 'pending'
  | 'error'
  | 'failed'
  | 'info'
  | 'in_progress'
  | 'neutral'
  | 'default'
  | 'indigo'
  | 'checklist';

const STATUS_STYLES: Record<StatusVariant, string> = {
  active:
    'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
  success:
    'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
  warning:
    'bg-amber-50 text-amber-700 border border-amber-200/50',
  pending:
    'bg-amber-50 text-amber-700 border border-amber-200/50',
  error:
    'bg-red-50 text-red-700 border border-red-200/50',
  failed:
    'bg-red-50 text-red-700 border border-red-200/50',
  info:
    'bg-blue-50 text-blue-700 border border-blue-200/50',
  in_progress:
    'bg-blue-50 text-blue-700 border border-blue-200/50',
  neutral:
    'bg-slate-100 text-slate-700 border border-slate-200/50',
  default:
    'bg-slate-100 text-slate-700 border border-slate-200/50',
  indigo:
    'bg-indigo-50 text-indigo-700 border border-indigo-200/50',
  checklist:
    'bg-indigo-50 text-indigo-700 border border-indigo-200/50',
};

/**
 * Get Tailwind classes for a status badge.
 * @example
 * <span className={cn("inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider", getStatusBadgeClass("active"))}>
 *   Active
 * </span>
 */
export function getStatusBadgeClass(status: StatusVariant | string): string {
  const key = status.toLowerCase().replace(/\s+/g, '_') as StatusVariant;
  return STATUS_STYLES[key] ?? STATUS_STYLES.default;
}

/**
 * Get ONLY the background color class for a status.
 * Useful for status lines, dots, etc.
 */
export function getStatusBgClass(status: StatusVariant | string): string {
  const map: Record<string, string> = {
    active: 'bg-emerald-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    pending: 'bg-amber-500',
    error: 'bg-red-500',
    failed: 'bg-red-500',
    info: 'bg-blue-500',
    in_progress: 'bg-blue-500',
    neutral: 'bg-slate-400',
    default: 'bg-slate-400',
    indigo: 'bg-indigo-500',
    checklist: 'bg-indigo-500',
  };
  const key = status.toLowerCase().replace(/\s+/g, '_');
  return map[key] ?? map.default;
}

/**
 * Map frontend asset status strings to status variants.
 */
export function assetStatusToVariant(
  status: string
): StatusVariant {
  const map: Record<string, StatusVariant> = {
    Active: 'active',
    'In Repair': 'warning',
    Storage: 'neutral',
    'Pending Checklist': 'checklist',
  };
  return map[status] ?? 'neutral';
}
