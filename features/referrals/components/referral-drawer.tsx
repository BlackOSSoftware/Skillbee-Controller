'use client';

import { Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { hasPermissions } from '@/lib/roles';
import { formatDateTime } from '@/features/assignments/display';
import { useUserNames } from '@/features/shared/lookups';
import type { Referral, ReferralStatus } from '@/types/referrals';
import { ReferralStatusBadge, REFERRAL_STATUS_LABEL, REFERRAL_STATUSES } from '../display';
import { useReferralDetail } from '../hooks';
import { ReferralDeleteDialog, ReferralStatusDialog } from './referral-actions';

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function ContactBlock({ title, name, email, phone }: { title: string; name: string; email?: string; phone: string }) {
  return (
    <div className="rounded-lg border border-line p-3.5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{title}</p>
      <p className="text-sm font-medium text-ink">{name}</p>
      {email ? (
        <a href={`mailto:${email}`} className="mt-0.5 block truncate text-xs text-primary hover:underline">
          {email}
        </a>
      ) : null}
      <p className="mt-0.5 text-xs text-ink-muted">{phone}</p>
    </div>
  );
}

export function ReferralDrawer({ seed, onClose }: { seed: Referral; onClose: () => void }) {
  const { user } = useAuth();
  const detail = useReferralDetail(seed.id, seed);
  const referral = detail.data;
  const [statusDialog, setStatusDialog] = useState<ReferralStatus | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handlerIds = useMemo(() => [referral?.handledBy], [referral]);
  const names = useUserNames(handlerIds, hasPermissions(user, ['users:read']));

  function handlerName(id: string | null | undefined): string {
    if (!id) return '—';
    if (user && id === user.id) return 'You';
    return names.get(id)?.name ?? 'Staff member';
  }

  const status: ReferralStatus = referral?.status ?? 'pending';

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        placement="right"
        size="lg"
        title={referral ? `${referral.referrerName} → ${referral.friendName}` : 'Referral'}
        description={referral ? `Submitted ${formatDateTime(referral.createdAt)}` : 'Loading…'}
        footer={
          referral && !detail.isError ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto flex items-center gap-2 text-xs text-ink-subtle">
                <ReferralStatusBadge status={status} />
              </span>
              <Button size="sm" variant="secondary" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-3.5" aria-hidden />
                Delete
              </Button>
              {REFERRAL_STATUSES.filter((s) => s !== status).map((s) => (
                <Button key={s} size="sm" variant="secondary" onClick={() => setStatusDialog(s)}>
                  Set {REFERRAL_STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
          ) : undefined
        }
      >
        {detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        ) : !referral ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <section aria-label="People">
              <div className="grid gap-3 sm:grid-cols-2">
                <ContactBlock title="Referrer" name={referral.referrerName} email={referral.referrerEmail} phone={referral.referrerPhone} />
                <ContactBlock title="Referred friend" name={referral.friendName} phone={referral.friendPhone} />
              </div>
            </section>

            <section aria-label="Message">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Message</h3>
              {referral.message ? (
                <div className="rounded-lg border border-line bg-surface-2/40 p-3.5">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{referral.message}</p>
                </div>
              ) : (
                <p className="text-sm text-ink-subtle">No message provided.</p>
              )}
            </section>

            <section aria-label="Status">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Status</h3>
              <dl className="divide-y divide-line rounded-lg border border-line">
                <Meta label="Current status">
                  <ReferralStatusBadge status={status} />
                </Meta>
                <Meta label="Handled by">
                  {referral.handledBy ? handlerName(referral.handledBy) : 'Not handled yet'}
                  {referral.handledAt ? ` · ${formatDateTime(referral.handledAt)}` : ''}
                </Meta>
                <Meta label="Submitted">{formatDateTime(referral.createdAt)}</Meta>
                <Meta label="Last updated">{formatDateTime(referral.updatedAt)}</Meta>
              </dl>
            </section>

            <section aria-label="Admin notes">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Admin notes
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-ink-muted ring-1 ring-inset ring-line">
                  Internal only
                </span>
              </h3>
              {referral.adminNotes ? (
                <div className="rounded-lg border border-line bg-surface-2/40 p-3.5">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{referral.adminNotes}</p>
                </div>
              ) : (
                <p className="text-sm text-ink-subtle">No admin notes recorded.</p>
              )}
            </section>
          </div>
        )}
      </Dialog>

      {statusDialog && referral ? (
        <ReferralStatusDialog
          referral={referral}
          target={statusDialog}
          onClose={() => setStatusDialog(null)}
          onDone={onClose}
        />
      ) : null}
      {deleteOpen && referral ? (
        <ReferralDeleteDialog referral={referral} onClose={() => setDeleteOpen(false)} onDone={onClose} />
      ) : null}
    </>
  );
}
