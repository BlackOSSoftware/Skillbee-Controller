'use client';

import { BookOpen, Check, Clock3, Mail, ShieldCheck, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/cn';
import { hasPermissions } from '@/lib/roles';
import type { AdminReview, ModerationEvent } from '@/types/reviews';
import { formatDateTime } from '@/features/assignments/display';
import { useUserNames } from '@/features/shared/lookups';
import { LearnerAvatar, reviewStatusLabel, ReviewStatusBadge, Stars, studentName } from '../display';
import { useReview } from '../hooks';
import { DeleteReviewDialog, RejectReviewDialog, useApproveReview } from './review-actions';

const HISTORY_LABEL: Record<ModerationEvent['action'], string> = {
  submitted: 'Submitted by the learner',
  edited: 'Edited by the learner',
  approved: 'Approved',
  rejected: 'Rejected',
  deleted: 'Deleted',
  status_changed: 'Status changed',
};

const RATING_WORD = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

export function ReviewDrawer({ seed, onClose }: { seed: AdminReview; onClose: () => void }) {
  const { user } = useAuth();
  const detail = useReview(seed.id, seed);
  const r = detail.data;
  const history = r?.moderationHistory ?? [];
  const names = useUserNames(history.map((h) => h.actorId), hasPermissions(user, ['users:read']));
  const { approve, isPending: approving } = useApproveReview();
  const [dialog, setDialog] = useState<'reject' | 'delete' | null>(null);
  const lastModeration = [...history].reverse().find((h) => h.action === 'approved' || h.action === 'rejected');
  const moderator = lastModeration?.actorId ? names.get(lastModeration.actorId)?.name : undefined;

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        placement="right"
        size="lg"
        title={r ? `Review by ${studentName(r.student)}` : 'Review'}
        description={r?.course?.title ?? 'Course unavailable'}
        footer={
          r && !detail.isError ? (
            <>
              <Button size="sm" variant="ghost" className="mr-auto text-danger hover:bg-danger/10" onClick={() => setDialog('delete')}>
                <Trash2 className="size-3.5" aria-hidden />
                Delete
              </Button>
              {r.status !== 'rejected' ? (
                <Button size="sm" variant={r.status === 'pending' ? 'danger' : 'secondary'} onClick={() => setDialog('reject')}>
                  <X className="size-3.5" aria-hidden />
                  {r.status === 'approved' ? 'Reject instead' : 'Reject'}
                </Button>
              ) : null}
              {r.status !== 'approved' ? (
                <Button size="sm" onClick={() => approve(r)} loading={approving}>
                  <Check className="size-3.5" aria-hidden />
                  {r.status === 'rejected' ? 'Approve instead' : 'Approve'}
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        {detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        ) : !r ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm',
                r.status === 'pending' ? 'border-warning/30 bg-warning/[0.06]' : r.status === 'approved' ? 'border-success/25 bg-success/[0.05]' : 'border-danger/25 bg-danger/[0.04]'
              )}
              role="status"
            >
              {r.status === 'pending' ? <Clock3 className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> : <ShieldCheck className={cn('mt-0.5 size-4 shrink-0', r.status === 'approved' ? 'text-success' : 'text-danger')} aria-hidden />}
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-ink">
                  <ReviewStatusBadge status={r.status} />
                  {r.status === 'pending' ? 'Waiting for moderation' : `${reviewStatusLabel(r.status)}${r.moderatedAt ? ` ${formatDateTime(r.moderatedAt)}` : ''}${moderator ? ` by ${moderator}` : ''}`}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {r.status === 'pending'
                    ? 'Not visible to learners and not counted in the course rating until approved.'
                    : r.status === 'approved'
                      ? 'Visible on the course page and counted in its rating.'
                      : 'Hidden from learners and excluded from the course rating.'}
                </p>
                {r.status === 'rejected' ? (
                  <p className="mt-2 rounded-md bg-surface px-2.5 py-1.5 text-xs text-ink">
                    <span className="text-ink-subtle">Reason: </span>
                    {r.rejectionReason || 'No reason recorded'}
                  </p>
                ) : null}
              </div>
            </div>

            <section aria-label="Review">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={r.rating} size="lg" />
                <span className="text-sm font-semibold text-ink">{r.rating}.0</span>
                <span className="text-sm text-ink-muted">{RATING_WORD[r.rating]}</span>
              </div>
              <h3 className="mt-3 text-base font-semibold leading-snug text-ink">{r.title || <span className="font-normal italic text-ink-subtle">No title</span>}</h3>
              {r.comment ? (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{r.comment}</p>
              ) : (
                <p className="mt-2 text-sm italic text-ink-subtle">Rating only, no written comment.</p>
              )}
            </section>

            <section aria-label="Learner and course" className="grid gap-2 sm:grid-cols-2">
              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-line p-3">
                <LearnerAvatar student={r.student} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{studentName(r.student)}</p>
                  {r.student?.email ? (
                    <a href={`mailto:${r.student.email}`} className="flex items-center gap-1 truncate text-xs text-ink-muted hover:text-primary">
                      <Mail className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{r.student.email}</span>
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-line p-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BookOpen className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium text-ink">{r.course?.title ?? 'Course unavailable'}</p>
                  {r.course?.slug ? <p className="truncate font-mono text-[11px] text-ink-subtle">/{r.course.slug}</p> : null}
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Details</h3>
              <dl className="divide-y divide-line rounded-lg border border-line">
                <Meta label="Submitted">{formatDateTime(r.createdAt)}</Meta>
                <Meta label="Last updated">{formatDateTime(r.updatedAt)}</Meta>
                <Meta label="Moderated">{r.moderatedAt ? `${formatDateTime(r.moderatedAt)}${moderator ? ` · ${moderator}` : ''}` : 'Not yet'}</Meta>
                <Meta label="Review id">
                  <span className="font-mono text-xs">{r.id}</span>
                </Meta>
                {r.enrollmentId ? (
                  <Meta label="Enrollment">
                    <span className="font-mono text-xs">{r.enrollmentId}</span>
                  </Meta>
                ) : null}
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Moderation history</h3>
              {detail.isPlaceholderData ? (
                <Skeleton className="h-16 w-full" />
              ) : !history.length ? (
                <p className="text-sm text-ink-subtle">No events recorded.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-line pl-4">
                  {[...history].reverse().map((h) => (
                    <li key={h._id} className="relative">
                      <span
                        className={cn(
                          'absolute -left-[21px] top-1 size-2.5 rounded-full ring-2 ring-surface',
                          h.action === 'approved' ? 'bg-success' : h.action === 'rejected' || h.action === 'deleted' ? 'bg-danger' : 'bg-ink-subtle'
                        )}
                        aria-hidden
                      />
                      <p className="text-sm font-medium text-ink">{HISTORY_LABEL[h.action] ?? h.action}</p>
                      <p className="text-xs text-ink-muted">
                        {formatDateTime(h.at)}
                        {h.actorId && names.get(h.actorId) ? ` · ${names.get(h.actorId)?.name}` : ''}
                      </p>
                      {h.reason ? <p className="mt-1 rounded-md bg-surface-2 px-2.5 py-1.5 text-xs text-ink-muted">“{h.reason}”</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </Dialog>

      {dialog === 'reject' && r ? <RejectReviewDialog review={r} onClose={() => setDialog(null)} /> : null}
      {dialog === 'delete' && r ? <DeleteReviewDialog review={r} onClose={() => setDialog(null)} onDone={onClose} /> : null}
    </>
  );
}
