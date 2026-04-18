export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

type Listener = (toast: Toast) => void;

class ToastStore {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  push(type: ToastType, message: string, duration = 4000): void {
    const toast: Toast = {
      id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      message,
      duration,
    };
    this.listeners.forEach((listener) => listener(toast));
  }
}

export const toastStore = new ToastStore();

export const toast = {
  success: (message: string, duration?: number) => toastStore.push('success', message, duration),
  error: (message: string, duration?: number) => toastStore.push('error', message, duration),
  info: (message: string, duration?: number) => toastStore.push('info', message, duration),
};
