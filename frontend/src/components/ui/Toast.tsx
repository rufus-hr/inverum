import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Toast as ToastType } from '../../hooks/useToast';

interface ToastProps {
  toast: ToastType;
  onRemove: (id: string) => void;
}

const variantConfig = {
  success: {
    icon: CheckCircle2,
    classes: 'bg-white border-l-4 border-l-emerald-500 text-slate-900',
    iconClass: 'text-emerald-500',
    progressClass: 'bg-emerald-500',
  },
  error: {
    icon: XCircle,
    classes: 'bg-white border-l-4 border-l-red-500 text-slate-900',
    iconClass: 'text-red-500',
    progressClass: 'bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'bg-white border-l-4 border-l-amber-500 text-slate-900',
    iconClass: 'text-amber-500',
    progressClass: 'bg-amber-500',
  },
  info: {
    icon: Info,
    classes: 'bg-white border-l-4 border-l-blue-500 text-slate-900',
    iconClass: 'text-blue-500',
    progressClass: 'bg-blue-500',
  },
};

export const Toast = React.memo(function Toast({ toast, onRemove }: ToastProps) {
  const [progress, setProgress] = useState(100);
  const [isExiting, setIsExiting] = useState(false);
  const duration = toast.duration ?? 5000;

  const config = variantConfig[toast.variant];
  const Icon = config.icon;

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration]);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      className={cn(
        'relative w-80 rounded-lg shadow-lg overflow-hidden transition-all duration-300',
        isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0',
        config.classes
      )}
      role="alert"
    >
      <div className="flex items-start gap-3 p-4">
        <Icon size={20} className={cn('shrink-0 mt-0.5', config.iconClass)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.message && (
            <p className="text-xs text-slate-500 mt-1">{toast.message}</p>
          )}
        </div>
        <button
          onClick={handleRemove}
          className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
      <div className="h-0.5 w-full bg-slate-100">
        <div
          className={cn('h-full transition-all duration-100 ease-linear', config.progressClass)}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
});

export default Toast;
