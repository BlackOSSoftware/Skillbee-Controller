'use client';

import { useState, type ReactNode } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { formatDateTime } from '@/features/assignments/display';
import type { NewsletterCampaign } from '@/types/newsletter';
import { CampaignStatusBadge } from '../display';
import { useCampaignDetail } from '../hooks';

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-center">
      <p className="text-lg font-semibold tabular-nums text-ink">{value.toLocaleString('en-IN')}</p>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}

export function CampaignDrawer({ seed, onClose }: { seed: NewsletterCampaign; onClose: () => void }) {
  const detail = useCampaignDetail(seed.id, seed);
  const campaign = detail.data;
  const [showHtml, setShowHtml] = useState(false);
  const [showText, setShowText] = useState(false);

  return (
    <Dialog
      open
      onClose={onClose}
      placement="right"
      size="lg"
      title={campaign?.subject ?? 'Campaign'}
      description={campaign ? `Created ${formatDateTime(campaign.createdAt)}` : 'Loading…'}
    >
      {detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      ) : !campaign ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="space-y-5">
          <section aria-label="Status">
            <dl className="divide-y divide-line rounded-lg border border-line">
              <Meta label="Status">
                <CampaignStatusBadge status={campaign.status} />
              </Meta>
              <Meta label="Started">{campaign.startedAt ? formatDateTime(campaign.startedAt) : '—'}</Meta>
              <Meta label="Completed">{campaign.completedAt ? formatDateTime(campaign.completedAt) : '—'}</Meta>
              <Meta label="Created">{formatDateTime(campaign.createdAt)}</Meta>
              <Meta label="Updated">{formatDateTime(campaign.updatedAt)}</Meta>
            </dl>
          </section>

          <section aria-label="Delivery stats">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Delivery stats</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Queued" value={campaign.stats?.queued ?? 0} />
              <Stat label="Sent" value={campaign.stats?.sent ?? 0} />
              <Stat label="Failed" value={campaign.stats?.failed ?? 0} />
              <Stat label="Skipped" value={campaign.stats?.skippedUnsubscribed ?? 0} />
            </div>
            <p className="mt-2 text-[11px] text-ink-subtle">
              Counts reflect queued deliveries — “sent” means handed to the mail queue, not confirmed inbox delivery.
            </p>
          </section>

          <section aria-label="Content">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Content</h3>
            <div className="space-y-2">
              <button type="button" onClick={() => setShowHtml((s) => !s)} className="text-xs font-medium text-primary hover:underline">
                {showHtml ? 'Hide HTML body' : 'Show HTML body'}
              </button>
              {showHtml ? (
                <iframe title="Campaign HTML" sandbox="" srcDoc={campaign.htmlBody} className="h-72 w-full rounded-lg border border-line bg-white" />
              ) : null}
              <button type="button" onClick={() => setShowText((s) => !s)} className="text-xs font-medium text-primary hover:underline">
                {showText ? 'Hide text body' : 'Show text body'}
              </button>
              {showText ? (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface-2/40 p-3 font-sans text-xs leading-relaxed text-ink">
                  {campaign.textBody}
                </pre>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </Dialog>
  );
}
