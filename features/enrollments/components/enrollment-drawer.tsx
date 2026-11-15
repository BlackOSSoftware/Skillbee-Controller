'use client';

import { ArrowRight, CheckCircle2, Circle, CircleDot, FileText, History, Layers, ListChecks, PlayCircle, Radio, RefreshCw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/cn';
import { formatDate, formatRelative, titleCase } from '@/lib/format';
import { hasPermissions } from '@/lib/roles';
import type { Enrollment, EnrollmentHistory, EnrollmentProgress, EnrollmentStatus } from '@/types/enrollments';
import { useEnrollmentHistory, useEnrollmentProgress, useHistoryActors } from '../hooks';
import { completionLabel, EnrollmentStatusBadge, Initials, ProgressBar, statusLabel, typeLabel } from '../display';

type Tab = 'progress' | 'history';

const LESSON_ICONS = { video: PlayCircle, text: FileText, live: Radio, resource: Layers } as const;

const ACTION_LABELS: Record<EnrollmentHistory['history'][number]['action'], string> = {
  created: 'Enrollment created',
  updated: 'Enrollment updated',
  status_changed: 'Status changed',
  revoked: 'Access revoked',
  reactivated: 'Re-enrolled',
  expired: 'Access expired',
  progress_recalculated: 'Progress recalculated',
  completed: 'Course completed',
  suspended: 'Enrollment suspended',
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-ink">{children}</dd>
    </div>
  );
}

function ProgressTab({ enrollmentId }: { enrollmentId: string }) {
  const progress = useEnrollmentProgress(enrollmentId, true);
  if (progress.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (progress.isError) return <ErrorState error={progress.error} onRetry={() => progress.refetch()} />;
  const p: EnrollmentProgress = progress.data;
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-line p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-ink-muted">Course progress</p>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">{Math.round(p.progressPercentage)}%</p>
          </div>
          <div className="text-right text-xs text-ink-muted">
            <p>
              {p.completedLessonsCount} of {p.totalRequiredLessons} required lessons
            </p>
            <p className="mt-0.5">{completionLabel(p.courseCompletionStatus)}</p>
          </div>
        </div>
        <ProgressBar value={p.progressPercentage} size="md" className="mt-3" />
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
          <Fact label="Last activity">{p.lastAccessedAt ? formatRelative(p.lastAccessedAt) : 'No activity yet'}</Fact>
          <Fact label="Completed">{formatDate(p.completedAt)}</Fact>
        </dl>
      </div>

      {p.nextIncompleteLesson ? (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 text-sm">
          <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0">
            <span className="block text-[11px] text-ink-subtle">Next lesson</span>
            <span className="block truncate font-medium text-ink">{p.nextIncompleteLesson.title}</span>
          </span>
        </div>
      ) : null}

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
          <ListChecks className="size-3.5" aria-hidden />
          Required lessons
        </h3>
        {p.lessons.length === 0 ? (
          <p className="rounded-lg border border-dashed border-field-border px-3 py-6 text-center text-xs text-ink-subtle">
            This course has no published required lessons yet, so progress cannot advance.
          </p>
        ) : (
          <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {p.lessons.map((l, i) => {
              const Icon = LESSON_ICONS[l.type] ?? FileText;
              const StateIcon = l.completionStatus === 'completed' ? CheckCircle2 : l.completionStatus === 'in_progress' ? CircleDot : Circle;
              return (
                <li key={l.lessonId} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="w-5 shrink-0 text-right text-[11px] text-ink-subtle">{i + 1}</span>
                  <Icon className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-ink">{l.title}</span>
                  <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs', l.completionStatus === 'completed' ? 'text-success' : l.completionStatus === 'in_progress' ? 'text-primary' : 'text-ink-subtle')}>
                    <StateIcon className="size-3.5" aria-hidden />
                    {l.completionStatus === 'completed' ? formatDate(l.completedAt) : titleCase(l.completionStatus)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function HistoryTab({ enrollmentId }: { enrollmentId: string }) {
  const { user } = useAuth();
  const history = useEnrollmentHistory(enrollmentId, true);
  const events = [...(history.data?.history ?? [])].reverse();
  const canReadUsers = hasPermissions(user, ['users:read']);
  const actorIds = events.map((e) => e.actorId).filter((id): id is string => Boolean(id) && id !== user?.id);
  const actors = useHistoryActors(actorIds, canReadUsers && history.isSuccess);

  if (history.isPending) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  if (history.isError) return <ErrorState error={history.error} onRetry={() => history.refetch()} />;
  if (!events.length) return <EmptyState icon={<History className="size-5" aria-hidden />} title="No history yet" />;

  function actorName(id: string | null): string {
    if (!id) return 'System';
    if (id === user?.id) return 'You';
    return actors.get(id) ?? 'Administrator';
  }

  return (
    <ol className="relative space-y-5 border-l border-line pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[25px] top-1 size-2.5 rounded-full border-2 border-surface bg-ink-subtle ring-1 ring-line" aria-hidden />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium text-ink">{ACTION_LABELS[e.action] ?? titleCase(e.action)}</p>
            {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus ? (
              <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                <Badge>{statusLabel(e.fromStatus as EnrollmentStatus)}</Badge>
                <ArrowRight className="size-3" aria-hidden />
                <Badge>{statusLabel(e.toStatus as EnrollmentStatus)}</Badge>
              </span>
            ) : null}
          </div>
          {e.reason ? <p className="mt-1 text-xs text-ink-muted">“{e.reason}”</p> : null}
          <p className="mt-1 text-[11px] text-ink-subtle">
            {actorName(e.actorId)} · {formatDate(e.at)} {new Date(e.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </li>
      ))}
    </ol>
  );
}

interface EnrollmentDrawerProps {
  enrollment: Enrollment;
  onClose: () => void;
  onChangeStatus: (enrollment: Enrollment) => void;
}

export function EnrollmentDrawer({ enrollment: e, onClose, onChangeStatus }: EnrollmentDrawerProps) {
  const [tab, setTab] = useState<Tab>('progress');
  const name = e.student ? [e.student.firstName, e.student.lastName].filter(Boolean).join(' ') || e.student.email : 'Unknown learner';

  return (
    <Dialog
      open
      onClose={onClose}
      placement="right"
      title="Learner enrollment"
      description={e.course?.title ?? 'Course'}
      toolbar={
        <div className="flex items-center justify-between gap-3">
          <div role="tablist" aria-label="Enrollment sections" className="inline-flex rounded-md border border-line bg-surface-2/60 p-0.5">
            {(['progress', 'history'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn('rounded px-3 py-1 text-xs font-medium transition-colors', tab === t ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink')}
              >
                {t === 'progress' ? 'Progress' : 'History'}
              </button>
            ))}
          </div>
          <Button size="sm" variant="secondary" onClick={() => onChangeStatus(e)}>
            <RefreshCw className="size-3.5" aria-hidden />
            Change status
          </Button>
        </div>
      }
    >
      <div className="mb-5 flex items-center gap-3">
        <Initials firstName={e.student?.firstName} lastName={e.student?.lastName} email={e.student?.email} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">{name}</p>
          <p className="truncate text-sm text-ink-muted">{e.student?.email}</p>
        </div>
        <EnrollmentStatusBadge status={e.status} />
      </div>
      <dl className="mb-6 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-line p-4">
        <Fact label="Course">{e.course?.title ?? '—'}</Fact>
        <Fact label="Type">{typeLabel(e.enrollmentType)}</Fact>
        <Fact label="Enrolled">{formatDate(e.enrolledAt)}</Fact>
        <Fact label="Access expires">{e.enrollmentExpiresAt ? formatDate(e.enrollmentExpiresAt) : 'Never'}</Fact>
        {e.revokedAt ? <Fact label="Revoked">{formatDate(e.revokedAt)}</Fact> : null}
        {e.revocationReason ? <Fact label="Reason">{e.revocationReason}</Fact> : null}
      </dl>
      {tab === 'progress' ? <ProgressTab enrollmentId={e.id} /> : <HistoryTab enrollmentId={e.id} />}
    </Dialog>
  );
}
