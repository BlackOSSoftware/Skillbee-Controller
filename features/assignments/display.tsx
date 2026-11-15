import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import type { AssignmentStatus, SubmissionStatus, SubmissionType } from '@/types/assignments';

function Pill({ label, dot, text }: { label: string; dot: string; text: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium', text)}>
      <span className={cn('size-1.5 rounded-full', dot)} aria-hidden />
      {label}
    </span>
  );
}

const ASSIGNMENT_STYLE: Record<AssignmentStatus, { label: string; dot: string; text: string }> = {
  draft: { label: 'Draft', dot: 'bg-warning', text: 'text-warning' },
  published: { label: 'Published', dot: 'bg-success', text: 'text-success' },
  closed: { label: 'Closed', dot: 'bg-ink-subtle', text: 'text-ink-muted' },
  archived: { label: 'Archived', dot: 'bg-ink-subtle', text: 'text-ink-subtle' },
};

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return <Pill {...(ASSIGNMENT_STYLE[status] ?? ASSIGNMENT_STYLE.draft)} />;
}

export function assignmentStatusLabel(status: AssignmentStatus): string {
  return ASSIGNMENT_STYLE[status]?.label ?? status;
}

const SUBMISSION_STYLE: Record<SubmissionStatus, { label: string; dot: string; text: string }> = {
  submitted: { label: 'Awaiting review', dot: 'bg-warning', text: 'text-warning' },
  under_review: { label: 'Under review', dot: 'bg-info', text: 'text-info' },
  resubmitted: { label: 'Resubmitted', dot: 'bg-warning', text: 'text-warning' },
  evaluated: { label: 'Graded', dot: 'bg-success', text: 'text-success' },
  returned: { label: 'Returned', dot: 'bg-primary', text: 'text-primary' },
};

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return <Pill {...(SUBMISSION_STYLE[status] ?? SUBMISSION_STYLE.submitted)} />;
}

export function submissionStatusLabel(status: SubmissionStatus): string {
  return SUBMISSION_STYLE[status]?.label ?? status;
}

/** Statuses the backend accepts for grading (`gradeSubmission`). */
export const GRADABLE: SubmissionStatus[] = ['submitted', 'under_review', 'resubmitted', 'evaluated', 'returned'];

export const NEEDS_REVIEW: SubmissionStatus[] = ['submitted', 'under_review', 'resubmitted'];

const TYPE_LABELS: Record<SubmissionType, string> = { file_upload: 'File upload', text: 'Text', file_and_text: 'File + text' };

export function submissionTypeLabel(type: SubmissionType): string {
  return TYPE_LABELS[type] ?? type;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return `${formatDate(value)}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Due-date line with an overdue / due-soon hint for published assignments. */
export function DueDate({ value, status }: { value: string | null; status: AssignmentStatus }) {
  if (!value) return <span className="text-ink-subtle">No due date</span>;
  const due = new Date(value).getTime();
  const now = new Date().getTime();
  const open = status === 'published';
  const overdue = open && due < now;
  const soon = open && !overdue && due - now < 3 * 24 * 60 * 60 * 1000;
  return (
    <span className="whitespace-nowrap">
      <span className="text-ink">{formatDate(value)}</span>
      {overdue ? <span className="ml-1.5 text-[11px] font-medium text-danger">Past due</span> : soon ? <span className="ml-1.5 text-[11px] font-medium text-warning">Due soon</span> : null}
    </span>
  );
}
