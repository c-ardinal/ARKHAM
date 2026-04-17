import { memo, useEffect, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { type Toast, type ToastType, toastStore } from './toast';

export { toast } from './toast';

const iconMap: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const colorMap: Record<ToastType, string> = {
  success: 'border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-500/60',
  error: 'border-destructive/40 bg-destructive/10 text-destructive dark:bg-destructive/20',
  info: 'border-sky-500/40 bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-500/60',
};

const ToastItem = memo(({ toast: item, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) => {
  const Icon = iconMap[item.type];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => onDismiss(item.id), item.duration ?? 3000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [item.id, item.duration, onDismiss]);

  return (
    <div
      role={item.type === 'error' ? 'alert' : 'status'}
      aria-live={item.type === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-200 ${colorMap[item.type]} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="text-sm flex-1 leading-relaxed">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="shrink-0 rounded p-1 opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Close notification"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
});

ToastItem.displayName = 'ToastItem';

export const Toaster = memo(() => {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    return toastStore.subscribe((item) => {
      setItems((prev) => [...prev, item]);
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2rem)]"
      aria-live="polite"
    >
      {items.map((item) => (
        <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
      ))}
    </div>
  );
});

Toaster.displayName = 'Toaster';
