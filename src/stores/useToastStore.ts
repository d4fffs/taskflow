import { create } from 'zustand';
import type { ToastItem, ToastVariant } from '../types';

let toastCounter = 0;

export interface AddToastInput {
  title: string;
  message?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (input: AddToastInput) => string;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
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
