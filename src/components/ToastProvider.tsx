"use client";
import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface Toast { id: string; message: string; type?: 'info'|'success'|'error'; ttl?: number; }
interface ToastContextValue { toasts: Toast[]; push: (t: Omit<Toast,'id'>) => void; remove: (id: string)=>void; }

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => setToasts(ts => ts.filter(t => t.id !== id)), []);
  const push = useCallback((t: Omit<Toast,'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, ttl: 4000, ...t };
    setToasts(ts => [...ts, toast]);
    if (toast.ttl) setTimeout(()=> remove(id), toast.ttl);
  }, [remove]);

  return (
    <ToastContext.Provider value={{ toasts, push, remove }}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 text-sm rounded shadow border backdrop-blur bg-neutral-900/80 border-neutral-700 flex items-center gap-3 animate-fade-in-up ${t.type==='error'?'text-red-400':'text-neutral-200'}`}>
            <span>{t.message}</span>
            <button onClick={()=>remove(t.id)} className="text-xs text-neutral-500 hover:text-neutral-300">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
