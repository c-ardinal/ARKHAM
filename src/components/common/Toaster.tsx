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
  success: 'border-emerald-500 bg-emerald-500 text-white dark:bg-emerald-600 dark:border-emerald-500',
  error: 'border-destructive bg-destructive text-destructive-foreground',
  info: 'border-sky-500 bg-sky-500 text-white dark:bg-sky-600 dark:border-sky-500',
};

const ToastItem = memo(({ toast: item, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) => {
  const Icon = iconMap[item.type];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      onDismiss(item.id);
    }, item.duration ?? 4000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [item.id, item.duration, onDismiss]);

  return (
    <div
      role={item.type === 'error' ? 'alert' : 'status'}
      aria-live={item.type === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border-2 px-4 py-3 shadow-2xl transition-all duration-300 ${colorMap[item.type]} ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'
      }`}
    >
      <Icon size={20} className="mt-0.5 shrink-0" aria-hidden="true" strokeWidth={2.5} />
      <span className="text-sm font-medium flex-1 leading-relaxed">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="shrink-0 rounded p-1 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 transition-opacity"
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
      className="pointer-events-none fixed top-20 right-6 z-[200] flex flex-col gap-3 w-[360px] max-w-[calc(100vw-2rem)]"
      aria-live="polite"
    >
      {items.map((item) => (
        <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
      ))}
    </div>
  );
});

Toaster.displayName = 'Toaster';
