'use client';

import { BookCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/cn';
import { hasPermissions } from '@/lib/roles';
import { ATTEMPT_STATUSES, type AttemptStatus, type Quiz, type QuizAttemptRow } from '@/types/quizzes';
import { formatDateTime } from '@/features/assignments/display';
import { Initials } from '@/features/enrollments/display';
import { quizPolicy, useAttemptLearners, useQuizAttempts } from '../hooks';
import { AttemptStatusBadge, attemptStatusLabel, formatMarks, formatPercent, ResultBadge, ScoreBar } from '../display';
import { AttemptReviewDialog } from './attempt-review-dialog';

export function QuizAttemptsTab({ quiz, courseTitle }: { quiz: Quiz; courseTitle?: string }) {
  const { user } = useAuth();
  const canRead = quizPolicy.canReadAttempts(user);
  const canGrade = quizPolicy.canGrade(user);
  const [status, setStatus] = useState<AttemptStatus | ''>('');
  const [passed, setPassed] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<QuizAttemptRow | null>(null);
  const params = { page, limit: 10, status: status || undefined, passed: passed ? passed === 'true' : undefined, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };
  const list = useQuizAttempts(quiz.id, params, canRead);
  const rows = list.data?.attempts ?? [];
  const learners = useAttemptLearners(rows, hasPermissions(user, ['users:read']));

  if (!canRead) return <EmptyState title="No access to attempts" description="Viewing attempts needs the quizzes.attempts.read permission." />;

  return (
    <section className="min-w-0 rounded-lg border border-line" aria-label="Attempts">
      <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">Attempts for this quiz</h3>
          <p className="text-xs text-ink-muted">{list.data ? `${list.data.pagination.total} ${status || passed ? 'matching' : 'total'}` : ' '}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as AttemptStatus | '');
              setPage(1);
            }}
            className="sm:w-40"
            aria-label="Filter attempts by status"
          >
            <option value="">All statuses</option>
            {ATTEMPT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {attemptStatusLabel(s)}
              </option>
            ))}
          </Select>
          <Select
            value={passed}
            onChange={(e) => {
              setPassed(e.target.value as '' | 'true' | 'false');
              setPage(1);
            }}
            className="sm:w-32"
            aria-label="Filter attempts by result"
          >
            <option value="">Any result</option>
            <option value="true">Passed</option>
            <option value="false">Failed</option>
          </Select>
        </div>
      </div>

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.isPending && !rows.length ? (
        <EmptyState icon={<BookCheck className="size-5" aria-hidden />} title={status || passed ? 'No attempts match these filters' : 'No attempts yet'} description={quiz.status === 'published' ? 'Attempts appear when learners start this quiz.' : 'Learners can attempt the quiz once it is published.'} />
      ) : (
        <ul className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
          {list.isPending
            ? Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                </li>
              ))
            : rows.map((r) => {
                const learner = learners.byId.get(r.studentId);
                const scored = r.status !== 'in_progress' && r.percentage !== null;
                const pending = r.status === 'evaluating' || r.status === 'submitted';
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                    <Initials firstName={learner?.name.split(' ')[0]} lastName={learner?.name.split(' ').slice(1).join(' ')} email={learner?.email} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{learner?.name ?? (learners.isPending ? 'Loading…' : `Learner ${r.studentId.slice(-6)}`)}</span>
                      <span className="block truncate text-xs text-ink-muted">
                        Attempt {r.attemptNumber} · {r.submittedAt ? formatDateTime(r.submittedAt) : `started ${formatDateTime(r.startedAt)}`}
                      </span>
                    </span>
                    <span className="w-32">
                      <span className="flex items-baseline justify-between text-sm tabular-nums">
                        <span>
                          <span className="font-semibold text-ink">{scored ? formatMarks(r.obtainedMarks) : '—'}</span>
                          <span className="text-ink-subtle">/{formatMarks(r.totalMarks)}</span>
                        </span>
                        <span className="text-xs text-ink-muted">{scored ? formatPercent(r.percentage) : ''}</span>
                      </span>
                      <ScoreBar percentage={scored ? r.percentage : null} passMark={quiz.passingPercentage} className="mt-1" />
                    </span>
                    <span className="w-16 text-right">
                      <ResultBadge passed={r.status === 'in_progress' ? null : r.passed} pending={pending} />
                    </span>
                    <span className="w-28">
                      <AttemptStatusBadge status={r.status} />
                    </span>
                    <Button size="sm" variant={canGrade && r.status === 'evaluating' ? 'primary' : 'secondary'} onClick={() => setOpen(r)}>
                      {canGrade && r.status === 'evaluating' ? 'Grade' : 'Review'}
                    </Button>
                  </li>
                );
              })}
        </ul>
      )}
      <Pagination meta={list.data?.pagination} onPageChange={setPage} disabled={list.isFetching} />

      {open ? <AttemptReviewDialog key={open.id} attempt={open} learner={learners.byId.get(open.studentId)} quiz={quiz} courseTitle={courseTitle} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}
