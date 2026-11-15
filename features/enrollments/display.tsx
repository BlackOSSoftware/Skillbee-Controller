import { cn } from '@/lib/cn';
import type { CompletionStatus, EnrollmentStatus, EnrollmentType } from '@/types/enrollments';

const STATUS_STYLE: Record<EnrollmentStatus, { label: string; dot: string; text: string }> = {
  active: { label: 'Active', dot: 'bg-success', text: 'text-success' },
  pending: { label: 'Pending', dot: 'bg-warning', text: 'text-warning' },
  completed: { label: 'Completed', dot: 'bg-info', text: 'text-info' },
  expired: { label: 'Expired', dot: 'bg-ink-subtle', text: 'text-ink-muted' },
  revoked: { label: 'Revoked', dot: 'bg-danger', text: 'text-danger' },
  suspended: { label: 'Suspended', dot: 'bg-warning', text: 'text-warning' },
  cancelled: { label: 'Cancelled', dot: 'bg-ink-subtle', text: 'text-ink-muted' },
};

export function statusLabel(status: EnrollmentStatus): string {
  return STATUS_STYLE[status]?.label ?? status;
}

/** Dot + label; restrained so long tables stay calm. */
export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.expired;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium', s.text)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}

const TYPE_LABELS: Record<EnrollmentType, string> = {
  purchase: 'Purchase',
  manual: 'Manual',
  free: 'Free',
  admin_granted: 'Admin granted',
  migration: 'Migration',
};

export function typeLabel(type: EnrollmentType): string {
  return TYPE_LABELS[type] ?? type;
}

const COMPLETION_LABELS: Record<CompletionStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  requirements_pending: 'Requirements pending',
  completed: 'Completed',
};

export function completionLabel(status: CompletionStatus): string {
  return COMPLETION_LABELS[status] ?? status;
}

export function ProgressBar({ value, size = 'sm', className }: { value: number; size?: 'sm' | 'md'; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('overflow-hidden rounded-full bg-surface-2', size === 'md' ? 'h-2' : 'h-1.5', className)}
    >
      <div className={cn('h-full rounded-full', pct === 100 ? 'bg-success' : 'bg-primary')} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Initials({ firstName, lastName, email, size = 'md' }: { firstName?: string; lastName?: string; email?: string; size?: 'md' | 'lg' }) {
  const letters = [firstName, lastName]
    .filter(Boolean)
    .map((p) => (p as string)[0])
    .join('') || (email?.[0] ?? '?');
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 font-semibold text-ink-muted',
        size === 'lg' ? 'size-12 text-sm' : 'size-8 text-[11px]'
      )}
      aria-hidden
    >
      {letters.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** Statuses an admin can set from the console; `cancelled` is a legacy alias and is not offered. */
export const STATUS_OPTIONS: Array<{ status: EnrollmentStatus; label: string; help: string; tone: 'primary' | 'danger' }> = [
  { status: 'active', label: 'Active', help: 'Learner can access the course.', tone: 'primary' },
  { status: 'pending', label: 'Pending', help: 'Waiting for confirmation; no learning access yet.', tone: 'primary' },
  { status: 'completed', label: 'Completed', help: 'Marks the enrollment as finished; the learner keeps access.', tone: 'primary' },
  { status: 'suspended', label: 'Suspended', help: 'Temporarily blocks access. Can be reactivated.', tone: 'danger' },
  { status: 'expired', label: 'Expired', help: 'Access period ended; the learner loses access.', tone: 'danger' },
  { status: 'revoked', label: 'Revoked', help: 'Removes access. Progress history is preserved.', tone: 'danger' },
];
