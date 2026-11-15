'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { AdminReview, AdminReviewDetail } from '@/types/reviews';
import { Stars, studentName } from '../display';
import { useDeleteReview, useModerateReview } from '../hooks';

type ReviewLike = Pick<AdminReview | AdminReviewDetail, 'id' | 'rating' | 'title' | 'status' | 'student' | 'course'>;

const REASON_MAX = 2000;

/** Approve is not destructive and applies immediately; errors surface as toasts. */
export function useApproveReview() {
  const toast = useToast();
  const moderate = useModerateReview();
  return {
    isPending: moderate.isPending,
    approve: (review: ReviewLike, onDone?: () => void) =>
      moderate.mutate(
        { id: review.id, input: { status: 'approved' } },
        {
          onSuccess: () => {
            toast.success('Review approved', `${studentName(review.student)}'s review is now public and counts towards the course rating.`);
            onDone?.();
          },
          onError: (e) => toast.error('Could not approve review', normalizeApiError(e).message),
        }
      ),
  };
}

function ReviewSummary({ review }: { review: ReviewLike }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-ink">{studentName(review.student)}</span>
        <Stars value={review.rating} />
      </div>
      <p className="mt-0.5 truncate text-xs text-ink-muted">
        {review.title || 'Untitled review'} · {review.course?.title ?? 'Unknown course'}
      </p>
    </div>
  );
}

export function RejectReviewDialog({ review, onClose, onDone }: { review: ReviewLike; onClose: () => void; onDone?: () => void }) {
  const toast = useToast();
  const moderate = useModerateReview();
  const [reason, setReason] = useState('');
  const tooLong = reason.trim().length > REASON_MAX;

  function submit() {
    if (tooLong) return;
    moderate.mutate(
      { id: review.id, input: { status: 'rejected', ...(reason.trim() ? { rejectionReason: reason.trim() } : {}) } },
      {
        onSuccess: () => {
          toast.success('Review rejected', `${studentName(review.student)}'s review is hidden from the course page.`);
          onClose();
          onDone?.();
        },
        onError: (e) => toast.error('Could not reject review', normalizeApiError(e).message),
      }
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={moderate.isPending}
      size="sm"
      title="Reject review"
      description="Rejected reviews stay in the moderation queue but are not shown to learners or counted in the rating."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={moderate.isPending}>
            Cancel
          </Button>
          <Button variant="danger-solid" onClick={submit} loading={moderate.isPending} disabled={tooLong}>
            Reject review
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ReviewSummary review={review} />
        <Field id="rv-reason" label="Reason" hint={`Optional · kept with the review for other admins · ${reason.trim().length}/${REASON_MAX}`} error={tooLong ? `${REASON_MAX.toLocaleString()} characters or less.` : undefined}>
          <Textarea id="rv-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Contains a promotional link" aria-invalid={tooLong} aria-describedby="rv-reason-msg" autoFocus />
        </Field>
      </div>
    </Dialog>
  );
}

export function DeleteReviewDialog({ review, onClose, onDone }: { review: ReviewLike; onClose: () => void; onDone?: () => void }) {
  const toast = useToast();
  const remove = useDeleteReview();

  function confirm() {
    remove.mutate(review.id, {
      onSuccess: () => {
        toast.success('Review deleted', 'It was removed from the course and the rating was recalculated.');
        onClose();
        onDone?.();
      },
      onError: (e) => {
        toast.error('Could not delete review', normalizeApiError(e).message);
        onClose();
      },
    });
  }

  return (
    <ConfirmDialog
      open
      title="Delete this review?"
      tone="danger"
      confirmLabel="Delete review"
      loading={remove.isPending}
      onCancel={onClose}
      onConfirm={confirm}
      description={
        <div className="space-y-3">
          <ReviewSummary review={review} />
          <p>The review disappears from the course page and this list, and the course rating is recalculated. It is archived, not erased: the record and its moderation history are kept.</p>
          <p>The learner will be able to submit a new review for this course.</p>
          {review.status === 'pending' ? <p className="text-warning">This review has not been moderated yet. To keep it but hide it, reject it instead.</p> : null}
        </div>
      }
    />
  );
}
