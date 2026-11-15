'use client';

import { Check, CircleCheck, Clock3, Eye, MessageSquareText, Search, Star, Trash2, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ActionMenu, type MenuItem } from '@/components/ui/menu';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { REVIEW_SORTS, REVIEW_STATUSES, type AdminReview, type ReviewListParams, type ReviewSort, type ReviewStatus } from '@/types/reviews';
import { useCourseCatalog } from '@/features/shared/lookups';
import { LearnerAvatar, reviewStatusLabel, ReviewStatusBadge, SORT_LABEL, Stars, studentName } from '../display';
import { useApprovedRating, useReviewList, useReviewStats } from '../hooks';
import { DeleteReviewDialog, RejectReviewDialog, useApproveReview } from './review-actions';
import { ReviewDrawer } from './review-drawer';

const PAGE_SIZES = [10, 20, 50];

/** From each course's backend-maintained rating (approved reviews only); hidden when it would be partial. */
function AverageRatingCard({ courseId }: { courseId: string }) {
  const rating = useApprovedRating(courseId);
  const unavailable = rating.isLoading || rating.error ? undefined : !rating.available ? 'Not available for this view' : rating.average == null ? 'No approved reviews yet' : undefined;
  return (
    <KpiCard
      label="Average rating"
      icon={Star}
      tone="sky"
      value={rating.average == null ? null : Math.round(rating.average * 10) / 10}
      isLoading={rating.isLoading}
      error={rating.error}
      unavailable={unavailable}
      hint={`${courseId ? 'Selected course · ' : ''}${rating.count ? `${rating.count} approved review${rating.count === 1 ? '' : 's'}` : 'Approved reviews only'}`}
    />
  );
}

export function ReviewsManagement() {
  const catalog = useCourseCatalog();
  const stats = useReviewStats();
  const { approve, isPending: approving } = useApproveReview();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ReviewStatus | ''>('');
  const [rating, setRating] = useState('');
  const [courseId, setCourseId] = useState('');
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [viewing, setViewing] = useState<AdminReview | null>(null);
  const [rejecting, setRejecting] = useState<AdminReview | null>(null);
  const [deleting, setDeleting] = useState<AdminReview | null>(null);

  const debounced = useDebouncedValue(search.trim(), 350);
  const params: ReviewListParams = {
    page,
    limit,
    search: debounced || undefined,
    status: status || undefined,
    rating: rating ? Number(rating) : undefined,
    courseId: courseId || undefined,
    sort: sort === 'newest' ? undefined : sort,
  };
  const list = useReviewList(params);
  const rows = list.data?.reviews ?? [];
  const filtered = Boolean(debounced || status || rating || courseId);

  const resetPage =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  function clearAll() {
    setSearch('');
    setStatus('');
    setRating('');
    setCourseId('');
    setSort('newest');
    setPage(1);
  }

  const menu = (r: AdminReview): MenuItem[] => [
    { key: 'view', label: 'View details', icon: <Eye className="size-4" />, onSelect: () => setViewing(r) },
    ...(r.status !== 'approved' ? [{ key: 'approve', label: 'Approve', icon: <Check className="size-4" />, disabled: approving, onSelect: () => approve(r) }] : []),
    ...(r.status !== 'rejected' ? [{ key: 'reject', label: 'Reject…', icon: <X className="size-4" />, onSelect: () => setRejecting(r) }] : []),
    { key: 'delete', label: 'Delete…', icon: <Trash2 className="size-4" />, tone: 'danger', onSelect: () => setDeleting(r) },
  ];

  const statCard = (key: 'all' | ReviewStatus, label: string, hint: string, icon: typeof Star, tone: 'purple' | 'amber' | 'teal' | 'coral') => (
    <KpiCard
      label={label}
      hint={hint}
      icon={icon}
      tone={tone}
      value={stats[key].value}
      isLoading={stats[key].isLoading}
      error={stats[key].error}
      active={key === 'all' ? !status : status === key}
      onClick={() => resetPage(setStatus)(key === 'all' ? '' : key)}
    />
  );

  return (
    <>
      <PageHeader title="Reviews Management" description="Monitor, moderate and manage learner feedback." actions={<RefreshButton queryKeys={[queryKeys.reviews.all]} />} />

      <section aria-label="Review overview" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {statCard('all', 'Total reviews', 'Excludes deleted', MessageSquareText, 'purple')}
        {statCard('pending', 'Pending', 'Awaiting moderation', Clock3, 'amber')}
        {statCard('approved', 'Approved', 'Public on course pages', CircleCheck, 'teal')}
        {statCard('rejected', 'Rejected', 'Hidden from learners', XCircle, 'coral')}
        <div className="col-span-2 lg:col-span-1">
          <AverageRatingCard courseId={courseId} />
        </div>
      </section>

      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{status ? `${reviewStatusLabel(status)} reviews` : 'All reviews'}</h2>
            <p className="text-xs text-ink-muted">Search matches learner name or email, course title, and the review title or text.</p>
          </div>
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <div className="flex min-w-0 gap-2 xl:w-72 xl:shrink-0">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
                <Input type="search" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} placeholder="Search reviews" className="pl-9" aria-label="Search reviews" />
              </div>
              {filtered || sort !== 'newest' ? (
                <span className="shrink-0 xl:hidden">
                  <Button variant="ghost" onClick={clearAll}>
                    <X className="size-4" aria-hidden />
                    Clear
                  </Button>
                </span>
              ) : null}
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 md:grid-cols-4">
              <Select value={status} onChange={(e) => resetPage(setStatus)(e.target.value as ReviewStatus | '')} aria-label="Filter by status">
                <option value="">Any status</option>
                {REVIEW_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {reviewStatusLabel(s)}
                  </option>
                ))}
              </Select>
              <Select value={rating} onChange={(e) => resetPage(setRating)(e.target.value)} aria-label="Filter by rating">
                <option value="">Any rating</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n === 1 ? '' : 's'}
                  </option>
                ))}
              </Select>
              <Select value={courseId} onChange={(e) => resetPage(setCourseId)(e.target.value)} className="min-w-0" aria-label="Filter by course" disabled={catalog.query.isPending || catalog.query.isError}>
                <option value="">{catalog.query.isError ? 'Courses unavailable' : 'All courses'}</option>
                {catalog.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.status !== 'published' ? ` (${c.status})` : ''}
                  </option>
                ))}
              </Select>
              <Select value={sort} onChange={(e) => resetPage(setSort)(e.target.value as ReviewSort)} aria-label="Sort reviews">
                {REVIEW_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABEL[s]}
                  </option>
                ))}
              </Select>
            </div>
            {filtered || sort !== 'newest' ? (
              <span className="hidden shrink-0 xl:block">
                <Button variant="ghost" onClick={clearAll}>
                  <X className="size-4" aria-hidden />
                  Clear
                </Button>
              </span>
            ) : null}
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isPending && !rows.length ? (
          <EmptyState
            icon={<MessageSquareText className="size-5" aria-hidden />}
            title={filtered ? 'No reviews match these filters' : 'No reviews yet'}
            description={filtered ? 'Try another search, status, rating or course.' : 'Reviews appear here when enrolled learners rate a course.'}
            action={
              filtered ? (
                <Button size="sm" variant="secondary" onClick={clearAll}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Learner</th>
                    <th scope="col" className="px-3 py-2.5">Review</th>
                    <th scope="col" className="px-3 py-2.5">Rating</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Submitted</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3.5 pl-5 pr-3">
                            <div className="flex items-center gap-3">
                              <Skeleton className="size-8 rounded-full" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-3.5 w-28" />
                                <Skeleton className="h-3 w-36" />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-3.5 w-48" />
                            <Skeleton className="mt-1.5 h-3 w-64" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-3.5 w-20" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-5 w-16" />
                          </td>
                          <td className="hidden px-3 py-3.5 lg:table-cell">
                            <Skeleton className="h-3.5 w-20" />
                          </td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((r) => (
                        <tr key={r.id} className="group align-top transition-colors hover:bg-surface-2/50">
                          <td className="py-3.5 pl-5 pr-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <LearnerAvatar student={r.student} />
                              <div className="min-w-0 max-w-48">
                                <p className="truncate font-medium text-ink">{studentName(r.student)}</p>
                                <p className="truncate text-xs text-ink-muted">{r.student?.email ?? '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="w-full min-w-64 max-w-0 px-3 py-3.5">
                            <button type="button" onClick={() => setViewing(r)} className="block w-full text-left">
                              <span className="block truncate font-medium text-ink group-hover:text-primary">{r.title || <span className="font-normal italic text-ink-subtle">No title</span>}</span>
                              {r.comment ? <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">{r.comment}</span> : null}
                              <span className="mt-1 block truncate text-[11px] text-ink-subtle">{r.course?.title ?? 'Course unavailable'}</span>
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5">
                            <Stars value={r.rating} />
                          </td>
                          <td className="w-px px-3 py-3.5">
                            <ReviewStatusBadge status={r.status} />
                          </td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted lg:table-cell">{formatDate(r.createdAt)}</td>
                          <td className="w-px py-3 pl-3 pr-5 text-right">
                            <ActionMenu label={`Actions for review by ${studentName(r.student)}`} items={menu(r)} />
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
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </li>
                  ))
                : rows.map((r) => (
                    <li key={r.id} className="flex items-start gap-3 p-4">
                      <LearnerAvatar student={r.student} />
                      <button type="button" onClick={() => setViewing(r)} className="min-w-0 flex-1 space-y-1 text-left">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-ink">{studentName(r.student)}</span>
                          <ReviewStatusBadge status={r.status} />
                        </span>
                        <span className="flex items-center gap-2">
                          <Stars value={r.rating} />
                          <span className="text-[11px] text-ink-subtle">{formatDate(r.createdAt)}</span>
                        </span>
                        <span className="block truncate text-sm text-ink">{r.title || 'No title'}</span>
                        {r.comment ? <span className="line-clamp-2 text-xs text-ink-muted">{r.comment}</span> : null}
                        <span className="block truncate text-[11px] text-ink-subtle">{r.course?.title ?? 'Course unavailable'}</span>
                      </button>
                      <ActionMenu label={`Actions for review by ${studentName(r.student)}`} items={menu(r)} />
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

      {viewing ? <ReviewDrawer key={viewing.id} seed={viewing} onClose={() => setViewing(null)} /> : null}
      {rejecting ? <RejectReviewDialog review={rejecting} onClose={() => setRejecting(null)} /> : null}
      {deleting ? <DeleteReviewDialog review={deleting} onClose={() => setDeleting(null)} /> : null}
    </>
  );
}
