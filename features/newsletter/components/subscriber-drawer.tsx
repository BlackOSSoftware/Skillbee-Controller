'use client';

import { Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { formatDateTime } from '@/features/assignments/display';
import type { NewsletterSubscriber, SubscriberStatus } from '@/types/newsletter';
import { SUBSCRIBER_STATUS_LABEL, SUBSCRIBER_STATUSES, SubscriberStatusBadge } from '../display';
import { useSubscriberDetail } from '../hooks';
import { SubscriberDeleteDialog, SubscriberStatusDialog } from './subscriber-actions';

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

export function SubscriberDrawer({ seed, onClose }: { seed: NewsletterSubscriber; onClose: () => void }) {
  const detail = useSubscriberDetail(seed.id, seed);
  const subscriber = detail.data;
  const [statusDialog, setStatusDialog] = useState<SubscriberStatus | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const status: SubscriberStatus = subscriber?.status ?? 'pending';

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        placement="right"
        size="lg"
        title={subscriber?.email ?? 'Subscriber'}
        description={subscriber ? `Subscribed ${formatDateTime(subscriber.createdAt)}` : 'Loading…'}
        footer={
          subscriber && !detail.isError ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto flex items-center gap-2 text-xs text-ink-subtle">
                <SubscriberStatusBadge status={status} />
              </span>
              <Button size="sm" variant="secondary" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-3.5" aria-hidden />
                Delete
              </Button>
              {SUBSCRIBER_STATUSES.filter((s) => s !== status).map((s) => (
                <Button key={s} size="sm" variant="secondary" onClick={() => setStatusDialog(s)}>
                  Set {SUBSCRIBER_STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
          ) : undefined
        }
      >
        {detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        ) : !subscriber ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <section aria-label="Subscriber">
              <dl className="divide-y divide-line rounded-lg border border-line">
                <Meta label="Email">
                  <a href={`mailto:${subscriber.email}`} className="text-primary hover:underline">
                    {subscriber.email}
                  </a>
                </Meta>
                <Meta label="Status">
                  <SubscriberStatusBadge status={status} />
                </Meta>
                <Meta label="Source">{subscriber.source || 'website'}</Meta>
                <Meta label="Subscribed at">
                  {subscriber.subscribedAt ? formatDateTime(subscriber.subscribedAt) : 'Not yet verified'}
                </Meta>
                <Meta label="Unsubscribed at">
                  {subscriber.unsubscribedAt ? formatDateTime(subscriber.unsubscribedAt) : '—'}
                </Meta>
                <Meta label="Created">{formatDateTime(subscriber.createdAt)}</Meta>
                <Meta label="Last updated">{formatDateTime(subscriber.updatedAt)}</Meta>
              </dl>
            </section>

            <section aria-label="Campaign eligibility">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Campaign eligibility</h3>
              <p className="rounded-lg border border-line bg-surface-2/40 p-3.5 text-sm text-ink-muted">
                {status === 'subscribed'
                  ? 'This subscriber receives newsletter campaigns.'
                  : status === 'pending'
                    ? 'Awaiting email verification — campaigns skip unverified subscribers.'
                    : 'Unsubscribed — excluded from all future campaigns.'}
              </p>
            </section>
          </div>
        )}
      </Dialog>

      {statusDialog && subscriber ? (
        <SubscriberStatusDialog
          subscriber={subscriber}
          target={statusDialog}
          onClose={() => setStatusDialog(null)}
          onDone={onClose}
        />
      ) : null}
      {deleteOpen && subscriber ? (
        <SubscriberDeleteDialog subscriber={subscriber} onClose={() => setDeleteOpen(false)} onDone={onClose} />
      ) : null}
    </>
  );
}
