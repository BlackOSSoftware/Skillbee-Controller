'use client';

import { BadgeCheck, BookOpen, CircleCheck, CircleDashed, CircleSlash, UserX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { formatDate, formatRelative, titleCase } from '@/lib/format';
import { displayName } from '@/lib/roles';
import type { UserStatus } from '@/types/auth';
import type { Instructor } from '@/types/instructors';
import { UserAvatar } from '@/features/users/components/user-avatar';
import { UserStatusBadge } from '@/features/users/components/user-status-badge';
import { COURSES_PAGE_SIZE, useInstructorCourses, useInstructorDetail } from '../hooks';
import { instructorStatusLockReason } from '../policy';

const courseTone: Record<string, BadgeTone> = { published: 'success', draft: 'neutral', archived: 'warning' };

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-ink">{children}</dd>
    </div>
  );
}

function Verified({ ok }: { ok: boolean | undefined }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-success">
      <BadgeCheck className="size-3.5" aria-hidden /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-ink-subtle">
      <CircleDashed className="size-3.5" aria-hidden /> Not verified
    </span>
  );
}

interface InstructorDrawerProps {
  instructorId: string | null;
  onClose: () => void;
  onStatusAction: (instructor: Instructor, status: UserStatus) => void;
  statusPending: boolean;
}

export function InstructorDrawer({ instructorId, onClose, onStatusAction, statusPending }: InstructorDrawerProps) {
  const { user: actor } = useAuth();
  const [coursePage, setCoursePage] = useState(1);
  const detail = useInstructorDetail(instructorId);
  const courses = useInstructorCourses(instructorId, coursePage);
  const instructor = detail.data;
  const lockReason = instructor ? instructorStatusLockReason(actor, instructor) : null;
  const meta = courses.data?.pagination;

  const footer =
    instructor && !lockReason ? (
      <>
        {instructor.status !== 'active' ? (
          <Button size="sm" variant="secondary" loading={statusPending} onClick={() => onStatusAction(instructor, 'active')}>
            <CircleCheck className="size-3.5" aria-hidden /> Activate
          </Button>
        ) : null}
        {instructor.status !== 'inactive' ? (
          <Button size="sm" variant="secondary" disabled={statusPending} onClick={() => onStatusAction(instructor, 'inactive')}>
            <CircleSlash className="size-3.5" aria-hidden /> Deactivate
          </Button>
        ) : null}
        {instructor.status !== 'suspended' ? (
          <Button size="sm" variant="danger" disabled={statusPending} onClick={() => onStatusAction(instructor, 'suspended')}>
            <UserX className="size-3.5" aria-hidden /> Suspend
          </Button>
        ) : null}
      </>
    ) : instructor ? (
      <p className="mr-auto self-center text-xs text-ink-muted">{lockReason}</p>
    ) : undefined;

  return (
    <Dialog
      open={Boolean(instructorId)}
      onClose={onClose}
      placement="right"
      title="Instructor details"
      description="Profile and assigned courses"
      footer={footer}
    >
      {detail.isPending ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      ) : instructor ? (
        <div className="space-y-6">
          <section className="flex items-center gap-4">
            <UserAvatar user={{ ...instructor, role: null }} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink">{displayName(instructor)}</p>
              <p className="truncate text-sm text-ink-muted">{instructor.email}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <UserStatusBadge status={instructor.status} />
                <Badge tone="brand">{instructor.role?.name ?? titleCase(instructor.role?.slug ?? 'staff')}</Badge>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Profile</h3>
            <dl className="divide-y divide-line rounded-xl border border-line px-4">
              <Row label="Phone">{instructor.phone || '—'}</Row>
              <Row label="Email">
                <Verified ok={instructor.emailVerified} />
              </Row>
              <Row label="Last login">{instructor.lastLogin ? formatRelative(instructor.lastLogin) : 'Never'}</Row>
              <Row label="Joined">{formatDate(instructor.createdAt)}</Row>
            </dl>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Assigned courses</h3>
              {meta ? <span className="text-xs text-ink-muted">{meta.total} total</span> : null}
            </div>
            {courses.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : courses.isError ? (
              <ErrorState error={courses.error} onRetry={() => courses.refetch()} />
            ) : !courses.data.data.length ? (
              <EmptyState icon={<BookOpen className="size-5" aria-hidden />} title="No courses assigned" description="Courses list this person under instructorIds." />
            ) : (
              <>
                <ul className={`divide-y divide-line rounded-xl border border-line ${courses.isPlaceholderData ? 'opacity-60' : ''}`}>
                  {courses.data.data.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <BookOpen className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{c.title}</p>
                        <p className="truncate text-[11px] text-ink-subtle">
                          {c.level ? titleCase(c.level) : '—'}
                          {c.publishedAt ? ` · Published ${formatDate(c.publishedAt)}` : ''}
                        </p>
                      </div>
                      <Badge tone={courseTone[c.status] ?? 'neutral'}>{titleCase(c.status)}</Badge>
                    </li>
                  ))}
                </ul>
                {meta && meta.totalPages > 1 ? (
                  <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
                    <span>
                      Page {meta.page} of {meta.totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" disabled={coursePage <= 1 || courses.isFetching} onClick={() => setCoursePage((p) => p - 1)}>
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={coursePage >= meta.totalPages || courses.isFetching}
                        onClick={() => setCoursePage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
            <p className="mt-2 text-[11px] text-ink-subtle">Showing up to {COURSES_PAGE_SIZE} courses per page.</p>
          </section>
        </div>
      ) : null}
    </Dialog>
  );
}
