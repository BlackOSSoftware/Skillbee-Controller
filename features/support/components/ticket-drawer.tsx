'use client';

import { CheckCircle2, CircleDot, Lock, MessageSquareText, Send, UserRound } from 'lucide-react';
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
import type { SupportStatus, SupportTicket, TicketMessage } from '@/types/contact';
import { senderRoleLabel, SupportStatusBadge, supportStatusLabel, TICKET_CATEGORY_LABEL, TicketPriorityBadge } from '@/features/contact/display';
import { useAddTicketNote, useAdminTicket, useReplyAdminTicket } from '../hooks';
import { TicketAssignDialog, TicketStatusDialog } from './ticket-actions';

const MESSAGE_MAX = 5000;

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
  return `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
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
  const tooLong = trimmed.length > MESSAGE_MAX;
  const empty = trimmed.length === 0;
  const error = touched && empty ? 'Write a message before sending.' : tooLong ? `Messages are limited to ${MESSAGE_MAX.toLocaleString()} characters.` : undefined;

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

function MessageBubble({ message, nameOf, isStaff }: { message: TicketMessage; nameOf: (id: string) => string; isStaff: boolean }) {
  const internal = message.visibility === 'internal';
  return (
    <li className={cn('rounded-lg border p-3.5', internal ? 'border-dashed border-warning/40 bg-warning/[0.05]' : 'border-line bg-surface-2/40')}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={internal ? 'warning' : isStaff ? 'brand' : 'neutral'}>
          {internal ? 'Internal note' : senderRoleLabel(message.senderRole)}
        </Badge>
        <span className="text-xs text-ink-subtle">
          {nameOf(message.senderId)} · {formatDateTime(message.createdAt)}
          {message.notifiedAt ? ' · emailed' : ''}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{message.message}</p>
      {message.attachments.length ? (
        <ul className="mt-2 space-y-1">
          {message.attachments.map((a, i) => (
            <li key={a.id ?? i} className="text-xs">
              {a.publicUrl ? (
                <a href={a.publicUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {a.fileName || 'Attachment'}
                </a>
              ) : (
                <span className="text-ink-muted">{a.fileName || 'Attachment'}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TicketDrawer({ seed, onClose }: { seed: SupportTicket; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const detail = useAdminTicket(seed.id, seed);
  const ticket = detail.data;
  const [statusDialog, setStatusDialog] = useState<SupportStatus | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [replyKey, setReplyKey] = useState(newIdempotencyKey);

  const reply = useReplyAdminTicket();
  const note = useAddTicketNote();

  const actorIds = useMemo(
    () => [
      ...(ticket?.statusHistory ?? []).map((h) => h.actorId),
      ...(ticket?.messages ?? []).map((m) => m.senderId),
      ticket?.student?.id,
      ticket?.assignee?.id,
    ],
    [ticket]
  );
  const names = useUserNames(actorIds, hasPermissions(user, ['users:read']));

  function nameOf(id: string | null | undefined): string {
    if (!id) return 'System';
    if (user && id === user.id) return 'You';
    return names.get(id)?.name ?? 'Staff member';
  }

  const status: SupportStatus = ticket?.status ?? 'open';
  const messages = ticket?.messages ?? [];
  const publicMessages = messages.filter((m) => m.visibility === 'public');
  const internalMessages = messages.filter((m) => m.visibility === 'internal');

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        placement="right"
        size="lg"
        title={ticket ? ticket.subject : 'Support ticket'}
        description={ticket ? `${ticket.ticketNumber} · ${TICKET_CATEGORY_LABEL[ticket.category] ?? ticket.category}` : 'Loading…'}
        footer={
          ticket && !detail.isError ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto flex items-center gap-2 text-xs text-ink-subtle">
                <SupportStatusBadge status={status} />
                {ticket.assignee ? `Assigned to ${ticket.assignee.firstName} ${ticket.assignee.lastName}` : 'Unassigned'}
              </span>
              <Button size="sm" variant="secondary" onClick={() => setAssignOpen(true)}>
                Assign
              </Button>
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
        ) : !ticket ? (
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
                  <TicketPriorityBadge priority={ticket.priority} />
                  {status === 'open' ? 'New ticket awaiting review' : `Status: ${supportStatusLabel(status)}`}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Raised {formatDateTime(ticket.createdAt)} · last activity {formatDateTime(ticket.lastActivityAt)}
                </p>
              </div>
            </div>

            <section aria-label="Student" className="rounded-lg border border-line p-3.5">
              <h3 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                <UserRound className="size-3.5" aria-hidden />
                Student
              </h3>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                <span className="font-medium text-ink">
                  {ticket.student ? `${ticket.student.firstName} ${ticket.student.lastName}`.trim() : 'Unknown'}
                </span>
                {ticket.student ? (
                  <a href={`mailto:${ticket.student.email}`} className="text-ink-muted hover:text-primary">
                    {ticket.student.email}
                  </a>
                ) : null}
              </div>
            </section>

            <section aria-label="Conversation">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                <MessageSquareText className="size-3.5" aria-hidden />
                Conversation ({publicMessages.length})
              </h3>
              {!publicMessages.length ? (
                <p className="rounded-lg border border-dashed border-line px-4 py-5 text-center text-sm text-ink-subtle">
                  No public messages yet.
                </p>
              ) : (
                <ol className="space-y-3">
                  {publicMessages.map((m) => (
                    <MessageBubble key={m.id} message={m} nameOf={nameOf} isStaff={m.senderRole !== 'student'} />
                  ))}
                </ol>
              )}
            </section>

            <section aria-label="Reply to student">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                <Send className="size-3.5" aria-hidden />
                Reply to student
              </h3>
              <div className="rounded-lg border border-line p-3.5">
                <Composer
                  id="ticket-reply"
                  label="Reply"
                  placeholder="Write a reply — the student sees this and is emailed…"
                  hint="Visible to the student. Use an internal note for staff-only context."
                  submitLabel="Send reply"
                  icon={<Send className="size-3.5" aria-hidden />}
                  pending={reply.isPending}
                  onSubmit={(message) =>
                    reply.mutate(
                      { id: ticket.id, input: { message, idempotencyKey: replyKey } },
                      {
                        onSuccess: () => {
                          setReplyKey(newIdempotencyKey());
                          toast.success('Reply sent', 'The student has been notified by email.');
                        },
                        onError: (e) => toast.error('Could not send reply', normalizeApiError(e).message),
                      }
                    )
                  }
                />
              </div>
            </section>

            <section aria-label="Internal notes">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                <Lock className="size-3.5" aria-hidden />
                Internal notes ({internalMessages.length})
              </h3>
              <div className="space-y-3 rounded-lg border border-dashed border-warning/40 bg-warning/[0.04] p-3.5">
                {!internalMessages.length ? (
                  <p className="text-sm text-ink-subtle">No internal notes yet. Notes are visible to staff only.</p>
                ) : (
                  <ol className="space-y-2.5">
                    {internalMessages.map((m) => (
                      <MessageBubble key={m.id} message={m} nameOf={nameOf} isStaff />
                    ))}
                  </ol>
                )}
                <Composer
                  id="ticket-note"
                  label="Add internal note"
                  placeholder="Staff-only note — the student never sees this…"
                  submitLabel="Add note"
                  pending={note.isPending}
                  onSubmit={(message) =>
                    note.mutate(
                      { id: ticket.id, message },
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
                <Meta label="Ticket">{ticket.ticketNumber}</Meta>
                <Meta label="Category">{TICKET_CATEGORY_LABEL[ticket.category] ?? ticket.category}</Meta>
                <Meta label="Priority">
                  <TicketPriorityBadge priority={ticket.priority} />
                </Meta>
                <Meta label="Student">{ticket.student ? `${ticket.student.firstName} ${ticket.student.lastName}`.trim() : '—'}</Meta>
                <Meta label="Assignee">{ticket.assignee ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}`.trim() : 'Unassigned'}</Meta>
                <Meta label="Raised">{formatDateTime(ticket.createdAt)}</Meta>
                <Meta label="Resolved">{ticket.resolvedAt ? formatDateTime(ticket.resolvedAt) : '—'}</Meta>
                <Meta label="Closed">{ticket.closedAt ? formatDateTime(ticket.closedAt) : '—'}</Meta>
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Status history</h3>
              {detail.isPlaceholderData ? (
                <Skeleton className="h-16 w-full" />
              ) : !ticket.statusHistory.length ? (
                <p className="text-sm text-ink-subtle">No status changes recorded.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-line pl-4">
                  {[...ticket.statusHistory].reverse().map((h, i) => (
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

      {statusDialog && ticket ? <TicketStatusDialog ticket={ticket} target={statusDialog} onClose={() => setStatusDialog(null)} onDone={onClose} /> : null}
      {assignOpen && ticket ? <TicketAssignDialog ticket={ticket} onClose={() => setAssignOpen(false)} /> : null}
    </>
  );
}
