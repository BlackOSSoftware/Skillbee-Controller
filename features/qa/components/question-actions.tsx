'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { CourseQuestion, QuestionStatus } from '@/types/qa';
import { qaStudentName, questionStatusLabel } from '../display';
import { useDeleteQuestion, useUpdateQuestionStatus } from '../hooks';

type QuestionLike = Pick<CourseQuestion, 'id' | 'title' | 'status' | 'student' | 'course'>;

function QuestionSummary({ question }: { question: QuestionLike }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
      <p className="truncate text-sm font-medium text-ink">{question.title}</p>
      <p className="mt-0.5 truncate text-xs text-ink-muted">
        {qaStudentName(question.student)} · {question.course?.title ?? 'Unknown course'}
      </p>
    </div>
  );
}

/** Resolve/reopen is reversible but changes what learners see, so it is confirmed. */
export function QuestionStatusDialog({
  question,
  target,
  onClose,
  onDone,
}: {
  question: QuestionLike;
  target: QuestionStatus;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const update = useUpdateQuestionStatus();
  const resolving = target === 'resolved';

  function confirm() {
    update.mutate(
      { id: question.id, status: target },
      {
        onSuccess: () => {
          toast.success(
            resolving ? 'Question resolved' : 'Question reopened',
            resolving
              ? 'The student can no longer reply until it is reopened.'
              : 'The student can reply again and staff can respond.'
          );
          onClose();
          onDone?.();
        },
        onError: (e) => toast.error(`Could not ${resolving ? 'resolve' : 'reopen'} question`, normalizeApiError(e).message),
      }
    );
  }

  return (
    <ConfirmDialog
      open
      title={resolving ? 'Mark this question as resolved?' : 'Reopen this question?'}
      tone="primary"
      confirmLabel={resolving ? 'Mark resolved' : 'Reopen question'}
      loading={update.isPending}
      onCancel={onClose}
      onConfirm={confirm}
      description={
        <div className="space-y-3">
          <QuestionSummary question={question} />
          <p>
            {resolving
              ? 'The question stays visible but is marked resolved. The student cannot add replies while it is resolved.'
              : 'The question returns to the open queue and the student can reply again.'}
          </p>
          <p className="text-xs text-ink-subtle">
            Current status: {questionStatusLabel(question.status)}
          </p>
        </div>
      }
    />
  );
}

export function DeleteQuestionDialog({
  question,
  onClose,
  onDone,
}: {
  question: QuestionLike;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const remove = useDeleteQuestion();

  function confirm() {
    remove.mutate(question.id, {
      onSuccess: () => {
        toast.success('Question deleted', 'It was removed from the list along with its replies. The record is archived, not erased.');
        onClose();
        onDone?.();
      },
      onError: (e) => {
        toast.error('Could not delete question', normalizeApiError(e).message);
        onClose();
      },
    });
  }

  return (
    <ConfirmDialog
      open
      title="Delete this question?"
      tone="danger"
      confirmLabel="Delete question"
      loading={remove.isPending}
      onCancel={onClose}
      onConfirm={confirm}
      description={
        <div className="space-y-3">
          <QuestionSummary question={question} />
          <p>
            The question and all of its replies disappear from this list and from the student&apos;s view. The records are
            soft-deleted: they stay in the database for audit purposes.
          </p>
        </div>
      }
    />
  );
}
