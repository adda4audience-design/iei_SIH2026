'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
}

const ToastContext = React.createContext<{
  toasts: ToastProps[];
  toast: (props: Omit<ToastProps, 'id'>) => void;
  dismiss: (id: string) => void;
}>({ toasts: [], toast: () => {}, dismiss: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const toast = React.useCallback((props: Omit<ToastProps, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...props, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastContext);
}

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'rounded-lg shadow-lg p-4 text-sm flex items-start justify-between gap-2 transition-all',
            t.variant === 'destructive' ? 'bg-red-600 text-white' :
            t.variant === 'success' ? 'bg-green-600 text-white' :
            'bg-gray-900 text-white'
          )}
        >
          <div>
            {t.title && <div className="font-semibold">{t.title}</div>}
            {t.description && <div className="mt-0.5 opacity-90">{t.description}</div>}
          </div>
          <button onClick={() => dismiss(t.id)} className="opacity-70 hover:opacity-100 shrink-0">✕</button>
        </div>
      ))}
    </div>
  );
}
