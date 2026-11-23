import React, { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore } from '../../stores/useToastStore';
import { PRIORITIES } from '../../constants/templates';
import type { TaskPriority, ToastVariant } from '../../types';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ src, name = 'User', size = 'sm', className = '' }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  const sizeMap: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
    xs: 'w-6 h-6 text-[11px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
  };

  const displayName = name || 'User';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={displayName}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${sizeMap[size] || sizeMap.sm} rounded-full object-cover shrink-0 border border-[#E6E8F0] dark:border-[#262A3D] ${className}`}
      />
    );
  }

  return (
    <span
      aria-label={displayName}
      className={`${sizeMap[size] || sizeMap.sm} rounded-full shrink-0 inline-flex items-center justify-center font-semibold bg-[#635BFF]/12 text-[#635BFF] dark:bg-[#635BFF]/25 dark:text-[#A5A0FF] select-none ${className}`}
    >
      {initials || 'U'}
    </span>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
}

export function Modal({ open, onClose, title, subtitle, size = 'md', children }: ModalProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widthMap: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0E14]/50 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${widthMap[size] || widthMap.md} max-h-[90vh] flex flex-col bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl shadow-2xl overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#E6E8F0] dark:border-[#262A3D] shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#20212B] dark:text-[#F4F5FA] truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-[#6B7085] hover:text-[#20212B] dark:text-[#9EA3B8] dark:hover:text-white hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 flex-1">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  danger = true,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] leading-relaxed mb-6">
        {description}
      </p>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors whitespace-nowrap"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            void onConfirm();
            onClose();
          }}
          className={`px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors whitespace-nowrap ${
            danger
              ? 'bg-[#EF4444] hover:bg-red-600'
              : 'bg-[#635BFF] hover:bg-[#5249E8]'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl">
      {Icon && (
        <div className="w-11 h-11 rounded-xl bg-[#F7F8FC] dark:bg-[#1C1F2E] border border-[#E6E8F0] dark:border-[#262A3D] flex items-center justify-center text-[#635BFF] mb-4">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <h3 className="text-base font-semibold text-[#20212B] dark:text-[#F4F5FA] mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] max-w-sm mb-5 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-4 py-2 text-sm font-medium text-white bg-[#635BFF] hover:bg-[#5249E8] rounded-lg transition-colors whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function PriorityLabel({ priority = 'medium' }: { priority?: TaskPriority }) {
  const meta = PRIORITIES[priority] || PRIORITIES.medium;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#20212B] dark:text-[#F4F5FA]">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: meta.dot }}
        aria-hidden="true"
      />
      <span>{meta.label}</span>
    </span>
  );
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="h-28 rounded-xl bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] p-5 animate-pulse"
        >
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
          <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      ))}
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();
  if (!toasts.length) return null;

  const iconFor = (variant: ToastVariant) => {
    if (variant === 'success') return <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />;
    if (variant === 'error') return <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />;
    if (variant === 'warning') return <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />;
    return <Info className="w-4 h-4 text-[#635BFF] shrink-0" />;
  };

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] shadow-lg"
        >
          <div className="mt-0.5">{iconFor(t.variant)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#20212B] dark:text-[#F4F5FA]">{t.title}</p>
            {t.message && (
              <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mt-0.5 break-words">
                {t.message}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => removeToast(t.id)}
            aria-label="Dismiss notification"
            className="text-[#9295A5] hover:text-[#20212B] dark:hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
