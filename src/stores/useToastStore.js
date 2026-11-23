import { create } from 'zustand';

let toastCounter = 0;

export const useToastStore = create((set) => ({
  toasts: [],
  addToast: ({ title, message = '', variant = 'info', duration = 3800 }) => {
    const id = `toast_${++toastCounter}`;
    set((state) => ({
      toasts: [...state.toasts.slice(-3), { id, title, message, variant }],
    }));
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
    return id;
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
