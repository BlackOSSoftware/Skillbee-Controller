import { Star } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { ReviewSort, ReviewStatus, ReviewStudent } from '@/types/reviews';

const STATUS: Record<ReviewStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pending', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export const reviewStatusLabel = (s: ReviewStatus) => STATUS[s].label;

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

export const SORT_LABEL: Record<ReviewSort, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  highest: 'Highest rating',
  lowest: 'Lowest rating',
};

/** Read-only star rating; `value` may be fractional for averages. */
export function Stars({ value, size = 'sm', className }: { value: number; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const px = size === 'lg' ? 'size-5' : size === 'md' ? 'size-4' : 'size-3.5';
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} role="img" aria-label={`${Number.isInteger(value) ? value : value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className={cn('relative inline-block', px)} aria-hidden>
            <Star className={cn('absolute inset-0 text-line', px)} strokeWidth={1.5} />
            {fill > 0 ? (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={cn('fill-amber-400 text-amber-400 dark:fill-amber-300 dark:text-amber-300', px)} strokeWidth={1.5} />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

export function studentName(s: ReviewStudent | null) {
  if (!s) return 'Deleted learner';
  return [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email;
}

const AVATAR_TONES = [
  'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  'bg-teal-500/12 text-teal-700 dark:text-teal-300',
  'bg-amber-500/12 text-amber-700 dark:text-amber-300',
  'bg-rose-500/12 text-rose-700 dark:text-rose-300',
];

export function LearnerAvatar({ student, size = 'sm' }: { student: ReviewStudent | null; size?: 'sm' | 'md' }) {
  const name = studentName(student);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  const tone = AVATAR_TONES[(student?.id ?? name).split('').reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold', size === 'md' ? 'size-11 text-sm' : 'size-8 text-[11px]', tone)} aria-hidden>
      {initials || '?'}
    </span>
  );
}
