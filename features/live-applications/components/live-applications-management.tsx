'use client';

import { Eye, Search, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { formatDate, titleCase } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { useToast } from '@/providers/toast-provider';
import {
  LIVE_APPLICATION_STATUSES,
  type LiveApplicationStatus,
  type LiveCourseApplication,
} from '@/types/live-applications';
import { useCoursesList } from '@/features/courses/hooks';
import {
  useConvertLiveApplication,
  useLiveApplicationDetail,
  useLiveApplicationList,
  useUpdateLiveApplicationRemarks,
  useUpdateLiveApplicationStatus,
} from '../hooks';

const PAGE_SIZES = [10, 20, 50];

const STATUS_TONES: Record<LiveApplicationStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'brand'> = {
  PENDING: 'warning',
  UNDER_REVIEW: 'info',
  CONTACTED: 'brand',
  APPROVED: 'success',
  REJECTED: 'danger',
  CONVERTED: 'neutral',
};

const REVIEWABLE_STATUSES: LiveApplicationStatus[] = [
  'PENDING',
  'UNDER_REVIEW',
  'CONTACTED',
  'APPROVED',
  'REJECTED',
];

function statusLabel(status: LiveApplicationStatus): string {
  return status === 'UNDER_REVIEW' ? 'Under review' : titleCase(status.toLowerCase());
}

function courseTitle(app: LiveCourseApplication): string {
  const course = app.liveCourse;
  if (course && typeof course === 'object') return course.title;
  return '—';
}

function studentName(app: LiveCourseApplication): string {
  if (app.student && typeof app.student === 'object') {
    return [app.student.firstName, app.student.lastName].filter(Boolean).join(' ') || app.name;
  }
  return app.name;
}

export function LiveApplicationsManagement() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LiveApplicationStatus | ''>('');
  const [courseId, setCourseId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 400);

  const liveCourses = useCoursesList({ page: 1, limit: 100, courseType: 'LIVE_SESSION' });
  const params = {
    page,
    limit,
    search: debouncedSearch || undefined,
    status: status || undefined,
    liveCourse: courseId || undefined,
  };
  const list = useLiveApplicationList(params);
  const detail = useLiveApplicationDetail(selectedId);
  const updateStatus = useUpdateLiveApplicationStatus();
  const updateRemarks = useUpdateLiveApplicationRemarks();
  const convert = useConvertLiveApplication();

  const rows = list.data?.data ?? [];
  const filtersActive = Boolean(debouncedSearch || status || courseId);

  function resetFilters() {
    setSearch('');
    setStatus('');
    setCourseId('');
    setPage(1);
  }

  const app = detail.data;
  const busy = updateStatus.isPending || updateRemarks.isPending || convert.isPending;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Live Course Applications"
        description="Review applications for live session courses and convert approved applicants into enrollments."
        actions={<RefreshButton queryKeys={[queryKeys.liveApplications.all]} />}
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name, email, company or reference"
              className="pl-9"
              aria-label="Search applications"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as LiveApplicationStatus | '');
                setPage(1);
              }}
              className="lg:w-40"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {LIVE_APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Select>
            <Select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setPage(1);
              }}
              className="lg:w-56"
              aria-label="Filter by course"
              disabled={liveCourses.isPending}
            >
              <option value="">All live courses</option>
              {(liveCourses.data?.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
            {filtersActive ? (
              <Button variant="ghost" onClick={resetFilters}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {list.isPending ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : list.isError ? (
          <div className="p-4">
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="size-5" aria-hidden />}
            title={filtersActive ? 'No applications match these filters' : 'No live course applications yet'}
            description={
              filtersActive
                ? 'Try adjusting the search or filters.'
                : 'Applications submitted from live session course pages will appear here.'
            }
            action={filtersActive ? <Button onClick={resetFilters}>Clear filters</Button> : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-surface-2/60 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-3 pl-4 pr-3 sm:pl-5">Applicant</th>
                    <th scope="col" className="px-3 py-3">Course</th>
                    <th scope="col" className="hidden px-3 py-3 md:table-cell">Company / City</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="hidden px-3 py-3 lg:table-cell">Submitted</th>
                    <th scope="col" className="py-3 pl-3 pr-4 text-right sm:pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((a) => (
                    <tr key={a.id} className="transition-colors hover:bg-surface-2/50">
                      <td className="py-3 pl-4 pr-3 sm:pl-5">
                        <button
                          type="button"
                          onClick={() => setSelectedId(a.id)}
                          className="text-left"
                        >
                          <span className="block font-semibold text-ink hover:text-primary">{a.name}</span>
                          <span className="block text-xs text-ink-muted">{a.applicationReference}</span>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <span className="block max-w-56 truncate text-ink">{courseTitle(a)}</span>
                        <span className="block text-xs text-ink-subtle">{a.courseInterested}</span>
                      </td>
                      <td className="hidden px-3 py-3 md:table-cell">
                        <span className="block text-xs text-ink">{a.currentCompany}</span>
                        <span className="block text-xs text-ink-subtle">{a.currentCity}</span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={STATUS_TONES[a.status]}>{statusLabel(a.status)}</Badge>
                      </td>
                      <td className="hidden px-3 py-3 text-xs text-ink-muted lg:table-cell">
                        {a.createdAt ? formatDate(a.createdAt) : '—'}
                      </td>
                      <td className="py-3 pl-3 pr-4 text-right sm:pr-5">
                        <Button variant="secondary" size="sm" onClick={() => setSelectedId(a.id)}>
                          <Eye className="size-4" aria-hidden />
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          </>
        )}
      </Card>

      <Dialog
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        busy={busy}
        size="lg"
        title={app ? `Application ${app.applicationReference}` : 'Application'}
        description={app ? `${app.name} · ${courseTitle(app)}` : undefined}
        footer={
          app ? (
            <>
              <Button variant="secondary" onClick={() => setSelectedId(null)} disabled={busy}>
                Close
              </Button>
              {app.status === 'APPROVED' && !app.convertedEnrollment ? (
                <Button
                  onClick={() =>
                    convert.mutate(app.id, {
                      onSuccess: (result) => {
                        toast.success(
                          result.alreadyConverted ? 'Already converted' : 'Enrollment created',
                          result.alreadyConverted
                            ? 'This application was already converted.'
                            : 'A pending enrollment was created. Activate it from Enrollments after confirming payment.'
                        );
                      },
                      onError: (error) => {
                        toast.error('Conversion failed', error instanceof Error ? error.message : 'Please try again.');
                      },
                    })
                  }
                  loading={convert.isPending}
                >
                  Convert to enrollment
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        {detail.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : detail.isError || !app ? (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="la-name" label="Name">
                <Input id="la-name" value={app.name} readOnly />
              </Field>
              <Field id="la-email" label="Email">
                <Input id="la-email" value={app.email} readOnly />
              </Field>
              <Field id="la-whatsapp" label="WhatsApp">
                <Input id="la-whatsapp" value={app.whatsappNumber} readOnly />
              </Field>
              <Field id="la-city" label="Current city">
                <Input id="la-city" value={app.currentCity} readOnly />
              </Field>
              <Field id="la-company" label="Company">
                <Input id="la-company" value={app.currentCompany} readOnly />
              </Field>
              <Field id="la-course" label="Course interested">
                <Input id="la-course" value={app.courseInterested} readOnly />
              </Field>
              <Field id="la-livecourse" label="Live course">
                <Input id="la-livecourse" value={courseTitle(app)} readOnly />
              </Field>
              <Field id="la-referral" label="Referral source">
                <Input id="la-referral" value={app.referralSource} readOnly />
              </Field>
              <Field id="la-student" label="Linked student">
                <Input
                  id="la-student"
                  value={
                    app.student && typeof app.student === 'object'
                      ? [app.student.firstName, app.student.lastName].filter(Boolean).join(' ') || app.student.email || ''
                      : app.student
                        ? 'Linked'
                        : 'Not registered'
                  }
                  readOnly
                />
              </Field>
              <Field id="la-submitted" label="Submitted">
                <Input id="la-submitted" value={app.createdAt ? formatDate(app.createdAt) : '—'} readOnly />
              </Field>
            </div>

            {app.comment ? (
              <Field id="la-comment" label="Comment">
                <Textarea id="la-comment" value={app.comment} readOnly rows={3} />
              </Field>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="la-status" label="Status">
                <Select
                  id="la-status"
                  value={app.status}
                  disabled={busy || app.status === 'CONVERTED'}
                  onChange={(e) =>
                    updateStatus.mutate(
                      { id: app.id, input: { status: e.target.value as LiveApplicationStatus } },
                      {
                        onSuccess: () => toast.success('Status updated'),
                        onError: (error) =>
                          toast.error('Update failed', error instanceof Error ? error.message : 'Please try again.'),
                      }
                    )
                  }
                >
                  {app.status === 'CONVERTED' ? (
                    <option value="CONVERTED">Converted</option>
                  ) : (
                    REVIEWABLE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))
                  )}
                </Select>
              </Field>
              <Field id="la-remarks" label="Admin remarks">
                <div className="flex gap-2">
                  <Input
                    id="la-remarks"
                    defaultValue={app.adminRemarks ?? ''}
                    placeholder="Internal notes…"
                    aria-label="Admin remarks"
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value !== (app.adminRemarks ?? '')) {
                        updateRemarks.mutate(
                          { id: app.id, input: { adminRemarks: value } },
                          {
                            onSuccess: () => toast.success('Remarks saved'),
                            onError: (error) =>
                              toast.error('Save failed', error instanceof Error ? error.message : 'Please try again.'),
                          }
                        );
                      }
                    }}
                  />
                </div>
              </Field>
            </div>

            {app.convertedEnrollment ? (
              <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ink-muted">
                Converted to enrollment <span className="font-mono">{app.convertedEnrollment}</span>. Activate or
                manage it from the Enrollments page.
              </p>
            ) : null}
          </div>
        )}
      </Dialog>
    </div>
  );
}
