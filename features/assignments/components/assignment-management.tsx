'use client';

import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ClipboardList, FilePen, Lock, Megaphone, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { KpiCard, type KpiTone } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { hasPermissions } from '@/lib/roles';
import { ASSIGNMENT_STATUSES, type Assignment, type AssignmentListParams, type AssignmentStatus } from '@/types/assignments';
import { useCourseOptions } from '@/features/enrollments/hooks';
import { assignmentPolicy, useAssignmentsList, useAssignmentStats, type AssignmentStatKey } from '../hooks';
import { AssignmentStatusBadge, assignmentStatusLabel, DueDate, submissionTypeLabel } from '../display';
import { AssignmentFormDialog } from './assignment-form-dialog';
import { AssignmentWorkspace } from './assignment-workspace';

const PAGE_SIZES = [10, 20, 50];

const STAT_CARDS: Array<{ key: AssignmentStatKey; label: string; icon: typeof ClipboardList; tone: KpiTone }> = [
  { key: 'all', label: 'All assignments', icon: ClipboardList, tone: 'purple' },
  { key: 'published', label: 'Published', icon: Megaphone, tone: 'teal' },
  { key: 'draft', label: 'Drafts', icon: FilePen, tone: 'sky' },
  { key: 'closed', label: 'Closed', icon: Lock, tone: 'coral' },
];

const SORTS = {
  newest: { sortBy: 'createdAt', sortOrder: 'desc', label: 'Newest first' },
  dueSoon: { sortBy: 'dueDate', sortOrder: 'asc', label: 'Due date (soonest)' },
  dueLate: { sortBy: 'dueDate', sortOrder: 'desc', label: 'Due date (latest)' },
  title: { sortBy: 'title', sortOrder: 'asc', label: 'Title A–Z' },
  marks: { sortBy: 'maximumMarks', sortOrder: 'desc', label: 'Highest marks' },
} as const satisfies Record<string, { sortBy: AssignmentListParams['sortBy']; sortOrder: 'asc' | 'desc'; label: string }>;
type SortKey = keyof typeof SORTS;

type DueWindow = '' | 'week' | 'overdue';

function dueRange(window: DueWindow, now: number): Pick<AssignmentListParams, 'dueAfter' | 'dueBefore'> {
  if (window === 'week') return { dueAfter: new Date(now).toISOString(), dueBefore: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString() };
  if (window === 'overdue') return { dueBefore: new Date(now).toISOString() };
  return {};
}

interface Filters {
  search: string;
  status: AssignmentStatus | '';
  courseId: string;
  due: DueWindow;
  sort: SortKey;
}
const EMPTY: Filters = { search: '', status: '', courseId: '', due: '', sort: 'newest' };

export function AssignmentManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  /** Due-window anchor is captured when the filter changes, so the query key stays stable. */
  const [dueAnchor, setDueAnchor] = useState(0);
  const [open, setOpen] = useState<Assignment | null>(null);
  const [creating, setCreating] = useState(false);
  const debounced = useDebouncedValue(filters.search.trim(), 400);

  const canReadCourses = hasPermissions(user, ['courses.read']);
  const courses = useCourseOptions('', canReadCourses, 100);
  const courseTitle = new Map((courses.data?.data ?? []).map((c) => [c.id, c.title]));
  const sort = SORTS[filters.sort];

  const params: AssignmentListParams = {
    page,
    limit,
    search: debounced || undefined,
    status: filters.status || undefined,
    courseId: filters.courseId || undefined,
    ...(filters.due ? dueRange(filters.due, dueAnchor) : {}),
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
  };
  const list = useAssignmentsList(params);
  const stats = useAssignmentStats();
  const rows = list.data?.assignments ?? [];
  const filtersActive = JSON.stringify({ ...filters, sort: 'newest' }) !== JSON.stringify(EMPTY);
  const canOpen = assignmentPolicy.canReadSubmissions(user);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function retryFailed() {
    void queryClient.refetchQueries({ queryKey: queryKeys.assignments.all, type: 'active', predicate: (q) => q.state.status === 'error' });
  }

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Review learner submissions, grade them and return work for correction."
        actions={
          <>
            <RefreshButton queryKeys={[queryKeys.assignments.all]} />
            {assignmentPolicy.canCreate(user) ? (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden />
                New assignment
              </Button>
            ) : null}
          </>
        }
      />

      <section aria-label="Assignment totals" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon, tone }) => {
          const stat = stats[key];
          const value: AssignmentStatus | '' = key === 'all' ? '' : key;
          return (
            <KpiCard
              key={key}
              label={label}
              icon={icon}
              tone={tone}
              value={stat.value}
              isLoading={stat.isLoading}
              error={stat.error}
              active={filters.status === value}
              onClick={() => setFilter('status', value)}
            />
          );
        })}
      </section>

      <Card className="min-w-0">
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input type="search" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Search assignment title" className="pl-9" aria-label="Search assignments" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value as Filters['status'])} className="sm:w-36" aria-label="Filter by status">
              <option value="">All statuses</option>
              {ASSIGNMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {assignmentStatusLabel(s)}
                </option>
              ))}
            </Select>
            {canReadCourses ? (
              <Select value={filters.courseId} onChange={(e) => setFilter('courseId', e.target.value)} className="sm:w-48" aria-label="Filter by course" disabled={courses.isPending}>
                <option value="">All courses</option>
                {(courses.data?.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            ) : null}
            <Select
              value={filters.due}
              onChange={(e) => {
                setDueAnchor(new Date().getTime());
                setFilter('due', e.target.value as DueWindow);
              }}
              className="sm:w-40"
              aria-label="Filter by due date"
            >
              <option value="">Any due date</option>
              <option value="week">Due in 7 days</option>
              <option value="overdue">Past due</option>
            </Select>
            <Select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value as SortKey)} className="sm:w-44" aria-label="Sort assignments">
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
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={retryFailed} />
        ) : !list.isPending && rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-5" aria-hidden />}
            title={filtersActive ? 'No assignments match these filters' : 'No assignments yet'}
            description={filtersActive ? 'Try a different search or filter.' : 'Assignments created for courses will appear here.'}
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-4 pr-3 sm:pl-5">Assignment</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Course</th>
                    <th scope="col" className="px-3 py-2.5">Due</th>
                    <th scope="col" className="hidden px-3 py-2.5 text-right xl:table-cell">Marks</th>
                    <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">Type</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
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
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="mt-1.5 h-3 w-24" />
                          </td>
                          <td className="hidden px-3 py-3 lg:table-cell">
                            <Skeleton className="h-4 w-32" />
                          </td>
                          <td className="px-3 py-3">
                            <Skeleton className="h-4 w-24" />
                          </td>
                          <td className="hidden px-3 py-3 xl:table-cell">
                            <Skeleton className="ml-auto h-4 w-10" />
                          </td>
                          <td className="hidden px-3 py-3 xl:table-cell">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="px-3 py-3">
                            <Skeleton className="h-5 w-20" />
                          </td>
                          <td className="py-3 pl-3 pr-4 sm:pr-5" />
                        </tr>
                      ))
                    : rows.map((a) => (
                        <tr key={a.id} className="group transition-colors hover:bg-surface-2/50">
                          <td className="w-full max-w-0 py-3 pl-4 pr-3 sm:pl-5">
                            <button type="button" onClick={() => setOpen(a)} className="block w-full min-w-0 text-left">
                              <span className="block truncate font-medium text-ink group-hover:text-primary">{a.title}</span>
                              <span className="mt-0.5 block truncate text-xs text-ink-muted">
                                <span className="lg:hidden">{courseTitle.get(a.courseId) ?? 'Course'} · </span>
                                {a.allowResubmission ? `Resubmission · up to ${a.maxSubmissions}` : 'Single submission'}
                                {a.allowLateSubmission ? ' · late allowed' : ''}
                              </span>
                            </button>
                          </td>
                          <td className="hidden max-w-56 truncate px-3 py-3 text-ink-muted lg:table-cell">{courseTitle.get(a.courseId) ?? (canReadCourses ? '—' : 'Course')}</td>
                          <td className="w-px px-3 py-3 text-xs">
                            <DueDate value={a.dueDate} status={a.status} />
                          </td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3 text-right tabular-nums text-ink xl:table-cell">{formatNumber(a.maximumMarks)}</td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3 text-xs text-ink-muted xl:table-cell">{submissionTypeLabel(a.submissionType)}</td>
                          <td className="w-px px-3 py-3">
                            <AssignmentStatusBadge status={a.status} />
                          </td>
                          <td className="w-px whitespace-nowrap py-3 pl-3 pr-4 text-right sm:pr-5">
                            <Button size="sm" variant="secondary" onClick={() => setOpen(a)} disabled={!canOpen} title={canOpen ? undefined : 'Needs assignments.submissions.read'}>
                              Submissions
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
                : rows.map((a) => (
                    <li key={a.id}>
                      <button type="button" onClick={() => setOpen(a)} className="block w-full space-y-2 p-3 text-left sm:p-4">
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{a.title}</span>
                            <span className="block truncate text-xs text-ink-muted">{courseTitle.get(a.courseId) ?? 'Course'}</span>
                          </span>
                          <AssignmentStatusBadge status={a.status} />
                        </span>
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3.5" aria-hidden />
                            <DueDate value={a.dueDate} status={a.status} />
                          </span>
                          <span>{formatNumber(a.maximumMarks)} marks</span>
                          <span>{submissionTypeLabel(a.submissionType)}</span>
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

      {open ? <AssignmentWorkspace key={open.id} assignment={open} courseTitle={courseTitle.get(open.courseId)} onClose={() => setOpen(null)} /> : null}
      {creating ? (
        <AssignmentFormDialog
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={(created) => {
            setCreating(false);
            setOpen(created);
          }}
        />
      ) : null}
    </>
  );
}
