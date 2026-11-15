'use client';

import { Archive, BadgeCheck, BookOpen, CircleCheck, Eye, FilePen, Pencil, Plus, RotateCcw, Search, Star, Undo2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Select } from '@/components/ui/input';
import { ActionMenu, type MenuItem } from '@/components/ui/menu';
import { KpiCard, type KpiTone } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { displayName } from '@/lib/roles';
import { useToast } from '@/providers/toast-provider';
import { COURSE_LEVELS, COURSE_STATUSES, COURSE_TYPES, type Course, type CourseLevel, type CourseListParams, type CourseStatus, type CourseType, type PricingType } from '@/types/courses';
import { useCourseCategories } from '@/features/categories/hooks';
import { useCoursesList, useCourseStats, useUpdateCourseStatus, type CourseStatKey } from '../hooks';
import { CourseStatusBadge, CourseThumb, levelLabel, priceLabel } from '../display';
import { coursePolicy, STATUS_ACTIONS, statusActionsFor, type StatusAction } from '../policy';
import { CourseDetailsDialog } from './course-details-dialog';
import { CourseFormDialog } from './course-form-dialog';

const PAGE_SIZES = [10, 20, 50];

const STAT_CARDS: Array<{ key: CourseStatKey; label: string; tone: KpiTone; icon: typeof BookOpen }> = [
  { key: 'all', label: 'Total courses', tone: 'purple', icon: BookOpen },
  { key: 'published', label: 'Published', tone: 'teal', icon: BadgeCheck },
  { key: 'draft', label: 'Drafts', tone: 'sky', icon: FilePen },
  { key: 'archived', label: 'Archived', tone: 'coral', icon: Archive },
];

const SORTS = {
  newest: { sortBy: 'createdAt', sortOrder: 'desc', label: 'Newest first' },
  oldest: { sortBy: 'createdAt', sortOrder: 'asc', label: 'Oldest first' },
  updated: { sortBy: 'updatedAt', sortOrder: 'desc', label: 'Recently updated' },
  published: { sortBy: 'publishedAt', sortOrder: 'desc', label: 'Recently published' },
  title: { sortBy: 'title', sortOrder: 'asc', label: 'Title A–Z' },
  order: { sortBy: 'sortOrder', sortOrder: 'asc', label: 'Sort order' },
} as const satisfies Record<string, { sortBy: CourseListParams['sortBy']; sortOrder: 'asc' | 'desc'; label: string }>;
type SortKey = keyof typeof SORTS;

const STATUS_ICONS: Record<StatusAction, typeof CircleCheck> = { publish: CircleCheck, unpublish: Undo2, archive: Archive, restore: RotateCcw };

type DialogState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; course: Course; fromView?: boolean }
  | { type: 'view'; course: Course }
  | { type: 'status'; course: Course; action: StatusAction; fromView?: boolean };

interface Filters {
  search: string;
  status: CourseStatus | '';
  level: CourseLevel | '';
  pricingType: PricingType | '';
  courseType: CourseType | '';
  categoryId: string;
  featured: '' | 'true' | 'false';
  sort: SortKey;
}

const EMPTY_FILTERS: Filters = { search: '', status: '', level: '', pricingType: '', courseType: '', categoryId: '', featured: '', sort: 'newest' };

function courseTypeLabel(type?: CourseType): string {
  if (type === 'FREE') return 'Free';
  if (type === 'LIVE_SESSION') return 'Live';
  return 'Pre-recorded';
}

export function CourseManagement() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const debouncedSearch = useDebouncedValue(filters.search.trim(), 400);
  // isPending updates after re-render; this blocks duplicate status requests fired in the same tick
  const inFlight = useRef(false);

  const canPickCategories = coursePolicy.canPickCategories(user);
  const categories = useCourseCategories(canPickCategories);
  const sort = SORTS[filters.sort];
  const params: CourseListParams = {
    page,
    limit,
    search: debouncedSearch || undefined,
    status: filters.status || undefined,
    level: filters.level || undefined,
    pricingType: filters.pricingType || undefined,
    courseType: filters.courseType || undefined,
    categoryId: filters.categoryId || undefined,
    isFeatured: filters.featured ? filters.featured === 'true' : undefined,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
  };
  const list = useCoursesList(params);
  const stats = useCourseStats();
  const updateStatus = useUpdateCourseStatus();
  const rows = list.data?.data ?? [];
  const filtersActive = JSON.stringify({ ...filters, sort: 'newest' }) !== JSON.stringify(EMPTY_FILTERS);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  const close = () => setDialog({ type: 'none' });

  /** The list and stat cards fail together on an outage; one retry recovers both. */
  function retryFailed() {
    void queryClient.refetchQueries({ queryKey: queryKeys.courses.all, type: 'active', predicate: (q) => q.state.status === 'error' });
  }

  function confirmStatus() {
    if (dialog.type !== 'status' || inFlight.current) return;
    const { course, action, fromView } = dialog;
    inFlight.current = true;
    updateStatus.mutate(
      { id: course.id, status: STATUS_ACTIONS[action].target },
      {
        onSuccess: (updated) => {
          toast.success(action === 'publish' ? 'Course published' : action === 'archive' ? 'Course archived' : 'Course moved to draft', updated.title);
          setDialog(fromView ? { type: 'view', course: updated } : { type: 'none' });
        },
        onError: (error) => toast.error(`Could not ${STATUS_ACTIONS[action].label.toLowerCase()}`, normalizeApiError(error).message),
        onSettled: () => {
          inFlight.current = false;
        },
      }
    );
  }

  function menuItems(course: Course): MenuItem[] {
    const items: MenuItem[] = [{ key: 'view', label: 'View details', icon: <Eye className="size-4" />, onSelect: () => setDialog({ type: 'view', course }) }];
    if (coursePolicy.canUpdate(user)) items.push({ key: 'edit', label: 'Edit course', icon: <Pencil className="size-4" />, onSelect: () => setDialog({ type: 'edit', course }) });
    if (coursePolicy.canChangeStatus(user)) {
      for (const action of statusActionsFor(course.status)) {
        const Icon = STATUS_ICONS[action];
        items.push({
          key: action,
          label: STATUS_ACTIONS[action].label,
          icon: <Icon className="size-4" />,
          tone: action === 'archive' ? 'danger' : 'default',
          onSelect: () => setDialog({ type: 'status', course, action }),
        });
      }
    }
    return items;
  }

  const seed = dialog.type === 'view' ? { course: dialog.course, updatedAt: list.dataUpdatedAt } : undefined;
  const statusCopy = dialog.type === 'status' ? STATUS_ACTIONS[dialog.action] : null;

  return (
    <>
      <PageHeader
        title="Course Management"
        description="Create, edit and publish courses, and review curriculum and analytics."
        actions={
          <>
            <RefreshButton queryKeys={[queryKeys.courses.all]} />
            {coursePolicy.canCreate(user) ? (
              <Button size="sm" onClick={() => setDialog({ type: 'create' })}>
                <Plus className="size-4" aria-hidden />
                New course
              </Button>
            ) : null}
          </>
        }
      />

      <section aria-label="Course totals" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, tone, icon }) => {
          const stat = stats[key];
          const value: CourseStatus | '' = key === 'all' ? '' : key;
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
        <div className="space-y-3 border-b border-line p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input type="search" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Search title, slug, tags or summary" className="pl-9" aria-label="Search courses" />
            </div>
            <Select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value as SortKey)} className="lg:w-48" aria-label="Sort courses">
              {Object.entries(SORTS).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
            <Select value={filters.status} onChange={(e) => setFilter('status', e.target.value as Filters['status'])} className="lg:w-36" aria-label="Filter by status">
              <option value="">All statuses</option>
              {COURSE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
            <Select value={filters.level} onChange={(e) => setFilter('level', e.target.value as Filters['level'])} className="lg:w-36" aria-label="Filter by level">
              <option value="">All levels</option>
              {COURSE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {levelLabel(l)}
                </option>
              ))}
            </Select>
            <Select value={filters.courseType} onChange={(e) => setFilter('courseType', e.target.value as Filters['courseType'])} className="lg:w-36" aria-label="Filter by course type">
              <option value="">All types</option>
              {COURSE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {courseTypeLabel(t)}
                </option>
              ))}
            </Select>
            <Select value={filters.pricingType} onChange={(e) => setFilter('pricingType', e.target.value as Filters['pricingType'])} className="lg:w-32" aria-label="Filter by price">
              <option value="">Free & paid</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </Select>
            <Select value={filters.featured} onChange={(e) => setFilter('featured', e.target.value as Filters['featured'])} className="lg:w-36" aria-label="Filter by featured">
              <option value="">Any listing</option>
              <option value="true">Featured</option>
              <option value="false">Not featured</option>
            </Select>
            {canPickCategories ? (
              <Select value={filters.categoryId} onChange={(e) => setFilter('categoryId', e.target.value)} className="lg:w-44" aria-label="Filter by category" disabled={categories.isPending}>
                <option value="">All categories</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            ) : null}
            {filtersActive ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setFilters((f) => ({ ...EMPTY_FILTERS, sort: f.sort }));
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
            icon={<BookOpen className="size-5" aria-hidden />}
            title={filtersActive ? 'No courses match these filters' : 'No courses yet'}
            description={filtersActive ? 'Try a different search or filter.' : 'Create the first course to start building the catalogue.'}
            action={
              !filtersActive && coursePolicy.canCreate(user) ? (
                <Button size="sm" onClick={() => setDialog({ type: 'create' })}>
                  <Plus className="size-4" aria-hidden />
                  New course
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Table from tablet up; secondary columns appear as width allows */}
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface-2/60 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-3 pl-4 pr-3 sm:pl-5">Course</th>
                    <th scope="col" className="hidden px-3 py-3 xl:table-cell">Categories</th>
                    <th scope="col" className="hidden px-3 py-3 xl:table-cell">Instructors</th>
                    <th scope="col" className="px-3 py-3">Price</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="hidden px-3 py-3 2xl:table-cell">Updated</th>
                    <th scope="col" className="py-3 pl-3 pr-4 text-right sm:pr-5">
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
                              <Skeleton className="h-12 w-20 rounded-lg" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-4 w-44" />
                                <Skeleton className="h-3 w-28" />
                              </div>
                            </div>
                          </td>
                          <td className="hidden px-3 py-3 xl:table-cell">
                            <Skeleton className="h-5 w-24 rounded-full" />
                          </td>
                          <td className="hidden px-3 py-3 xl:table-cell">
                            <Skeleton className="h-4 w-24" />
                          </td>
                          <td className="px-3 py-3">
                            <Skeleton className="h-4 w-16" />
                          </td>
                          <td className="px-3 py-3">
                            <Skeleton className="h-5 w-16 rounded-full" />
                          </td>
                          <td className="hidden px-3 py-3 2xl:table-cell">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="py-3 pl-3 pr-4 sm:pr-5" />
                        </tr>
                      ))
                    : rows.map((c) => {
                        const price = priceLabel(c);
                        const instructors = (c.instructors ?? []).map((i) => displayName(i)).join(', ');
                        return (
                          <tr key={c.id} className="group transition-colors hover:bg-surface-2/50">
                            <td className="w-full max-w-0 py-3 pl-4 pr-3 sm:pl-5">
                              <button type="button" onClick={() => setDialog({ type: 'view', course: c })} className="flex w-full min-w-0 items-center gap-3 text-left">
                                <CourseThumb course={c} size="row" />
                                <span className="min-w-0">
                                  <span className="flex items-center gap-1.5">
                                    <span className="truncate font-semibold text-ink group-hover:text-primary">{c.title}</span>
                                    {c.isFeatured ? <Star className="size-3.5 shrink-0 fill-warning text-warning" aria-label="Featured" /> : null}
                                    <Badge tone={c.courseType === 'LIVE_SESSION' ? 'brand' : 'neutral'}>{courseTypeLabel(c.courseType)}</Badge>
                                  </span>
                                  <span className="mt-0.5 block truncate text-xs text-ink-muted">
                                    {levelLabel(c.level)} · {c.language.toUpperCase()}
                                    {c.durationValue ? ` · ${c.durationValue} ${c.durationUnit}` : ''}
                                    <span className="xl:hidden">{instructors ? ` · ${instructors}` : ''}</span>
                                  </span>
                                </span>
                              </button>
                            </td>
                            <td className="hidden w-48 min-w-48 px-3 py-3 xl:table-cell">
                              <div className="flex flex-wrap gap-1">
                                {(c.categories ?? []).slice(0, 2).map((cat) => (
                                  <Badge key={cat.id}>{cat.name}</Badge>
                                ))}
                                {(c.categories ?? []).length > 2 ? <Badge>+{(c.categories ?? []).length - 2}</Badge> : null}
                                {!(c.categories ?? []).length ? <span className="text-xs text-ink-subtle">—</span> : null}
                              </div>
                            </td>
                            <td className="hidden w-44 min-w-44 max-w-44 truncate px-3 py-3 text-xs text-ink-muted xl:table-cell">{instructors || '—'}</td>
                            <td className="w-px whitespace-nowrap px-3 py-3">
                              <span className="block font-semibold text-ink">{price.primary}</span>
                              {price.struck ? (
                                <span className="block text-[11px] text-ink-subtle">
                                  <span className="line-through">{price.struck}</span>
                                  {price.saleUntil ? ` · till ${formatDate(price.saleUntil)}` : ''}
                                </span>
                              ) : null}
                            </td>
                            <td className="w-px px-3 py-3">
                              <CourseStatusBadge status={c.status} />
                            </td>
                            <td className="hidden w-px whitespace-nowrap px-3 py-3 text-xs text-ink-muted 2xl:table-cell">{formatDate(c.updatedAt)}</td>
                            <td className="w-px py-3 pl-3 pr-4 text-right sm:pr-5">
                              <ActionMenu label={`Actions for ${c.title}`} items={menuItems(c)} />
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            <ul className={cn('grid gap-3 p-3 sm:grid-cols-2 sm:p-4 md:hidden', list.isPlaceholderData && 'opacity-60')}>
              {list.isPending
                ? Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="space-y-3 rounded-xl border border-line p-3">
                      <Skeleton className="h-28 w-full rounded-lg" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </li>
                  ))
                : rows.map((c) => {
                    const price = priceLabel(c);
                    return (
                      <li key={c.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface">
                        <button type="button" onClick={() => setDialog({ type: 'view', course: c })} className="block text-left">
                          {c.thumbnail?.secureUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary image
                            <img src={c.thumbnail.secureUrl} alt="" className="h-32 w-full object-cover" loading="lazy" />
                          ) : (
                            <span className="flex h-24 w-full items-center justify-center bg-surface-2 text-lg font-semibold text-ink-subtle" aria-hidden>
                              {c.title.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </button>
                        <div className="flex flex-1 flex-col gap-2 p-3">
                          <div className="flex items-start gap-2">
                            <button type="button" onClick={() => setDialog({ type: 'view', course: c })} className="min-w-0 flex-1 text-left">
                              <span className="line-clamp-2 text-sm font-semibold text-ink">{c.title}</span>
                              <span className="mt-0.5 block truncate text-xs text-ink-muted">{(c.instructors ?? []).map((i) => displayName(i)).join(', ') || 'No instructor'}</span>
                            </button>
                            <ActionMenu label={`Actions for ${c.title}`} items={menuItems(c)} />
                          </div>
                          <div className="mt-auto flex flex-wrap items-center gap-1.5">
                            <CourseStatusBadge status={c.status} />
                            <Badge>{levelLabel(c.level)}</Badge>
                            {c.isFeatured ? <Badge tone="warning">Featured</Badge> : null}
                            <span className="ml-auto text-sm font-semibold text-ink">{price.primary}</span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
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

      {dialog.type === 'create' ? <CourseFormDialog key="create" mode="create" onClose={close} /> : null}
      {dialog.type === 'edit' ? (
        <CourseFormDialog
          key={`edit-${dialog.course.id}`}
          mode="edit"
          course={dialog.course}
          onClose={() => setDialog(dialog.fromView ? { type: 'view', course: dialog.course } : { type: 'none' })}
          onSaved={dialog.fromView ? (updated) => setDialog({ type: 'view', course: updated }) : undefined}
        />
      ) : null}
      {dialog.type === 'view' ? (
        <CourseDetailsDialog
          key={dialog.course.id}
          courseId={dialog.course.id}
          seed={seed}
          onClose={close}
          onEdit={(course) => setDialog({ type: 'edit', course, fromView: true })}
          onStatusAction={(course, action) => setDialog({ type: 'status', course, action, fromView: true })}
          statusPending={updateStatus.isPending}
        />
      ) : null}
      <ConfirmDialog
        open={dialog.type === 'status'}
        title={statusCopy?.title ?? ''}
        confirmLabel={statusCopy?.label ?? 'Confirm'}
        tone={statusCopy?.tone ?? 'primary'}
        loading={updateStatus.isPending}
        onCancel={() => setDialog(dialog.type === 'status' && dialog.fromView ? { type: 'view', course: dialog.course } : { type: 'none' })}
        onConfirm={confirmStatus}
        description={
          dialog.type === 'status' ? (
            <>
              <p>
                <span className="font-semibold text-ink">{dialog.course.title}</span>
              </p>
              <p className="mt-2">{statusCopy?.body}</p>
            </>
          ) : null
        }
      />
    </>
  );
}
