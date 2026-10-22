import { useState, useCallback, useRef, useEffect } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

let toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const add = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${++toastIdCounter}`;
    const newToast: Toast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    const duration = toast.duration ?? 5000;
    const timer = window.setTimeout(() => {
      remove(id);
    }, duration);

    timersRef.current.set(id, timer);

    return id;
  }, [remove]);

  const success = useCallback((title: string, message?: string) => {
    return add({ variant: 'success', title, message });
  }, [add]);

  const error = useCallback((title: string, message?: string) => {
    return add({ variant: 'error', title, message, duration: 8000 });
  }, [add]);

  const warning = useCallback((title: string, message?: string) => {
    return add({ variant: 'warning', title, message });
  }, [add]);

  const info = useCallback((title: string, message?: string) => {
    return add({ variant: 'info', title, message });
  }, [add]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return { toasts, add, remove, success, error, warning, info };
}
