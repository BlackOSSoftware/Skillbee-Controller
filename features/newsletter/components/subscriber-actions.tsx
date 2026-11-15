'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { NewsletterSubscriber, SubscriberStatus } from '@/types/newsletter';
import { SUBSCRIBER_STATUS_LABEL } from '../display';
import { useDeleteSubscriber, useSetSubscriberStatus } from '../hooks';

type SubscriberLike = Pick<NewsletterSubscriber, 'id' | 'email' | 'status'>;

function SubscriberSummary({ subscriber }: { subscriber: SubscriberLike }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
      <p className="truncate text-sm font-medium text-ink">{subscriber.email}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{SUBSCRIBER_STATUS_LABEL[subscriber.status]}</p>
    </div>
  );
}

/** Status change — backend accepts { status } only. */
export function SubscriberStatusDialog({
  subscriber,
  target,
  onClose,
  onDone,
}: {
  subscriber: SubscriberLike;
  target: SubscriberStatus;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const update = useSetSubscriberStatus();

  function confirm() {
    if (update.isPending) return;
    update.mutate(
      { id: subscriber.id, status: target },
      {
        onSuccess: () => {
          toast.success('Status updated', `${subscriber.email} is now ${SUBSCRIBER_STATUS_LABEL[target].toLowerCase()}.`);
          onClose();
          onDone?.();
        },
        onError: (e) => toast.error('Could not update status', normalizeApiError(e).message),
      }
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Mark as ${SUBSCRIBER_STATUS_LABEL[target]}?`}
      description={`${subscriber.email} · currently ${SUBSCRIBER_STATUS_LABEL[subscriber.status]}`}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2">
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={update.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {update.isPending ? 'Saving…' : `Set ${SUBSCRIBER_STATUS_LABEL[target]}`}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <SubscriberSummary subscriber={subscriber} />
        {target === 'unsubscribed' ? (
          <p className="text-xs text-ink-muted">Unsubscribed contacts are excluded from future campaigns.</p>
        ) : null}
        {target === 'subscribed' ? (
          <p className="text-xs text-ink-muted">Only subscribed contacts receive campaign emails.</p>
        ) : null}
      </div>
    </Dialog>
  );
}

/** Delete confirmation — backend soft-deletes and marks unsubscribed. */
export function SubscriberDeleteDialog({
  subscriber,
  onClose,
  onDone,
}: {
  subscriber: SubscriberLike;
  onClose: () => void;
  onDone?: () => void;
}) {
  const toast = useToast();
  const remove = useDeleteSubscriber();

  function confirm() {
    remove.mutate(subscriber.id, {
      onSuccess: () => {
        toast.success('Subscriber deleted', `${subscriber.email} was removed from the list.`);
        onClose();
        onDone?.();
      },
      onError: (e) => toast.error('Could not delete subscriber', normalizeApiError(e).message),
    });
  }

  return (
    <ConfirmDialog
      open
      title="Delete this subscriber?"
      tone="danger"
      confirmLabel="Delete subscriber"
      loading={remove.isPending}
      onCancel={onClose}
      onConfirm={confirm}
      description={
        <div className="space-y-3">
          <SubscriberSummary subscriber={subscriber} />
          <p>
            This is a <span className="font-medium text-ink">soft delete</span>: the subscriber is hidden from the admin list
            and marked unsubscribed. They will not receive future campaigns.
          </p>
        </div>
      }
    />
  );
}
