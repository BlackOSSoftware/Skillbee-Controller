'use client';

import { useQueryClient } from '@tanstack/react-query';
import { BookCheck, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/query-keys';
import { hasPermissions } from '@/lib/roles';
import { ATTEMPT_STATUSES, type AttemptListParams, type AttemptStatus, type QuizAttemptRow } from '@/types/quizzes';
import { formatDateTime } from '@/features/assignments/display';
import { Initials } from '@/features/enrollments/display';
import { useCourseOptions, useStudentOptions } from '@/features/enrollments/hooks';
import { quizPolicy, useAttemptLearners, useAttemptsList, useQuizCatalog, useQuizLookup, type Learner } from '../hooks';
import { AttemptStatusBadge, attemptStatusLabel, formatMarks, formatPercent, ResultBadge, ScoreBar } from '../display';
import type { AttemptPreset } from './quiz-management';
import { AttemptReviewDialog } from './attempt-review-dialog';

const PAGE_SIZES = [10, 20, 50];

const SORTS = {
  newest: { sortBy: 'createdAt', sortOrder: 'desc', label: 'Newest first' },
  submitted: { sortBy: 'submittedAt', sortOrder: 'desc', label: 'Recently submitted' },
  scoreHigh: { sortBy: 'percentage', sortOrder: 'desc', label: 'Highest score' },
  scoreLow: { sortBy: 'percentage', sortOrder: 'asc', label: 'Lowest score' },
  oldest: { sortBy: 'createdAt', sortOrder: 'asc', label: 'Oldest first' },
} as const satisfies Record<string, { sortBy: AttemptListParams['sortBy']; sortOrder: 'asc' | 'desc'; label: string }>;
type SortKey = keyof typeof SORTS;

interface Filters {
  quizId: string;
  courseId: string;
  status: AttemptStatus | '';
  passed: '' | 'true' | 'false';
  student: { id: string; name: string } | null;
  from: string;
  to: string;
  sort: SortKey;
}

const EMPTY: Filters = { quizId: '', courseId: '', status: '', passed: '', student: null, from: '', to: '', sort: 'newest' };

/** `<input type="date">` gives local calendar days; the API filters `createdAt` with ISO bounds. */
function dayBound(day: string, end: boolean): string | undefined {
  if (!day) return undefined;
  const d = new Date(`${day}T00:00:00`);
  if (end) {
    d.setDate(d.getDate() + 1);
    d.setMilliseconds(-1);
  }
  return d.toISOString();
}

function StudentFilter({ value, onChange, disabled }: { value: Filters['student']; onChange: (v: Filters['student']) => void; disabled: boolean }) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(term.trim(), 300);
  const options = useStudentOptions(debounced, open && debounced.length >= 2);

  if (value) {
    return (
      <span className="flex h-10 min-w-0 items-center gap-2 rounded-md border border-primary/40 bg-primary/[0.04] pl-3 pr-1 text-sm text-ink sm:w-52">
        <UserRound className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{value.name}</span>
        <button type="button" onClick={() => onChange(null)} className="rounded p-1 text-ink-subtle hover:bg-surface-2 hover:text-ink" aria-label="Clear student filter">
          <X className="size-3.5" aria-hidden />
        </button>
      </span>
    );
  }
  const users = options.data?.users ?? [];
  return (
    <div className="relative sm:w-52">
      <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
      <Input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Filter by learner"
        className="pl-9"
        aria-label="Filter by learner"
        disabled={disabled}
        role="combobox"
        aria-expanded={open && debounced.length >= 2}
        aria-controls="attempt-student-options"
      />
      {open && debounced.length >= 2 ? (
        <ul id="attempt-student-options" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-pop">
          {options.isPending ? (
            <li className="px-3 py-2 text-xs text-ink-muted">Searching…</li>
          ) : options.isError ? (
            <li className="px-3 py-2 text-xs text-danger">Could not search learners.</li>
          ) : users.length === 0 ? (
            <li className="px-3 py-2 text-xs text-ink-muted">No learners found.</li>
          ) : (
            users.map((u) => {
              const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
              return (
                <li key={u.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange({ id: u.id, name });
                      setTerm('');
                      setOpen(false);
                    }}
                    className="block w-full px-3 py-1.5 text-left hover:bg-surface-2"
                  >
                    <span className="block truncate text-sm text-ink">{name}</span>
                    <span className="block truncate text-[11px] text-ink-muted">{u.email}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

function Score({ row, passMark }: { row: QuizAttemptRow; passMark?: number }) {
  const scored = row.percentage !== null && row.status !== 'in_progress';
  return (
    <div className="w-36">
      <div className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
        <span>
          <span className="font-semibold text-ink">{scored ? formatMarks(row.obtainedMarks) : '—'}</span>
          <span className="text-ink-subtle">/{formatMarks(row.totalMarks)}</span>
        </span>
        <span className="text-xs text-ink-muted">{scored ? formatPercent(row.percentage) : ''}</span>
      </div>
      <ScoreBar percentage={scored ? row.percentage : null} passMark={passMark} className="mt-1.5" />
    </div>
  );
}

export function AttemptsPanel({ preset }: { preset: AttemptPreset }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({ ...EMPTY, quizId: preset.quizId ?? '', status: preset.status ?? '' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [open, setOpen] = useState<QuizAttemptRow | null>(null);

  const canReadUsers = hasPermissions(user, ['users:read']);
  const canReadCourses = hasPermissions(user, ['courses.read']);
  const canGrade = quizPolicy.canGrade(user);
  const catalog = useQuizCatalog(true);
  const courses = useCourseOptions('', canReadCourses, 100);
  const courseTitle = new Map((courses.data?.data ?? []).map((c) => [c.id, c.title]));
  const sort = SORTS[filters.sort];

  const params: AttemptListParams = {
    page,
    limit,
    quizId: filters.quizId || undefined,
    courseId: filters.courseId || undefined,
    studentId: filters.student?.id,
    status: filters.status || undefined,
    passed: filters.passed ? filters.passed === 'true' : undefined,
    startDate: dayBound(filters.from, false),
    endDate: dayBound(filters.to, true),
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
  };
  const rangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);
  const list = useAttemptsList(params, !rangeInvalid);
  const rows = list.data?.attempts ?? [];
  const learners = useAttemptLearners(rows, canReadUsers);
  const quizzes = useQuizLookup(
    rows.map((r) => r.quizId),
    catalog.byId,
    !catalog.query.isPending
  );
  const filtersActive = JSON.stringify({ ...filters, sort: 'newest' }) !== JSON.stringify(EMPTY);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function retryFailed() {
    void queryClient.refetchQueries({ queryKey: queryKeys.quizzes.attemptLists(), type: 'active', predicate: (q) => q.state.status === 'error' });
  }

  const learnerOf = (r: QuizAttemptRow): Learner | undefined => learners.byId.get(r.studentId);
  const learnerName = (r: QuizAttemptRow) => learnerOf(r)?.name ?? (learners.isPending ? 'Loading…' : `Learner ${r.studentId.slice(-6)}`);
  const quizTitle = (r: QuizAttemptRow) => quizzes.get(r.quizId)?.title ?? (catalog.query.isPending ? 'Loading…' : 'Quiz');
  const actionLabel = (r: QuizAttemptRow) => (canGrade && r.status === 'evaluating' ? 'Grade' : 'Review');

  return (
    <>
      <Card className="min-w-0">
        <div className="space-y-2 border-b border-line p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
            <Select value={filters.quizId} onChange={(e) => setFilter('quizId', e.target.value)} className="lg:w-56" aria-label="Filter by quiz" disabled={catalog.query.isPending}>
              <option value="">All quizzes</option>
              {(catalog.query.data?.quizzes ?? []).map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </Select>
            {canReadCourses ? (
              <Select value={filters.courseId} onChange={(e) => setFilter('courseId', e.target.value)} className="lg:w-52" aria-label="Filter by course" disabled={courses.isPending}>
                <option value="">All courses</option>
                {(courses.data?.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            ) : null}
            {canReadUsers ? <StudentFilter value={filters.student} onChange={(v) => setFilter('student', v)} disabled={false} /> : null}
            <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value as Filters['status'])} className="lg:w-40" aria-label="Filter by status">
              <option value="">All statuses</option>
              {ATTEMPT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {attemptStatusLabel(s)}
                </option>
              ))}
            </Select>
            <Select value={filters.passed} onChange={(e) => setFilter('passed', e.target.value as Filters['passed'])} className="lg:w-32" aria-label="Filter by result">
              <option value="">Any result</option>
              <option value="true">Passed</option>
              <option value="false">Failed</option>
            </Select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2">
              <Input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} className="sm:w-40" aria-label="Started from" aria-invalid={rangeInvalid} />
              <span className="text-xs text-ink-subtle">to</span>
              <Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} className="sm:w-40" aria-label="Started until" aria-invalid={rangeInvalid} />
            </div>
            <Select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value as SortKey)} className="sm:w-44" aria-label="Sort attempts">
              {Object.entries(SORTS).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </Select>
            {filtersActive ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setFilters((f) => ({ ...EMPTY, sort: f.sort }));
                  setPage(1);
                }}
              >
                <X className="size-4" aria-hidden />
                Clear filters
              </Button>
            ) : null}
            {rangeInvalid ? <p className="text-xs text-danger">The start date must be on or before the end date.</p> : null}
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={retryFailed} />
        ) : !list.isPending && rows.length === 0 ? (
          <EmptyState
            icon={<BookCheck className="size-5" aria-hidden />}
            title={filtersActive ? 'No attempts match these filters' : 'No attempts yet'}
            description={filtersActive ? 'Try a different quiz, learner, status or date range.' : 'Attempts appear here as soon as learners start a published quiz.'}
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-4 pr-3 sm:pl-5">Learner</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Quiz</th>
                    <th scope="col" className="px-3 py-2.5">Score</th>
                    <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">Result</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">Submitted</th>
                    <th scope="col" className="py-2.5 pl-3 pr-4 sm:pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3 pl-4 pr-3 sm:pl-5">
                            <div className="flex items-center gap-3">
                              <Skeleton className="size-8 rounded-full" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-40" />
                              </div>
                            </div>
                          </td>
                          <td className="hidden px-3 py-3 lg:table-cell">
                            <Skeleton className="h-4 w-40" />
                          </td>
                          <td className="px-3 py-3">
                            <Skeleton className="h-4 w-32" />
                          </td>
                          <td className="hidden px-3 py-3 xl:table-cell">
                            <Skeleton className="h-4 w-12" />
                          </td>
                          <td className="px-3 py-3">
                            <Skeleton className="h-5 w-24" />
                          </td>
                          <td className="hidden px-3 py-3 xl:table-cell">
                            <Skeleton className="h-4 w-28" />
                          </td>
                          <td className="py-3 pl-3 pr-4 sm:pr-5" />
                        </tr>
                      ))
                    : rows.map((r) => {
                        const learner = learnerOf(r);
                        const quiz = quizzes.get(r.quizId);
                        return (
                          <tr key={r.id} className="group transition-colors hover:bg-surface-2/50">
                            <td className="w-full max-w-0 py-3 pl-4 pr-3 sm:pl-5">
                              <button type="button" onClick={() => setOpen(r)} className="flex w-full min-w-0 items-center gap-3 text-left">
                                <Initials firstName={learner?.name.split(' ')[0]} lastName={learner?.name.split(' ').slice(1).join(' ')} email={learner?.email} />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-ink group-hover:text-primary">{learnerName(r)}</span>
                                  <span className="block truncate text-xs text-ink-muted">
                                    <span className="lg:hidden">{quizTitle(r)} · </span>
                                    {learner?.email ? <span className="hidden lg:inline">{learner.email} · </span> : null}
                                    Attempt {r.attemptNumber}
                                  </span>
                                </span>
                              </button>
                            </td>
                            <td className="hidden max-w-64 px-3 py-3 lg:table-cell">
                              <span className="block truncate text-ink">{quizTitle(r)}</span>
                              <span className="block truncate text-xs text-ink-muted">{courseTitle.get(r.courseId) ?? ''}</span>
                            </td>
                            <td className="w-px px-3 py-3">
                              <Score row={r} passMark={quiz?.passingPercentage} />
                            </td>
                            <td className="hidden w-px px-3 py-3 xl:table-cell">
                              <ResultBadge passed={r.status === 'in_progress' ? null : r.passed} pending={r.status === 'evaluating' || r.status === 'submitted'} />
                            </td>
                            <td className="w-px px-3 py-3">
                              <AttemptStatusBadge status={r.status} />
                            </td>
                            <td className="hidden w-px whitespace-nowrap px-3 py-3 text-xs text-ink-muted xl:table-cell">{r.submittedAt ? formatDateTime(r.submittedAt) : <span className="text-ink-subtle">Started {formatDateTime(r.startedAt)}</span>}</td>
                            <td className="w-px whitespace-nowrap py-3 pl-3 pr-4 text-right sm:pr-5">
                              <Button size="sm" variant={actionLabel(r) === 'Grade' ? 'primary' : 'secondary'} onClick={() => setOpen(r)}>
                                {actionLabel(r)}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            <ul className={cn('divide-y divide-line md:hidden', list.isPlaceholderData && 'opacity-60')}>
              {list.isPending
                ? Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="space-y-2 p-4">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </li>
                  ))
                : rows.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => setOpen(r)} className="block w-full space-y-2.5 p-3 text-left sm:p-4">
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{learnerName(r)}</span>
                            <span className="block truncate text-xs text-ink-muted">
                              {quizTitle(r)} · attempt {r.attemptNumber}
                            </span>
                          </span>
                          <AttemptStatusBadge status={r.status} />
                        </span>
                        <span className="flex items-end justify-between gap-3">
                          <Score row={r} passMark={quizzes.get(r.quizId)?.passingPercentage} />
                          <ResultBadge passed={r.status === 'in_progress' ? null : r.passed} pending={r.status === 'evaluating' || r.status === 'submitted'} />
                        </span>
                      </button>
                    </li>
                  ))}
            </ul>
          </>
        )}

        <Pagination
          meta={list.data?.pagination}
          onPageChange={setPage}
          disabled={list.isFetching}
          pageSizeOptions={PAGE_SIZES}
          onPageSizeChange={(size) => {
            setLimit(size);
            setPage(1);
          }}
        />
      </Card>

      {open ? (
        <AttemptReviewDialog
          key={open.id}
          attempt={open}
          learner={learnerOf(open)}
          quiz={quizzes.get(open.quizId)}
          courseTitle={courseTitle.get(open.courseId)}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}
