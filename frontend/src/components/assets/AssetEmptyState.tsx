import React from 'react';
import { SearchX } from 'lucide-react';

interface AssetEmptyStateProps {
  onClear: () => void;
}

export function AssetEmptyState({ onClear }: AssetEmptyStateProps) {
  return (
    <tr>
      <td colSpan={20} className="px-4 py-20 text-center">
        <div className="flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-4 border border-slate-100">
            <SearchX size={32} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No assets found</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-sm">
            We couldn't find any assets matching your current filters. Try adjusting your search or clearing the filters.
          </p>
          <button
            onClick={onClear}
            className="px-4 py-2 bg-blue-50 text-blue-600 font-medium rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
          >
            Clear all filters
          </button>
        </div>
      </td>
    </tr>
  );
}
