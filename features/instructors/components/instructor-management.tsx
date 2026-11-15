'use client';

import { BookOpen, CircleAlert, CircleCheck, CircleSlash, Eye, GraduationCap, Search, UserX, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Select } from '@/components/ui/input';
import { KpiCard, type KpiTone } from '@/components/ui/kpi-card';
import { ActionMenu, type MenuItem } from '@/components/ui/menu';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatDate, formatNumber, titleCase } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { displayName, ROLE_SLUGS } from '@/lib/roles';
import { useToast } from '@/providers/toast-provider';
import type { UserStatus } from '@/types/auth';
import type { Instructor } from '@/types/instructors';
import { UserAvatar } from '@/features/users/components/user-avatar';
import { USER_STATUSES, UserStatusBadge } from '@/features/users/components/user-status-badge';
import { ROSTER_MAX_RECORDS, useTeachingStaff, useUpdateInstructorStatus } from '../hooks';
import { instructorStatusLockReason } from '../policy';
import { InstructorDrawer } from './instructor-drawer';

const PAGE_SIZES = [10, 20, 50];

type StatKey = 'all' | UserStatus;

const STAT_CARDS: Array<{ key: StatKey; label: string; tone: KpiTone; icon: typeof GraduationCap }> = [
  { key: 'all', label: 'Teaching staff', tone: 'purple', icon: GraduationCap },
  { key: 'active', label: 'Active', tone: 'teal', icon: CircleCheck },
  { key: 'inactive', label: 'Inactive', tone: 'sky', icon: CircleSlash },
  { key: 'suspended', label: 'Suspended', tone: 'coral', icon: UserX },
];

type Confirm = { instructor: Instructor; status: Exclude<UserStatus, 'active'> } | null;

const CONFIRM_COPY = {
  inactive: { title: 'Deactivate instructor?', label: 'Deactivate', body: 'They can no longer sign in until reactivated.' },
  suspended: { title: 'Suspend instructor?', label: 'Suspend', body: 'Access is blocked until an admin activates the account again.' },
} as const;

function InstructorRowMenu({
  instructor,
  onView,
  onStatus,
}: {
  instructor: Instructor;
  onView: (id: string) => void;
  onStatus: (instructor: Instructor, status: UserStatus) => void;
}) {
  const { user: actor } = useAuth();
  const i = instructor;
  const items: MenuItem[] = [{ key: 'view', label: 'View profile', icon: <Eye className="size-4" />, onSelect: () => onView(i.id) }];
  if (!instructorStatusLockReason(actor, i)) {
    if (i.status !== 'active') items.push({ key: 'a', label: 'Activate', icon: <CircleCheck className="size-4" />, onSelect: () => onStatus(i, 'active') });
    if (i.status !== 'inactive') items.push({ key: 'd', label: 'Deactivate', icon: <CircleSlash className="size-4" />, onSelect: () => onStatus(i, 'inactive') });
    if (i.status !== 'suspended')
      items.push({ key: 's', label: 'Suspend', icon: <UserX className="size-4" />, tone: 'danger', onSelect: () => onStatus(i, 'suspended') });
  }
  return <ActionMenu label={`Actions for ${displayName(i)}`} items={items} />;
}

function RoleTag({ instructor }: { instructor: Instructor }) {
  const slug = instructor.role?.slug;
  if (!slug || slug === ROLE_SLUGS.INSTRUCTOR) return null;
  return <Badge tone="brand">{instructor.role?.name ?? titleCase(slug)}</Badge>;
}

export function InstructorManagement() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  // isPending updates after re-render; this blocks duplicate status requests fired in the same tick
  const inFlight = useRef(false);

  const roster = useTeachingStaff();
  const updateStatus = useUpdateInstructorStatus();
  const filtersActive = Boolean(search || status);

  const term = search.trim().toLowerCase();
  const filtered = roster.staff.filter(
    (m) =>
      (!status || m.status === status) &&
      (!term || displayName(m).toLowerCase().includes(term) || m.email.toLowerCase().includes(term))
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * limit, currentPage * limit);
  const pagination = { page: currentPage, limit, total: filtered.length, totalPages };
  const counts: Record<StatKey, number> = {
    all: roster.staff.length,
    active: roster.staff.filter((m) => m.status === 'active').length,
    inactive: roster.staff.filter((m) => m.status === 'inactive').length,
    suspended: roster.staff.filter((m) => m.status === 'suspended').length,
  };

  function applyStatus(instructor: Instructor, next: UserStatus, onDone?: () => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    updateStatus.mutate(
      { id: instructor.id, status: next },
      {
        onSuccess: (updated) => {
          toast.success(`Instructor ${next === 'active' ? 'activated' : next === 'inactive' ? 'deactivated' : 'suspended'}`, displayName(updated));
          onDone?.();
        },
        onError: (error) => toast.error('Status change failed', normalizeApiError(error).message),
        onSettled: () => {
          inFlight.current = false;
        },
      }
    );
  }

  function requestStatus(instructor: Instructor, next: UserStatus) {
    if (next === 'active') applyStatus(instructor, next);
    else setConfirm({ instructor, status: next });
  }

  const coursesButton = (i: Instructor) => (
    <Button size="sm" variant="ghost" className="h-7 px-2 text-primary" onClick={() => setOpenId(i.id)}>
      <BookOpen className="size-3.5" aria-hidden />
      View courses
    </Button>
  );

  const copy = confirm ? CONFIRM_COPY[confirm.status] : null;

  return (
    <>
      <PageHeader
        title="Instructor Management"
        description="Instructors, plus Admins assigned to at least one course. Super Admins and other roles are not listed."
        actions={<RefreshButton queryKeys={[queryKeys.instructors.all]} />}
      />

      <section aria-label="Instructor totals" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, tone, icon }) => {
          const value: UserStatus | '' = key === 'all' ? '' : key;
          return (
            <KpiCard
              key={key}
              label={label}
              icon={icon}
              tone={tone}
              value={counts[key]}
              isLoading={roster.isPending}
              error={roster.error}
              active={status === value}
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
            />
          );
        })}
      </section>

      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:p-4">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search name or email"
              className="pl-9"
              aria-label="Search instructors"
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as UserStatus | '');
                setPage(1);
              }}
              className="min-w-0 flex-1 sm:w-40 sm:flex-none"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {USER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
            {filtersActive ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch('');
                  setStatus('');
                  setPage(1);
                }}
                aria-label="Clear filters"
              >
                <X className="size-4" aria-hidden />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            ) : null}
          </div>
        </div>

        {roster.unverifiedAdmins > 0 || roster.truncated ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-warning/10 px-3 py-2 text-xs text-ink sm:px-4" role="status">
            <CircleAlert className="size-3.5 shrink-0 text-warning" aria-hidden />
            <span className="min-w-0 flex-1">
              {roster.unverifiedAdmins > 0
                ? `Assigned courses could not be checked for ${roster.unverifiedAdmins} admin${roster.unverifiedAdmins === 1 ? '' : 's'}, so they are hidden.`
                : `Showing the first ${formatNumber(ROSTER_MAX_RECORDS)} staff records returned by the API.`}
            </span>
            {roster.unverifiedAdmins > 0 ? (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={roster.retryUnverified}>
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}

        {roster.error ? (
          <ErrorState error={roster.error} onRetry={() => roster.refetch()} />
        ) : !roster.isPending && rows.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="size-5" aria-hidden />}
            title={filtersActive ? 'No instructors match these filters' : 'No teaching staff yet'}
            description={
              filtersActive
                ? 'Try a different search or status.'
                : 'Users with the Instructor role, and Admins assigned to a course, appear here.'
            }
          />
        ) : (
          <>
            {/* Table (md and up) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-surface-2/60 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3">Instructor</th>
                    <th scope="col" className="hidden px-4 py-3 xl:table-cell">Email</th>
                    <th scope="col" className="px-4 py-3">Courses</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="hidden px-4 py-3 xl:table-cell">Joined</th>
                    <th scope="col" className="px-4 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {roster.isPending
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Skeleton className="size-9 rounded-full" />
                              <Skeleton className="h-4 w-28" />
                            </div>
                          </td>
                          {Array.from({ length: 4 }).map((__, j) => (
                            <td key={j} className={cn('px-4 py-3', (j === 0 || j === 3) && 'hidden xl:table-cell')}>
                              <Skeleton className="h-4 w-20" />
                            </td>
                          ))}
                          <td className="px-4 py-3" />
                        </tr>
                      ))
                    : rows.map((i) => (
                        <tr key={i.id} className="hover:bg-surface-2/50">
                          <td className="max-w-60 px-4 py-3">
                            <button type="button" onClick={() => setOpenId(i.id)} className="flex min-w-0 items-center gap-3 text-left">
                              <UserAvatar user={{ ...i, role: null }} />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-ink hover:text-primary">{displayName(i)}</span>
                                <span className="block truncate text-xs text-ink-muted xl:hidden">{i.email}</span>
                                <RoleTag instructor={i} />
                              </span>
                            </button>
                          </td>
                          <td className="hidden max-w-60 truncate px-4 py-3 text-ink-muted xl:table-cell">{i.email}</td>
                          <td className="px-4 py-3">{coursesButton(i)}</td>
                          <td className="px-4 py-3">
                            <UserStatusBadge status={i.status} />
                          </td>
                          <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-ink-muted xl:table-cell">{formatDate(i.createdAt)}</td>
                          <td className="px-4 py-3 text-right">
                            <InstructorRowMenu instructor={i} onView={setOpenId} onStatus={requestStatus} />
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {/* Cards (below md) */}
            <ul className="divide-y divide-line md:hidden">
              {roster.isPending
                ? Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="flex items-center gap-3 p-4">
                      <Skeleton className="size-9 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </li>
                  ))
                : rows.map((i) => (
                    <li key={i.id} className="space-y-2.5 p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <button type="button" onClick={() => setOpenId(i.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <UserAvatar user={{ ...i, role: null }} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-ink">{displayName(i)}</span>
                            <span className="block truncate text-xs text-ink-muted">{i.email}</span>
                          </span>
                        </button>
                        <InstructorRowMenu instructor={i} onView={setOpenId} onStatus={requestStatus} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <UserStatusBadge status={i.status} />
                        <RoleTag instructor={i} />
                        <span className="ml-auto">{coursesButton(i)}</span>
                      </div>
                    </li>
                  ))}
            </ul>
          </>
        )}

        <Pagination
          meta={roster.isPending || roster.error ? undefined : pagination}
          onPageChange={setPage}
          pageSizeOptions={PAGE_SIZES}
          onPageSizeChange={(size) => {
            setLimit(size);
            setPage(1);
          }}
        />
      </Card>

      {openId ? (
        <InstructorDrawer
          key={openId}
          instructorId={openId}
          onClose={() => setOpenId(null)}
          onStatusAction={requestStatus}
          statusPending={updateStatus.isPending}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={copy?.title ?? ''}
        confirmLabel={copy?.label ?? 'Confirm'}
        loading={updateStatus.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && applyStatus(confirm.instructor, confirm.status, () => setConfirm(null))}
        description={
          confirm ? (
            <>
              <p>
                <span className="font-semibold text-ink">{displayName(confirm.instructor)}</span> ({confirm.instructor.email})
              </p>
              <p className="mt-2">{copy?.body}</p>
            </>
          ) : null
        }
      />
    </>
  );
}
