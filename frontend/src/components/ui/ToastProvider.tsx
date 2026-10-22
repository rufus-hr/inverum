import React from 'react';
import { Toast } from './Toast';
import type { Toast as ToastType } from '../../hooks/useToast';

interface ToastProviderProps {
  toasts: ToastType[];
  onRemove: (id: string) => void;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
};

export default ToastProvider;
