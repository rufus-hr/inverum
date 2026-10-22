import React from 'react';
import { cn } from '../../lib/utils';
import { SearchX } from 'lucide-react';
import Button from './Button';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  cell: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onClearFilters?: () => void;
  selectedIds?: Set<string>;
  onSelectAll?: () => void;
  onSelectRow?: (id: string) => void;
  getRowId?: (row: T) => string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'No items found',
  emptyDescription = "We couldn't find any items matching your current filters.",
  onClearFilters,
  selectedIds,
  onSelectAll,
  onSelectRow,
  getRowId,
  className,
}: DataTableProps<T>) {
  const showSelection = selectedIds !== undefined && onSelectRow !== undefined;
  const allSelected = data.length > 0 && data.every((row) => selectedIds?.has(keyExtractor(row)));

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden', className)}>
        <div className="p-8 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/6" />
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-4 bg-slate-200 rounded w-1/6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden', className)}>
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-4 border border-slate-100">
            <SearchX size={32} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">{emptyTitle}</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-sm text-center">{emptyDescription}</p>
          {onClearFilters && (
            <Button variant="secondary" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden', className)}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-200 bg-slate-100">
            {showSelection && (
              <th className="w-12 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                  checked={allSelected}
                  onChange={onSelectAll}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap',
                  col.align === 'center' && 'text-center',
                  col.align === 'right' && 'text-right',
                  col.width
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row) => {
            const rowId = getRowId ? getRowId(row) : keyExtractor(row);
            const isSelected = selectedIds?.has(rowId);

            return (
              <tr
                key={keyExtractor(row)}
                className={cn(
                  'group transition-all duration-200 hover:shadow-md hover:bg-slate-50',
                  isSelected && 'bg-blue-50/30'
                )}
              >
                {showSelection && (
                  <td className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                      checked={isSelected}
                      onChange={() => onSelectRow?.(rowId)}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-sm text-slate-700 whitespace-nowrap',
                      col.align === 'center' && 'text-center',
                      col.align === 'right' && 'text-right'
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
