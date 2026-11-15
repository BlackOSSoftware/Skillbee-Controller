'use client';

import { CheckCircle2, CircleDot, Lock, Mail, MessageSquareText, Phone, Send } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/input';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/cn';
import { hasPermissions } from '@/lib/roles';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import { formatDateTime } from '@/features/assignments/display';
import { useUserNames } from '@/features/shared/lookups';
import type { ContactEnquiry, SupportStatus } from '@/types/contact';
import { senderRoleLabel, SupportStatusBadge, supportStatusLabel } from '../display';
import { useAddEnquiryNote, useEnquiry, useReplyEnquiry } from '../hooks';
import { EnquiryStatusDialog } from './enquiry-actions';

const REPLY_MAX = 5000;

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `enq-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function Composer({
  id,
  label,
  placeholder,
  hint,
  submitLabel,
  icon,
  onSubmit,
  pending,
  disabled,
}: {
  id: string;
  label: string;
  placeholder: string;
  hint?: string;
  submitLabel: string;
  icon?: ReactNode;
  onSubmit: (message: string) => void;
  pending: boolean;
  disabled?: boolean;
}) {
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmed = message.trim();
  const tooLong = trimmed.length > REPLY_MAX;
  const empty = trimmed.length === 0;
  const error = touched && empty ? 'Write a message before sending.' : tooLong ? `Messages are limited to ${REPLY_MAX.toLocaleString()} characters.` : undefined;

  function submit() {
    setTouched(true);
    if (empty || tooLong) return;
    onSubmit(trimmed);
    setMessage('');
    setTouched(false);
  }

  return (
    <div className="space-y-2">
      <Field id={id} label={label} required error={error} hint={hint}>
        <Textarea
          id={id}
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          disabled={pending || disabled}
        />
      </Field>
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} loading={pending} disabled={empty || tooLong || disabled}>
          {icon}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function EnquiryDrawer({ seed, onClose }: { seed: ContactEnquiry; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const detail = useEnquiry(seed.id, seed);
  const enquiry = detail.data;
  const [statusDialog, setStatusDialog] = useState<SupportStatus | null>(null);
  const [replyKey, setReplyKey] = useState(newIdempotencyKey);

  const reply = useReplyEnquiry();
  const note = useAddEnquiryNote();

  const actorIds = useMemo(
    () => [
      ...(enquiry?.statusHistory ?? []).map((h) => h.actorId),
      ...(enquiry?.replies ?? []).map((r) => r.senderId),
      ...(enquiry?.internalNotes ?? []).map((n) => n.authorId),
    ],
    [enquiry]
  );
  const names = useUserNames(actorIds, hasPermissions(user, ['users:read']));

  function nameOf(id: string | null | undefined): string {
    if (!id) return 'System';
    if (user && id === user.id) return 'You';
    return names.get(id)?.name ?? 'Staff member';
  }

  const status: SupportStatus = enquiry?.status ?? 'open';

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        placement="right"
        size="lg"
        title={enquiry ? enquiry.subject : 'Enquiry'}
        description={enquiry ? `${enquiry.referenceNumber} · ${enquiry.category}` : 'Loading…'}
        footer={
          enquiry && !detail.isError ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto text-xs text-ink-subtle">Current status</span>
              <SupportStatusBadge status={status} />
              {(['reviewed', 'resolved', 'closed', 'open'] as SupportStatus[])
                .filter((s) => s !== status)
                .map((s) => (
                  <Button key={s} size="sm" variant="secondary" onClick={() => setStatusDialog(s)}>
                    Set {supportStatusLabel(s)}
                  </Button>
                ))}
            </div>
          ) : undefined
        }
      >
        {detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        ) : !enquiry ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm',
                status === 'open'
                  ? 'border-info/25 bg-info/[0.05]'
                  : status === 'closed'
                    ? 'border-line bg-surface-2/40'
                    : 'border-warning/25 bg-warning/[0.05]'
              )}
              role="status"
            >
              {status === 'open' ? (
                <CircleDot className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
              ) : (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-ink">
                  <SupportStatusBadge status={status} />
                  {status === 'open' ? 'New enquiry awaiting review' : `Status: ${supportStatusLabel(status)}`}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Received {formatDateTime(enquiry.createdAt)} · last activity {formatDateTime(enquiry.lastActivityAt)}
                </p>
              </div>
            </div>

            <section aria-label="Visitor" className="rounded-lg border border-line p-3.5">
              <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Visitor</h3>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                <span className="font-medium text-ink">{enquiry.name}</span>
                <a href={`mailto:${enquiry.email}`} className="inline-flex items-center gap-1 text-ink-muted hover:text-primary">
                  <Mail className="size-3.5" aria-hidden />
                  {enquiry.email}
                </a>
                {enquiry.phone ? (
                  <span className="inline-flex items-center gap-1 text-ink-muted">
                    <Phone className="size-3.5" aria-hidden />
                    {enquiry.phone}
                  </span>
                ) : null}
              </div>
            </section>

            <section aria-label="Message">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Message</h3>
              <div className="rounded-lg border border-line bg-surface-2/40 p-3.5">
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{enquiry.message}</p>
              </div>
            </section>

            <section aria-label="Reply to visitor">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                <Send className="size-3.5" aria-hidden />
                Reply to visitor
              </h3>
              <div className="rounded-lg border border-line p-3.5">
                <Composer
                  id="enquiry-reply"
                  label="Reply"
                  placeholder="Write a reply — it is emailed to the visitor…"
                  hint="The visitor receives this by email."
                  submitLabel="Send reply"
                  icon={<Send className="size-3.5" aria-hidden />}
                  pending={reply.isPending}
                  onSubmit={(message) =>
                    reply.mutate(
                      { id: enquiry.id, message, idempotencyKey: replyKey },
                      {
                        onSuccess: () => {
                          setReplyKey(newIdempotencyKey());
                          toast.success('Reply sent', 'The visitor has been notified by email.');
                        },
                        onError: (e) => toast.error('Could not send reply', normalizeApiError(e).message),
                      }
                    )
                  }
                />
              </div>
            </section>

            <section aria-label="Conversation">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                <MessageSquareText className="size-3.5" aria-hidden />
                Replies ({enquiry.replies.length})
              </h3>
              {!enquiry.replies.length ? (
                <p className="rounded-lg border border-dashed border-line px-4 py-5 text-center text-sm text-ink-subtle">
                  No replies sent yet.
                </p>
              ) : (
                <ol className="space-y-3">
                  {enquiry.replies.map((r) => (
                    <li key={r.id} className="rounded-lg border border-line p-3.5">
                      <div className="flex items-center gap-2">
                        <Badge tone="brand">{senderRoleLabel(r.senderRole)}</Badge>
                        <span className="text-xs text-ink-subtle">
                          {nameOf(r.senderId)} · {formatDateTime(r.createdAt)}
                          {r.notifiedAt ? ' · emailed' : ''}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{r.message}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section aria-label="Internal notes">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                <Lock className="size-3.5" aria-hidden />
                Internal notes ({enquiry.internalNotes?.length ?? 0})
              </h3>
              <div className="space-y-3 rounded-lg border border-dashed border-warning/40 bg-warning/[0.04] p-3.5">
                {!enquiry.internalNotes?.length ? (
                  <p className="text-sm text-ink-subtle">No internal notes yet. Notes are visible to staff only.</p>
                ) : (
                  <ol className="space-y-2.5">
                    {enquiry.internalNotes.map((n) => (
                      <li key={n.id} className="rounded-md border border-line bg-surface px-3 py-2.5">
                        <p className="text-xs text-ink-subtle">
                          {nameOf(n.authorId)} · {formatDateTime(n.createdAt)}
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm text-ink">{n.message}</p>
                      </li>
                    ))}
                  </ol>
                )}
                <Composer
                  id="enquiry-note"
                  label="Add internal note"
                  placeholder="Staff-only note — the visitor never sees this…"
                  submitLabel="Add note"
                  pending={note.isPending}
                  onSubmit={(message) =>
                    note.mutate(
                      { id: enquiry.id, message },
                      {
                        onSuccess: () => toast.success('Note added'),
                        onError: (e) => toast.error('Could not add note', normalizeApiError(e).message),
                      }
                    )
                  }
                />
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Details</h3>
              <dl className="divide-y divide-line rounded-lg border border-line">
                <Meta label="Reference">{enquiry.referenceNumber}</Meta>
                <Meta label="Category">{enquiry.category}</Meta>
                <Meta label="Received">{formatDateTime(enquiry.createdAt)}</Meta>
                <Meta label="Reviewed">{enquiry.reviewedAt ? formatDateTime(enquiry.reviewedAt) : '—'}</Meta>
                <Meta label="Resolved">{enquiry.resolvedAt ? formatDateTime(enquiry.resolvedAt) : '—'}</Meta>
                <Meta label="Closed">{enquiry.closedAt ? formatDateTime(enquiry.closedAt) : '—'}</Meta>
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Status history</h3>
              {detail.isPlaceholderData ? (
                <Skeleton className="h-16 w-full" />
              ) : !enquiry.statusHistory.length ? (
                <p className="text-sm text-ink-subtle">No status changes recorded.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-line pl-4">
                  {[...enquiry.statusHistory].reverse().map((h, i) => (
                    <li key={`${h.at}-${i}`} className="relative">
                      <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-ink-subtle ring-2 ring-surface" aria-hidden />
                      <p className="text-sm font-medium text-ink">
                        {h.from ? `${supportStatusLabel(h.from)} → ` : ''}
                        {supportStatusLabel(h.to)}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {formatDateTime(h.at)}
                        {h.actorId ? ` · ${nameOf(h.actorId)}` : ' · system'}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </Dialog>

      {statusDialog && enquiry ? (
        <EnquiryStatusDialog enquiry={enquiry} target={statusDialog} onClose={() => setStatusDialog(null)} onDone={onClose} />
      ) : null}
    </>
  );
}
