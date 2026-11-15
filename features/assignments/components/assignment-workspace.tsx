'use client';

import { Archive, FilePen, Inbox, Lock, Megaphone, Pencil, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import { SUBMISSION_STATUSES, type Assignment, type AssignmentStatus, type Submission, type SubmissionListParams, type SubmissionStatus } from '@/types/assignments';
import { Initials } from '@/features/enrollments/display';
import { assignmentPolicy, useAssignmentDetail, useAssignmentStatus, useCourseLearners, useDeleteAssignment, useSubmissions } from '../hooks';
import { AssignmentStatusBadge, assignmentStatusLabel, DueDate, formatBytes, formatDateTime, NEEDS_REVIEW, SubmissionStatusBadge, submissionStatusLabel, submissionTypeLabel } from '../display';
import { AssignmentFormDialog } from './assignment-form-dialog';
import { SubmissionReviewDrawer } from './submission-review-drawer';

const PAGE_SIZES = [10, 20, 50];

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  );
}

const STATUS_TOAST: Record<AssignmentStatus, string> = {
  published: 'Assignment published',
  closed: 'Submissions closed',
  archived: 'Assignment archived',
  draft: 'Moved to draft',
};

type StatusAction = { status: AssignmentStatus; label: string; icon: typeof Megaphone; confirm?: string; tone?: 'danger' };

/** Transitions offered per status; the backend accepts any status, these are the sensible ones. */
function statusActions(status: AssignmentStatus): StatusAction[] {
  const archive: StatusAction = { status: 'archived', label: 'Archive', icon: Archive, confirm: 'Archived assignments are hidden from learners. Submissions and grades are kept.', tone: 'danger' };
  if (status === 'draft') return [{ status: 'published', label: 'Publish', icon: Megaphone }, archive];
  if (status === 'published')
    return [{ status: 'closed', label: 'Close submissions', icon: Lock, confirm: 'Learners will no longer be able to submit. You can reopen it later.' }, { status: 'draft', label: 'Move to draft', icon: FilePen, confirm: 'Learners will no longer see this assignment until it is published again.' }, archive];
  if (status === 'closed') return [{ status: 'published', label: 'Reopen', icon: Megaphone }, archive];
  return [{ status: 'draft', label: 'Restore to draft', icon: RotateCcw }];
}

interface AssignmentWorkspaceProps {
  assignment: Assignment;
  courseTitle?: string;
  onClose: () => void;
}

export function AssignmentWorkspace({ assignment: seed, courseTitle, onClose }: AssignmentWorkspaceProps) {
  const { user } = useAuth();
  const toast = useToast();
  const canRead = assignmentPolicy.canReadSubmissions(user);
  const canUpdate = assignmentPolicy.canUpdate(user);
  const canStatus = assignmentPolicy.canChangeStatus(user);
  const canDelete = assignmentPolicy.canDelete(user);
  const detail = useAssignmentDetail(seed.id, seed);
  const a = detail.data ?? seed;
  const changeStatus = useAssignmentStatus();
  const remove = useDeleteAssignment();
  const [editing, setEditing] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<StatusAction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  function applyStatus(action: StatusAction) {
    changeStatus.mutate(
      { id: a.id, status: action.status },
      {
        onSuccess: (updated) => {
          setPendingStatus(null);
          toast.success(STATUS_TOAST[updated.status] ?? `Status: ${assignmentStatusLabel(updated.status)}`, updated.title);
        },
        onError: (error) => {
          setPendingStatus(null);
          toast.error('Could not change status', normalizeApiError(error).message);
        },
      }
    );
  }

  function deleteAssignment() {
    remove.mutate(a.id, {
      onSuccess: (removed) => {
        toast.success('Assignment deleted', removed.status === 'archived' ? 'It had submissions, so it was archived first. Submissions are preserved.' : removed.title);
        onClose();
      },
      onError: (error) => {
        setConfirmDelete(false);
        toast.error('Could not delete assignment', normalizeApiError(error).message);
      },
    });
  }

  const actions = canStatus ? statusActions(a.status) : [];
  const busy = changeStatus.isPending || remove.isPending;
  const toolbar =
    canUpdate || actions.length || canDelete ? (
      <div className="flex flex-wrap items-center gap-2">
        <AssignmentStatusBadge status={a.status} />
        {detail.isFetching && !detail.isPlaceholderData ? <span className="text-[11px] text-ink-subtle">Refreshing…</span> : null}
        {detail.isError ? <span className="text-[11px] text-danger">Could not refresh details</span> : null}
        <span className="flex-1" />
        {canUpdate ? (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)} disabled={busy}>
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </Button>
        ) : null}
        {actions.map((action) => (
          <Button
            key={action.status}
            size="sm"
            variant={action.status === 'published' ? 'primary' : action.tone === 'danger' ? 'danger' : 'secondary'}
            onClick={() => (action.confirm ? setPendingStatus(action) : applyStatus(action))}
            loading={changeStatus.isPending && changeStatus.variables?.status === action.status}
            disabled={busy}
          >
            <action.icon className="size-3.5" aria-hidden />
            {action.label}
          </Button>
        ))}
        {canDelete ? (
          <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setConfirmDelete(true)} disabled={busy} aria-label="Delete assignment">
            <Trash2 className="size-3.5" aria-hidden />
            Delete
          </Button>
        ) : null}
      </div>
    ) : undefined;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SubmissionStatus | ''>('');
  const [late, setLate] = useState<'' | 'true' | 'false'>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [reviewing, setReviewing] = useState<Submission | null>(null);
  const debounced = useDebouncedValue(search.trim(), 400);

  const params: SubmissionListParams = {
    page,
    limit,
    search: debounced || undefined,
    status: status || undefined,
    isLate: late ? late === 'true' : undefined,
    sortOrder,
  };
  const submissions = useSubmissions(a.id, params, canRead);
  const learners = useCourseLearners(a.courseId, canRead);
  const rows = submissions.data?.submissions ?? [];
  const filtersActive = Boolean(search || status || late);
  const current = reviewing ? (rows.find((r) => r.id === reviewing.id) ? { ...reviewing, ...rows.find((r) => r.id === reviewing.id) } : reviewing) : null;

  return (
    <>
      <Dialog open onClose={onClose} busy={busy} size="full" title={a.title} description={courseTitle ?? 'Assignment'} toolbar={toolbar}>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
            <div className="rounded-lg border border-line p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Assignment</p>
                <AssignmentStatusBadge status={a.status} />
              </div>
              <dl className="divide-y divide-line">
                <Fact label="Due">
                  <DueDate value={a.dueDate} status={a.status} />
                </Fact>
                <Fact label="Maximum marks">{formatNumber(a.maximumMarks)}</Fact>
                <Fact label="Submission">{submissionTypeLabel(a.submissionType)}</Fact>
                {a.submissionType !== 'text' ? (
                  <>
                    <Fact label="File types">{a.allowedFileTypes.join(', ') || 'Any'}</Fact>
                    <Fact label="Max file size">{formatBytes(a.maximumFileSizeBytes)}</Fact>
                  </>
                ) : null}
                <Fact label="Late submissions">{a.allowLateSubmission ? 'Allowed' : 'Not allowed'}</Fact>
                <Fact label="Resubmission">{a.allowResubmission ? `Allowed · up to ${a.maxSubmissions}` : 'Not allowed'}</Fact>
                <Fact label="Published">{formatDateTime(a.publishedAt)}</Fact>
              </dl>
            </div>
            <div className="rounded-lg border border-line p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Instructions</p>
              <p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-ink">{a.instructions}</p>
            </div>
          </aside>

          <section className="min-w-0 rounded-lg border border-line" aria-label="Submissions">
            <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Submissions</h3>
                  <p className="text-xs text-ink-muted">{submissions.data ? `${formatNumber(submissions.data.pagination.total)} ${filtersActive ? 'matching' : 'total'}` : ' '}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 md:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search learner name or email"
                    className="pl-9"
                    aria-label="Search submissions"
                    disabled={!canRead}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value as SubmissionStatus | '');
                      setPage(1);
                    }}
                    className="sm:w-40"
                    aria-label="Filter submissions by status"
                    disabled={!canRead}
                  >
                    <option value="">All statuses</option>
                    {SUBMISSION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {submissionStatusLabel(s)}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={late}
                    onChange={(e) => {
                      setLate(e.target.value as '' | 'true' | 'false');
                      setPage(1);
                    }}
                    className="sm:w-32"
                    aria-label="Filter by timing"
                    disabled={!canRead}
                  >
                    <option value="">Any timing</option>
                    <option value="false">On time</option>
                    <option value="true">Late</option>
                  </Select>
                  <Select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')} className="sm:w-36" aria-label="Sort submissions" disabled={!canRead}>
                    <option value="desc">Newest first</option>
                    <option value="asc">Oldest first</option>
                  </Select>
                  {filtersActive ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSearch('');
                        setStatus('');
                        setLate('');
                        setPage(1);
                      }}
                    >
                      <X className="size-4" aria-hidden />
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            {!canRead ? (
              <EmptyState title="No access to submissions" description="Reviewing submissions needs the assignments.submissions.read permission." />
            ) : submissions.isError ? (
              <ErrorState error={submissions.error} onRetry={() => submissions.refetch()} />
            ) : !submissions.isPending && rows.length === 0 ? (
              <EmptyState
                icon={<Inbox className="size-5" aria-hidden />}
                title={filtersActive ? 'No submissions match these filters' : 'No submissions yet'}
                description={filtersActive ? 'Try a different search or filter.' : a.status === 'published' ? 'Learner submissions will appear here.' : 'Learners can submit once the assignment is published.'}
              />
            ) : (
              <ul className={cn('divide-y divide-line', submissions.isPlaceholderData && 'opacity-60')}>
                {submissions.isPending
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <li key={i} className="flex items-center gap-3 px-4 py-3">
                        <Skeleton className="size-8 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-56" />
                        </div>
                        <Skeleton className="h-5 w-20" />
                      </li>
                    ))
                  : rows.map((s) => {
                      const learner = learners.byId.get(s.studentId);
                      const needsReview = NEEDS_REVIEW.includes(s.submissionStatus);
                      return (
                        <li key={s.id}>
                          <button type="button" onClick={() => setReviewing(s)} className="group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-2/60 sm:px-4">
                            <Initials firstName={learner?.name.split(' ')[0]} lastName={learner?.name.split(' ').slice(1).join(' ')} email={learner?.email} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium text-ink group-hover:text-primary">
                                  {learner?.name ?? (learners.isPending ? 'Loading…' : `Student ${s.studentId.slice(-6)}`)}
                                </span>
                                {s.isLate ? <span className="shrink-0 text-[11px] font-medium text-danger">Late</span> : null}
                              </span>
                              <span className="block truncate text-xs text-ink-muted">
                                {formatDateTime(s.submittedAt)} · attempt {s.version}
                                {s.attachments.length ? ` · ${s.attachments.length} file${s.attachments.length === 1 ? '' : 's'}` : ''}
                              </span>
                            </span>
                            <span className="hidden w-20 shrink-0 text-right text-sm tabular-nums sm:block">
                              {s.marksAwarded !== null && s.marksAwarded !== undefined ? (
                                <>
                                  <span className="font-semibold text-ink">{s.marksAwarded}</span>
                                  <span className="text-ink-subtle">/{a.maximumMarks}</span>
                                </>
                              ) : (
                                <span className="text-ink-subtle">—</span>
                              )}
                            </span>
                            <span className="flex w-32 shrink-0 justify-end">
                              <SubmissionStatusBadge status={s.submissionStatus} />
                            </span>
                            {needsReview ? <span className="sr-only">Needs review</span> : null}
                          </button>
                        </li>
                      );
                    })}
              </ul>
            )}
            {canRead ? (
              <Pagination
                meta={submissions.data?.pagination}
                onPageChange={setPage}
                disabled={submissions.isFetching}
                pageSizeOptions={PAGE_SIZES}
                onPageSizeChange={(size) => {
                  setLimit(size);
                  setPage(1);
                }}
              />
            ) : null}
          </section>
        </div>
      </Dialog>

      {current ? (
        <SubmissionReviewDrawer
          key={`${current.id}-${current.updatedAt}`}
          assignment={a}
          submission={current}
          learner={learners.byId.get(current.studentId)}
          onClose={() => setReviewing(null)}
          onUpdated={(updated) => setReviewing({ ...current, ...updated })}
          showHistory={historyOpen}
          onShowHistoryChange={setHistoryOpen}
        />
      ) : null}

      {editing ? <AssignmentFormDialog mode="edit" assignment={a} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} /> : null}

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title={`${pendingStatus?.label ?? ''}?`}
        confirmLabel={pendingStatus?.label ?? 'Confirm'}
        tone={pendingStatus?.tone === 'danger' ? 'danger' : 'primary'}
        loading={changeStatus.isPending}
        onCancel={() => setPendingStatus(null)}
        onConfirm={() => pendingStatus && applyStatus(pendingStatus)}
        description={<p>{pendingStatus?.confirm}</p>}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this assignment?"
        confirmLabel="Delete assignment"
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={deleteAssignment}
        description={
          <p>
            “{a.title}” is removed from the console and from learners. Existing submissions and grades are preserved; an assignment that has submissions is archived
            before it is removed.
          </p>
        }
      />
    </>
  );
}
