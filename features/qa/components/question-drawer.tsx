'use client';

import {
  BookOpen,
  CheckCircle2,
  CircleDot,
  Mail,
  MessageSquareText,
  Paperclip,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
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
import type { CourseQuestion, QuestionAuditEvent, QuestionDetail, QuestionReply, ReplySenderRole } from '@/types/qa';
import { qaStudentInitials, qaStudentName, questionStatusLabel, QuestionStatusBadge, SENDER_ROLE_LABEL } from '../display';
import { usePostReply, useQuestion } from '../hooks';
import { DeleteQuestionDialog, QuestionStatusDialog } from './question-actions';

const REPLY_MAX = 5000;

const AUDIT_LABEL: Record<string, string> = {
  created: 'Question asked',
  reply_added: 'Reply added',
  status_changed: 'Status changed',
  deleted: 'Deleted',
};

const ROLE_TONE: Record<ReplySenderRole, 'neutral' | 'brand' | 'info'> = {
  student: 'neutral',
  admin: 'brand',
  instructor: 'info',
};

const ROLE_AVATAR: Record<ReplySenderRole, string> = {
  student: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  admin: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  instructor: 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
};

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function auditDescription(event: QuestionAuditEvent): string {
  if (event.action === 'status_changed') {
    const from = typeof event.meta?.from === 'string' ? event.meta.from : null;
    const to = typeof event.meta?.to === 'string' ? event.meta.to : null;
    if (from && to) return `${questionStatusLabel(from as CourseQuestion['status'])} → ${questionStatusLabel(to as CourseQuestion['status'])}`;
  }
  if (event.action === 'reply_added' && typeof event.meta?.senderRole === 'string') {
    return `By ${SENDER_ROLE_LABEL[event.meta.senderRole as ReplySenderRole] ?? event.meta.senderRole}`;
  }
  return AUDIT_LABEL[event.action] ?? event.action;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `qa-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function ReplyComposer({ question }: { question: QuestionDetail }) {
  const toast = useToast();
  const post = usePostReply();
  const [message, setMessage] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [touched, setTouched] = useState(false);

  const trimmed = message.trim();
  const tooLong = trimmed.length > REPLY_MAX;
  const empty = trimmed.length === 0;
  const error = touched && empty ? 'Write a reply before sending.' : tooLong ? `Replies are limited to ${REPLY_MAX.toLocaleString()} characters.` : undefined;

  function submit() {
    setTouched(true);
    if (empty || tooLong) return;
    post.mutate(
      { id: question.id, message: trimmed, idempotencyKey },
      {
        onSuccess: () => {
          setMessage('');
          setTouched(false);
          setIdempotencyKey(newIdempotencyKey());
          toast.success('Reply posted', 'The student has been notified by email.');
        },
        onError: (e) => toast.error('Could not post reply', normalizeApiError(e).message),
      }
    );
  }

  return (
    <section aria-label="Reply" className="rounded-lg border border-line">
      <div className="border-b border-line px-3.5 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Your reply</h3>
      </div>
      <div className="space-y-2 p-3.5">
        <Field id="qa-reply" label="Message" required error={error} hint={`${trimmed.length.toLocaleString()}/${REPLY_MAX.toLocaleString()}`}>
          <Textarea
            id="qa-reply"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Write a helpful answer for the student…"
            aria-invalid={Boolean(error)}
            aria-describedby="qa-reply-msg"
            disabled={post.isPending}
          />
        </Field>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-ink-subtle">Replies are visible to the student immediately.</p>
          <Button size="sm" onClick={submit} loading={post.isPending} disabled={empty || tooLong}>
            <Send className="size-3.5" aria-hidden />
            Post reply
          </Button>
        </div>
      </div>
    </section>
  );
}

export function QuestionDrawer({ seed, onClose }: { seed: CourseQuestion; onClose: () => void }) {
  const { user } = useAuth();
  const detail = useQuestion(seed.id, seed);
  const q = detail.data;
  const [dialog, setDialog] = useState<'resolve' | 'reopen' | 'delete' | null>(null);

  const canReadUsers = hasPermissions(user, ['users:read']);
  const senderIds = useMemo(
    () => (q?.replies ?? []).map((r) => r.senderId).concat(q?.resolvedBy ? [q.resolvedBy] : []),
    [q]
  );
  const auditActorIds = useMemo(() => (q?.auditLog ?? []).map((a) => a.actorId), [q]);
  const names = useUserNames([...senderIds, ...auditActorIds], canReadUsers);

  function replyAuthor(reply: QuestionReply): { name: string; role: ReplySenderRole } {
    if (reply.senderRole === 'student') return { name: qaStudentName(q?.student), role: 'student' };
    if (user && reply.senderId === user.id) return { name: 'You', role: reply.senderRole };
    const resolved = names.get(reply.senderId)?.name;
    return { name: resolved ?? SENDER_ROLE_LABEL[reply.senderRole], role: reply.senderRole };
  }

  const resolved = q?.status === 'resolved';

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        placement="right"
        size="lg"
        title={q ? q.title : 'Question'}
        description={q?.course?.title ?? 'Course unavailable'}
        footer={
          q && !detail.isError ? (
            <>
              <Button size="sm" variant="ghost" className="mr-auto text-danger hover:bg-danger/10" onClick={() => setDialog('delete')}>
                <Trash2 className="size-3.5" aria-hidden />
                Delete
              </Button>
              {resolved ? (
                <Button size="sm" onClick={() => setDialog('reopen')}>
                  <RotateCcw className="size-3.5" aria-hidden />
                  Reopen question
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setDialog('resolve')}>
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  Mark as resolved
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        ) : !q ? (
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
                resolved ? 'border-success/25 bg-success/[0.05]' : 'border-info/25 bg-info/[0.05]'
              )}
              role="status"
            >
              {resolved ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <CircleDot className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-ink">
                  <QuestionStatusBadge status={q.status} />
                  {resolved
                    ? `Resolved${q.resolvedAt ? ` ${formatDateTime(q.resolvedAt)}` : ''}${q.resolvedBy && names.get(q.resolvedBy) ? ` by ${names.get(q.resolvedBy)?.name}` : ''}`
                    : 'Awaiting an answer'}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {resolved
                    ? 'The student cannot reply while this question is resolved.'
                    : `${q.replyCount} ${q.replyCount === 1 ? 'reply' : 'replies'} so far. Replies notify the student by email.`}
                </p>
              </div>
            </div>

            <section aria-label="Question">
              <h3 className="text-base font-semibold leading-snug text-ink">{q.title}</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{q.description}</p>
            </section>

            <section aria-label="Student and course" className="grid gap-2 sm:grid-cols-2">
              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-line p-3">
                <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold', ROLE_AVATAR.student)} aria-hidden>
                  {qaStudentInitials(q.student)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{qaStudentName(q.student)}</p>
                  {q.student?.email ? (
                    <a href={`mailto:${q.student.email}`} className="flex items-center gap-1 truncate text-xs text-ink-muted hover:text-primary">
                      <Mail className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">{q.student.email}</span>
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-3 rounded-lg border border-line p-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <BookOpen className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium text-ink">{q.course?.title ?? 'Course unavailable'}</p>
                  {q.course?.slug ? <p className="truncate font-mono text-[11px] text-ink-subtle">/{q.course.slug}</p> : null}
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Details</h3>
              <dl className="divide-y divide-line rounded-lg border border-line">
                <Meta label="Asked">{formatDateTime(q.createdAt)}</Meta>
                <Meta label="Last activity">{formatDateTime(q.lastActivityAt)}</Meta>
                <Meta label="Replies">{q.replyCount}</Meta>
                <Meta label="Resolved">{q.resolvedAt ? formatDateTime(q.resolvedAt) : 'Not yet'}</Meta>
                {q.lessonId ? (
                  <Meta label="Lesson">
                    <span className="font-mono text-xs">{q.lessonId}</span>
                  </Meta>
                ) : null}
                <Meta label="Question id">
                  <span className="font-mono text-xs">{q.id}</span>
                </Meta>
              </dl>
            </section>

            <section aria-label="Conversation">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                <MessageSquareText className="size-3.5" aria-hidden />
                Conversation
              </h3>
              {detail.isPlaceholderData ? (
                <Skeleton className="h-24 w-full" />
              ) : !q.replies.length ? (
                <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-subtle">
                  No replies yet. Be the first to answer this question.
                </p>
              ) : (
                <ol className="space-y-3">
                  {q.replies.map((reply) => {
                    const author = replyAuthor(reply);
                    return (
                      <li key={reply.id} className="rounded-lg border border-line p-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', ROLE_AVATAR[author.role])} aria-hidden>
                            {author.role === 'student' ? qaStudentInitials(q.student) : author.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="truncate text-sm font-medium text-ink">{author.name}</span>
                              <Badge tone={ROLE_TONE[author.role]}>{SENDER_ROLE_LABEL[author.role]}</Badge>
                            </p>
                            <p className="text-[11px] text-ink-subtle">
                              {formatDateTime(reply.createdAt)}
                              {reply.editedAt ? ' · edited' : ''}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-ink">{reply.message}</p>
                        {reply.attachments.length ? (
                          <ul className="mt-2.5 flex flex-wrap gap-2">
                            {reply.attachments.map((a, i) => (
                              <li key={a.id ?? i}>
                                {a.publicUrl ? (
                                  <a
                                    href={a.publicUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2/60 px-2 py-1 text-xs text-ink-muted hover:text-primary"
                                  >
                                    <Paperclip className="size-3" aria-hidden />
                                    {a.fileName || 'Attachment'}
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2/60 px-2 py-1 text-xs text-ink-muted">
                                    <Paperclip className="size-3" aria-hidden />
                                    {a.fileName || 'Attachment'}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {resolved ? (
              <div className="rounded-lg border border-dashed border-line px-4 py-4 text-center text-sm text-ink-muted">
                This question is resolved. Reopen it from the footer to reply or allow the student to respond.
              </div>
            ) : (
              <ReplyComposer question={q} />
            )}

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Activity</h3>
              {detail.isPlaceholderData ? (
                <Skeleton className="h-16 w-full" />
              ) : !q.auditLog?.length ? (
                <p className="text-sm text-ink-subtle">No activity recorded.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-line pl-4">
                  {[...q.auditLog].reverse().map((event, i) => (
                    <li key={`${event.at}-${i}`} className="relative">
                      <span
                        className={cn(
                          'absolute -left-[21px] top-1 size-2.5 rounded-full ring-2 ring-surface',
                          event.action === 'status_changed' && event.meta?.to === 'resolved'
                            ? 'bg-success'
                            : event.action === 'deleted'
                              ? 'bg-danger'
                              : 'bg-ink-subtle'
                        )}
                        aria-hidden
                      />
                      <p className="text-sm font-medium text-ink">{auditDescription(event)}</p>
                      <p className="text-xs text-ink-muted">
                        {formatDateTime(event.at)}
                        {event.actorId && names.get(event.actorId) ? ` · ${names.get(event.actorId)?.name}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </Dialog>

      {dialog === 'resolve' && q ? <QuestionStatusDialog question={q} target="resolved" onClose={() => setDialog(null)} onDone={onClose} /> : null}
      {dialog === 'reopen' && q ? <QuestionStatusDialog question={q} target="open" onClose={() => setDialog(null)} onDone={onClose} /> : null}
      {dialog === 'delete' && q ? <DeleteQuestionDialog question={q} onClose={() => setDialog(null)} onDone={onClose} /> : null}
    </>
  );
}
