'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Clock, ListChecks, Plus, Search, Target, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/cn';
import { formatDate, formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { hasPermissions } from '@/lib/roles';
import { QUIZ_STATUSES, type Quiz, type QuizListParams, type QuizStatus } from '@/types/quizzes';
import { useCourseOptions } from '@/features/enrollments/hooks';
import { quizPolicy, useQuizList } from '../hooks';
import { formatDuration, formatMarks, QuizStatusBadge, quizStatusLabel } from '../display';
import { QuizFormDialog } from './quiz-form-dialog';
import { QuizWorkspace } from './quiz-workspace';

const PAGE_SIZES = [10, 20, 50];

const SORTS = {
  newest: { sortBy: 'createdAt', sortOrder: 'desc', label: 'Newest first' },
  oldest: { sortBy: 'createdAt', sortOrder: 'asc', label: 'Oldest first' },
  title: { sortBy: 'title', sortOrder: 'asc', label: 'Title A–Z' },
  marks: { sortBy: 'totalMarks', sortOrder: 'desc', label: 'Highest marks' },
} as const satisfies Record<string, { sortBy: QuizListParams['sortBy']; sortOrder: 'asc' | 'desc'; label: string }>;
type SortKey = keyof typeof SORTS;

interface Filters {
  search: string;
  status: QuizStatus | '';
  courseId: string;
  sort: SortKey;
}

function attemptsLabel(q: Quiz): string {
  if (q.unlimitedAttempts) return 'Unlimited';
  return `${q.maximumAttempts} attempt${q.maximumAttempts === 1 ? '' : 's'}`;
}

export function QuizzesPanel({ initialStatus }: { initialStatus?: QuizStatus }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const empty: Filters = { search: '', status: '', courseId: '', sort: 'newest' };
  const [filters, setFilters] = useState<Filters>({ ...empty, status: initialStatus ?? '' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [open, setOpen] = useState<Quiz | null>(null);
  const [creating, setCreating] = useState(false);
  const debounced = useDebouncedValue(filters.search.trim(), 400);

  const canReadCourses = hasPermissions(user, ['courses.read']);
  const courses = useCourseOptions('', canReadCourses, 100);
  const courseTitle = new Map((courses.data?.data ?? []).map((c) => [c.id, c.title]));
  const sort = SORTS[filters.sort];

  const params: QuizListParams = {
    page,
    limit,
    search: debounced || undefined,
    status: filters.status || undefined,
    courseId: filters.courseId || undefined,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
  };
  const list = useQuizList(params);
  const rows = list.data?.quizzes ?? [];
  const filtersActive = Boolean(filters.search || filters.status || filters.courseId);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function retryFailed() {
    void queryClient.refetchQueries({ queryKey: queryKeys.quizzes.lists(), type: 'active', predicate: (q) => q.state.status === 'error' });
  }

  const courseOf = (q: Quiz) => courseTitle.get(q.courseId) ?? (canReadCourses && !courses.isPending ? 'Unknown course' : 'Course');

  return (
    <>
      <Card className="min-w-0">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input type="search" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Search quiz title" className="pl-9" aria-label="Search quizzes" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value as Filters['status'])} className="sm:w-36" aria-label="Filter by status">
              <option value="">All statuses</option>
              {QUIZ_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {quizStatusLabel(s)}
                </option>
              ))}
            </Select>
            {canReadCourses ? (
              <Select value={filters.courseId} onChange={(e) => setFilter('courseId', e.target.value)} className="sm:w-52" aria-label="Filter by course" disabled={courses.isPending}>
                <option value="">All courses</option>
                {(courses.data?.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            ) : null}
            <Select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value as SortKey)} className="sm:w-40" aria-label="Sort quizzes">
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
                  setFilters((f) => ({ ...empty, sort: f.sort }));
                  setPage(1);
                }}
              >
                <X className="size-4" aria-hidden />
                Clear
              </Button>
            ) : null}
            {quizPolicy.canCreate(user) ? (
              <Button onClick={() => setCreating(true)} className="col-span-2 sm:col-span-1">
                <Plus className="size-4" aria-hidden />
                New quiz
              </Button>
            ) : null}
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={retryFailed} />
        ) : !list.isPending && rows.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="size-5" aria-hidden />}
            title={filtersActive ? 'No quizzes match these filters' : 'No quizzes yet'}
            description={filtersActive ? 'Try a different search or filter.' : 'Quizzes created for courses will appear here.'}
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-4 pr-3 sm:pl-5">Quiz</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Course</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Marks</th>
                    <th scope="col" className="hidden px-3 py-2.5 text-right xl:table-cell">Pass mark</th>
                    <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">Time limit</th>
                    <th scope="col" className="hidden px-3 py-2.5 2xl:table-cell">Attempts</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 2xl:table-cell">Updated</th>
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
                            <Skeleton className="h-4 w-52" />
                            <Skeleton className="mt-1.5 h-3 w-28" />
                          </td>
                          <td className="hidden px-3 py-3 lg:table-cell">
                            <Skeleton className="h-4 w-32" />
                          </td>
                          <td className="px-3 py-3">
                            <Skeleton className="ml-auto h-4 w-8" />
                          </td>
                          <td className="hidden px-3 py-3 xl:table-cell">
                            <Skeleton className="ml-auto h-4 w-10" />
                          </td>
                          <td className="hidden px-3 py-3 xl:table-cell">
                            <Skeleton className="h-4 w-14" />
                          </td>
                          <td className="hidden px-3 py-3 2xl:table-cell">
                            <Skeleton className="h-4 w-16" />
                          </td>
                          <td className="px-3 py-3">
                            <Skeleton className="h-5 w-20" />
                          </td>
                          <td className="hidden px-3 py-3 2xl:table-cell">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="py-3 pl-3 pr-4 sm:pr-5" />
                        </tr>
                      ))
                    : rows.map((q) => (
                        <tr key={q.id} className="group transition-colors hover:bg-surface-2/50">
                          <td className="w-full max-w-0 py-3 pl-4 pr-3 sm:pl-5">
                            <button type="button" onClick={() => setOpen(q)} className="block w-full min-w-0 text-left">
                              <span className="block truncate font-medium text-ink group-hover:text-primary">{q.title}</span>
                              <span className="mt-0.5 block truncate text-xs text-ink-muted">
                                <span className="lg:hidden">{courseOf(q)} · </span>
                                {q.questionSelectionMode === 'random_count' && q.questionsToSelect ? `${q.questionsToSelect} random questions` : 'All questions'}
                                {q.negativeMarkingEnabled ? ' · negative marking' : ''}
                                {q.tags.length ? ` · ${q.tags.slice(0, 3).join(', ')}` : ''}
                              </span>
                            </button>
                          </td>
                          <td className="hidden max-w-56 truncate px-3 py-3 text-ink-muted lg:table-cell">{courseOf(q)}</td>
                          <td className="w-px whitespace-nowrap px-3 py-3 text-right tabular-nums text-ink">{formatMarks(q.totalMarks)}</td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3 text-right tabular-nums text-ink-muted xl:table-cell">{q.passingPercentage}%</td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3 text-ink-muted xl:table-cell">{formatDuration(q.timeLimitSeconds)}</td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3 text-ink-muted 2xl:table-cell">{attemptsLabel(q)}</td>
                          <td className="w-px px-3 py-3">
                            <QuizStatusBadge status={q.status} />
                          </td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3 text-xs text-ink-muted 2xl:table-cell">{formatDate(q.updatedAt)}</td>
                          <td className="w-px whitespace-nowrap py-3 pl-3 pr-4 text-right sm:pr-5">
                            <Button size="sm" variant="secondary" onClick={() => setOpen(q)}>
                              Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            <ul className={cn('divide-y divide-line md:hidden', list.isPlaceholderData && 'opacity-60')}>
              {list.isPending
                ? Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="space-y-2 p-4">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </li>
                  ))
                : rows.map((q) => (
                    <li key={q.id}>
                      <button type="button" onClick={() => setOpen(q)} className="block w-full space-y-2 p-3 text-left sm:p-4">
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{q.title}</span>
                            <span className="block truncate text-xs text-ink-muted">{courseOf(q)}</span>
                          </span>
                          <QuizStatusBadge status={q.status} />
                        </span>
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                          <span>{formatMarks(q.totalMarks)} marks</span>
                          <span className="inline-flex items-center gap-1">
                            <Target className="size-3.5" aria-hidden />
                            {q.passingPercentage}% to pass
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3.5" aria-hidden />
                            {formatDuration(q.timeLimitSeconds)}
                          </span>
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

      {open ? <QuizWorkspace key={open.id} quiz={open} courseTitle={courseTitle.get(open.courseId)} onClose={() => setOpen(null)} onOpenQuiz={setOpen} /> : null}
      {creating ? (
        <QuizFormDialog
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={(created) => {
            setCreating(false);
            setOpen(created);
          }}
        />
      ) : null}
      <span className="sr-only" aria-live="polite">
        {list.data ? `${formatNumber(list.data.pagination.total)} quizzes` : ''}
      </span>
    </>
  );
}
