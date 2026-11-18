import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  X,
  XCircle,
} from 'lucide-react';
import { FeedbackState } from '../types/yasinan';

interface FeedbackBannerProps {
  feedback: FeedbackState | null;
  onDismiss: () => void;
}

export function FeedbackBanner({ feedback, onDismiss }: FeedbackBannerProps) {
  if (!feedback) return null;

  const isSuccess = feedback.type === 'success';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-medium border ${
        isSuccess
          ? 'bg-[#FFFFFF] border-[#16A34A]/30 text-[#14532D] shadow-[0_1px_3px_rgba(20,83,45,0.06)]'
          : 'bg-[#FEF2F2] border-[#DC2626]/30 text-[#991B1B]'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {isSuccess ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" aria-hidden="true" />
        ) : (
          <XCircle className="h-4 w-4 shrink-0 text-[#DC2626]" aria-hidden="true" />
        )}
        <span className="truncate">{feedback.message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Tutup pemberitahuan"
        className="p-1 rounded-lg hover:bg-black/5 transition-colors shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns, rows = 5 }: TableSkeletonProps) {
  return (
    <div className="w-full overflow-x-auto" aria-busy="true" aria-label="Memuat data">
      <div className="divide-y divide-[#DCFCE7]">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="grid gap-4 px-5 py-3.5 items-center"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, colIdx) => (
              <div
                key={colIdx}
                className="h-4 rounded bg-[#DCFCE7]/80 animate-pulse"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#F0FDF4] text-[#15803D] mb-3">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-base font-semibold text-[#14532D]">{title}</p>
      <p className="text-sm text-[#15803D] mt-1 max-w-md">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface StatusTextProps {
  variant: 'positive' | 'warning' | 'neutral';
  label: string;
}

export function StatusText({ variant, label }: StatusTextProps) {
  if (variant === 'positive') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D] whitespace-nowrap">
        <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A] shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  if (variant === 'warning') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FEF9C3] text-xs font-semibold text-[#854D0E] whitespace-nowrap">
        <AlertTriangle className="h-3.5 w-3.5 text-[#CA8A04] shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#14532D]/70 whitespace-nowrap">
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
