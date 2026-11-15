'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Ban, CircleCheck, Clock, Eye, GraduationCap, PauseCircle, Plus, RefreshCw, Search, SlidersHorizontal, UserCheck, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { ActionMenu, type MenuItem } from '@/components/ui/menu';
import { KpiCard, type KpiTone } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { hasPermissions } from '@/lib/roles';
import {
  COMPLETION_STATUSES,
  ENROLLMENT_STATUSES,
  ENROLLMENT_TYPES,
  type CompletionStatus,
  type Enrollment,
  type EnrollmentListParams,
  type EnrollmentStatus,
  type EnrollmentType,
} from '@/types/enrollments';
import { useCourseOptions, useEnrollmentsList, useEnrollmentStats, type EnrollmentStatKey } from '../hooks';
import { completionLabel, EnrollmentStatusBadge, Initials, ProgressBar, statusLabel, typeLabel } from '../display';
import { EnrollmentCreateDialog } from './enrollment-create-dialog';
import { EnrollmentDrawer } from './enrollment-drawer';
import { EnrollmentStatusDialog } from './enrollment-status-dialog';

const PAGE_SIZES = [10, 20, 50];

const STAT_CARDS: Array<{ key: EnrollmentStatKey; label: string; icon: typeof Users; tone: KpiTone }> = [
  { key: 'all', label: 'All enrollments', icon: Users, tone: 'purple' },
  { key: 'active', label: 'Active', icon: UserCheck, tone: 'teal' },
  { key: 'pending', label: 'Pending', icon: Clock, tone: 'sky' },
  { key: 'completed', label: 'Completed', icon: GraduationCap, tone: 'amber' },
  { key: 'revoked', label: 'Revoked', icon: Ban, tone: 'coral' },
];

const PROGRESS_BUCKETS = {
  '': { label: 'Any progress' },
  none: { label: 'Not started (0%)', min: 0, max: 0 },
  low: { label: '1–49%', min: 1, max: 49 },
  high: { label: '50–99%', min: 50, max: 99 },
  done: { label: 'Finished (100%)', min: 100, max: 100 },
} as const;
type ProgressBucket = keyof typeof PROGRESS_BUCKETS;

const SORTS = {
  newest: { sortBy: 'enrolledAt', sortOrder: 'desc', label: 'Newest enrollments' },
  oldest: { sortBy: 'enrolledAt', sortOrder: 'asc', label: 'Oldest enrollments' },
  progressHigh: { sortBy: 'progressPercentage', sortOrder: 'desc', label: 'Most progress' },
  progressLow: { sortBy: 'progressPercentage', sortOrder: 'asc', label: 'Least progress' },
  expiring: { sortBy: 'expiresAt', sortOrder: 'asc', label: 'Expiring soonest' },
  updated: { sortBy: 'updatedAt', sortOrder: 'desc', label: 'Recently updated' },
} as const satisfies Record<string, { sortBy: EnrollmentListParams['sortBy']; sortOrder: 'asc' | 'desc'; label: string }>;
type SortKey = keyof typeof SORTS;

interface Filters {
  search: string;
  status: EnrollmentStatus | '';
  type: EnrollmentType | '';
  courseId: string;
  completion: CompletionStatus | '';
  progress: ProgressBucket;
  from: string;
  to: string;
  sort: SortKey;
}

const EMPTY: Filters = { search: '', status: '', type: '', courseId: '', completion: '', progress: '', from: '', to: '', sort: 'newest' };

type DialogState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'view'; enrollment: Enrollment }
  | { type: 'status'; enrollment: Enrollment; initial?: EnrollmentStatus; fromView?: boolean };

function learnerName(e: Enrollment): string {
  return e.student ? [e.student.firstName, e.student.lastName].filter(Boolean).join(' ') || e.student.email : 'Unknown learner';
}

/** `YYYY-MM-DD` from a date input → local start/end of day as ISO for the backend date filters. */
function dayBoundary(value: string, end: boolean): string | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function EnrollmentManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const debouncedSearch = useDebouncedValue(filters.search.trim(), 400);

  const canReadCourses = hasPermissions(user, ['courses.read']);
  const [showMore, setShowMore] = useState(false);
  const courseOptions = useCourseOptions('', canReadCourses && showMore, 100);
  const bucket = PROGRESS_BUCKETS[filters.progress];
  const sort = SORTS[filters.sort];
  const params: EnrollmentListParams = {
    page,
    limit,
    search: debouncedSearch || undefined,
    status: filters.status || undefined,
    enrollmentType: filters.type || undefined,
    courseId: filters.courseId || undefined,
    courseCompletionStatus: filters.completion || undefined,
    progressMin: 'min' in bucket ? bucket.min : undefined,
    progressMax: 'max' in bucket ? bucket.max : undefined,
    enrolledFrom: dayBoundary(filters.from, false),
    enrolledTo: dayBoundary(filters.to, true),
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
  };
  const list = useEnrollmentsList(params);
  const stats = useEnrollmentStats();
  const rows = list.data?.enrollments ?? [];
  const filtersActive = JSON.stringify({ ...filters, sort: 'newest' }) !== JSON.stringify(EMPTY);
  const advancedCount = [filters.type, filters.courseId, filters.completion, filters.progress, filters.from, filters.to].filter(Boolean).length;

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function retryFailed() {
    void queryClient.refetchQueries({ queryKey: queryKeys.enrollments.all, type: 'active', predicate: (q) => q.state.status === 'error' });
  }

  function menuItems(e: Enrollment): MenuItem[] {
    const items: MenuItem[] = [
      { key: 'view', label: 'View progress', icon: <Eye className="size-4" />, onSelect: () => setDialog({ type: 'view', enrollment: e }) },
      { key: 'status', label: 'Change status…', icon: <RefreshCw className="size-4" />, onSelect: () => setDialog({ type: 'status', enrollment: e }) },
    ];
    if (e.status !== 'active') items.push({ key: 'activate', label: 'Activate', icon: <CircleCheck className="size-4" />, onSelect: () => setDialog({ type: 'status', enrollment: e, initial: 'active' }) });
    if (e.status === 'active') items.push({ key: 'suspend', label: 'Suspend', icon: <PauseCircle className="size-4" />, onSelect: () => setDialog({ type: 'status', enrollment: e, initial: 'suspended' }) });
    if (e.status !== 'revoked') items.push({ key: 'revoke', label: 'Revoke access', icon: <Ban className="size-4" />, tone: 'danger', onSelect: () => setDialog({ type: 'status', enrollment: e, initial: 'revoked' }) });
    return items;
  }

  /** Keep the open drawer in sync with the refreshed list row. */
  const viewing = dialog.type === 'view' ? (rows.find((r) => r.id === dialog.enrollment.id) ?? dialog.enrollment) : null;

  return (
    <>
      <PageHeader
        title="Enrollments & Progress"
        description="Grant course access, manage enrollment status and follow each learner’s progress."
        actions={
          <>
            <RefreshButton queryKeys={[queryKeys.enrollments.all]} />
            <Button size="sm" onClick={() => setDialog({ type: 'create' })}>
              <Plus className="size-4" aria-hidden />
              New enrollment
            </Button>
          </>
        }
      />

      <section aria-label="Enrollment totals" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {STAT_CARDS.map(({ key, label, icon, tone }) => {
          const stat = stats[key];
          const value: EnrollmentStatus | '' = key === 'all' ? '' : key;
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
              className={key === 'all' ? 'col-span-2 md:col-span-1' : undefined}
            />
          );
        })}
      </section>

      <Card className="min-w-0">
        <div className="space-y-3 border-b border-line p-3 sm:p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input type="search" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Search learner name or email" className="pl-9" aria-label="Search enrollments" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value as Filters['status'])} className="sm:w-40" aria-label="Filter by status">
                <option value="">All statuses</option>
                {ENROLLMENT_STATUSES.filter((s) => s !== 'cancelled').map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </Select>
              <Select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value as SortKey)} className="sm:w-48" aria-label="Sort enrollments">
                {Object.entries(SORTS).map(([key, s]) => (
                  <option key={key} value={key}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} className="col-span-2 sm:col-span-1">
                <SlidersHorizontal className="size-4" aria-hidden />
                Filters{advancedCount ? ` · ${advancedCount}` : ''}
              </Button>
              {filtersActive ? (
                <Button
                  variant="ghost"
                  className="col-span-2 sm:col-span-1"
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
          {showMore ? (
            <div className="grid grid-cols-1 gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-ink-muted">Course</span>
                {canReadCourses ? (
                  <Select value={filters.courseId} onChange={(e) => setFilter('courseId', e.target.value)} aria-label="Filter by course" disabled={courseOptions.isPending}>
                    <option value="">All courses</option>
                    {(courseOptions.data?.data ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="text-xs text-ink-subtle">Needs courses.read</p>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-ink-muted">Type</span>
                <Select value={filters.type} onChange={(e) => setFilter('type', e.target.value as Filters['type'])} aria-label="Filter by type">
                  <option value="">All types</option>
                  {ENROLLMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {typeLabel(t)}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-ink-muted">Completion</span>
                <Select value={filters.completion} onChange={(e) => setFilter('completion', e.target.value as Filters['completion'])} aria-label="Filter by completion">
                  <option value="">Any completion</option>
                  {COMPLETION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {completionLabel(s)}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-ink-muted">Progress</span>
                <Select value={filters.progress} onChange={(e) => setFilter('progress', e.target.value as ProgressBucket)} aria-label="Filter by progress">
                  {Object.entries(PROGRESS_BUCKETS).map(([key, b]) => (
                    <option key={key} value={key}>
                      {b.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-ink-muted">Enrolled from</span>
                <Input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} aria-label="Enrolled from" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-ink-muted">Enrolled to</span>
                <Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} aria-label="Enrolled to" />
              </label>
            </div>
          ) : null}
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={retryFailed} />
        ) : !list.isPending && rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" aria-hidden />}
            title={filtersActive ? 'No enrollments match these filters' : 'No enrollments yet'}
            description={filtersActive ? 'Try a different search or filter.' : 'Enroll a learner to start tracking progress.'}
            action={
              !filtersActive ? (
                <Button size="sm" onClick={() => setDialog({ type: 'create' })}>
                  <Plus className="size-4" aria-hidden />
                  New enrollment
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-4 pr-3 sm:pl-5">Learner</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Course</th>
                    <th scope="col" className="px-3 py-2.5">Progress</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">Type</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Enrolled</th>
                    <th scope="col" className="hidden px-3 py-2.5 2xl:table-cell">Expires</th>
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
                            <Skeleton className="h-4 w-36" />
                          </td>
                          <td className="px-3 py-3">
                            <Skeleton className="h-2 w-28" />
                          </td>
                          <td className="px-3 py-3">
                            <Skeleton className="h-5 w-16" />
                          </td>
                          <td className="hidden px-3 py-3 xl:table-cell">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="hidden px-3 py-3 lg:table-cell">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="hidden px-3 py-3 2xl:table-cell">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="py-3 pl-3 pr-4 sm:pr-5" />
                        </tr>
                      ))
                    : rows.map((e) => (
                        <tr key={e.id} className="group transition-colors hover:bg-surface-2/50">
                          <td className="w-full max-w-0 py-3 pl-4 pr-3 sm:pl-5 lg:w-auto lg:max-w-64">
                            <button type="button" onClick={() => setDialog({ type: 'view', enrollment: e })} className="flex w-full min-w-0 items-center gap-3 text-left">
                              <Initials firstName={e.student?.firstName} lastName={e.student?.lastName} email={e.student?.email} />
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-ink group-hover:text-primary">{learnerName(e)}</span>
                                <span className="block truncate text-xs text-ink-muted">
                                  {e.student?.email}
                                  <span className="lg:hidden">{e.course ? ` · ${e.course.title}` : ''}</span>
                                </span>
                              </span>
                            </button>
                          </td>
                          <td className="hidden max-w-72 px-3 py-3 lg:table-cell">
                            <span className="block truncate text-ink">{e.course?.title ?? '—'}</span>
                            {e.course && e.course.status !== 'published' ? <span className="text-[11px] text-ink-subtle">Course {e.course.status}</span> : null}
                          </td>
                          <td className="w-40 min-w-36 px-3 py-3">
                            <div className="flex items-center gap-2">
                              <ProgressBar value={e.progressPercentage} className="flex-1" />
                              <span className="w-9 text-right text-xs tabular-nums text-ink">{Math.round(e.progressPercentage)}%</span>
                            </div>
                            <span className="mt-1 block text-[11px] text-ink-subtle">
                              {e.completedLessonsCount}/{e.totalRequiredLessons} lessons
                            </span>
                          </td>
                          <td className="w-px whitespace-nowrap px-3 py-3">
                            <EnrollmentStatusBadge status={e.status} />
                          </td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3 text-xs text-ink-muted xl:table-cell">{typeLabel(e.enrollmentType)}</td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3 text-xs text-ink-muted lg:table-cell">{formatDate(e.enrolledAt)}</td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3 text-xs text-ink-muted 2xl:table-cell">{e.enrollmentExpiresAt ? formatDate(e.enrollmentExpiresAt) : 'Never'}</td>
                          <td className="w-px py-3 pl-3 pr-4 text-right sm:pr-5">
                            <ActionMenu label={`Actions for ${learnerName(e)}`} items={menuItems(e)} />
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
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                      <Skeleton className="h-2 w-full" />
                    </li>
                  ))
                : rows.map((e) => (
                    <li key={e.id} className="space-y-3 p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <button type="button" onClick={() => setDialog({ type: 'view', enrollment: e })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <Initials firstName={e.student?.firstName} lastName={e.student?.lastName} email={e.student?.email} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{learnerName(e)}</span>
                            <span className="block truncate text-xs text-ink-muted">{e.course?.title ?? '—'}</span>
                          </span>
                        </button>
                        <ActionMenu label={`Actions for ${learnerName(e)}`} items={menuItems(e)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <ProgressBar value={e.progressPercentage} className="flex-1" />
                        <span className="text-xs tabular-nums text-ink">{Math.round(e.progressPercentage)}%</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-subtle">
                        <EnrollmentStatusBadge status={e.status} />
                        <span>{typeLabel(e.enrollmentType)}</span>
                        <span className="ml-auto">Enrolled {formatDate(e.enrolledAt)}</span>
                      </div>
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

      {dialog.type === 'create' ? <EnrollmentCreateDialog onClose={() => setDialog({ type: 'none' })} /> : null}
      {viewing ? (
        <EnrollmentDrawer
          key={viewing.id}
          enrollment={viewing}
          onClose={() => setDialog({ type: 'none' })}
          onChangeStatus={(e) => setDialog({ type: 'status', enrollment: e, fromView: true })}
        />
      ) : null}
      {dialog.type === 'status' ? (
        <EnrollmentStatusDialog
          key={`${dialog.enrollment.id}-${dialog.initial ?? ''}`}
          enrollment={dialog.enrollment}
          initialStatus={dialog.initial}
          onClose={() => setDialog(dialog.fromView ? { type: 'view', enrollment: dialog.enrollment } : { type: 'none' })}
          onUpdated={(record) =>
            setDialog(
              dialog.fromView
                ? { type: 'view', enrollment: { ...dialog.enrollment, ...record, student: dialog.enrollment.student, course: dialog.enrollment.course } }
                : { type: 'none' }
            )
          }
        />
      ) : null}
    </>
  );
}
