'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { instructorsService } from '@/services/instructors.service';
import type { UserStatus } from '@/types/auth';
import type { Instructor } from '@/types/instructors';
import { staffKind } from './staff';

export const COURSES_PAGE_SIZE = 8;

/** Shared by the drawer and the Admin teaching check so both read one cache entry. */
function coursesQuery(id: string, page: number) {
  return {
    queryKey: queryKeys.instructors.courses(id, page),
    queryFn: () => instructorsService.courses(id, page, COURSES_PAGE_SIZE),
  };
}

/** Backend caps `limit` at 100. */
const ROSTER_PAGE_SIZE = 100;
const ROSTER_MAX_PAGES = 20;
export const ROSTER_MAX_RECORDS = ROSTER_PAGE_SIZE * ROSTER_MAX_PAGES;

export interface StaffRoster {
  /** Instructor and Admin accounts only, unique by id. */
  members: Instructor[];
  truncated: boolean;
}

async function fetchRoster(): Promise<StaffRoster> {
  const byId = new Map<string, Instructor>();
  let page = 1;
  let totalPages = 1;
  do {
    const res = await instructorsService.list({ page, limit: ROSTER_PAGE_SIZE });
    for (const member of res.data) {
      if (staffKind(member)) byId.set(member.id, member);
    }
    totalPages = res.pagination.totalPages;
    page += 1;
  } while (page <= Math.min(totalPages, ROSTER_MAX_PAGES));
  return { members: [...byId.values()], truncated: totalPages > ROSTER_MAX_PAGES };
}

/**
 * Teaching staff: every Instructor plus Admins with at least one assigned course.
 * The roster is filtered client-side because the list endpoint cannot filter by role.
 */
/** Instructor and Admin accounts (unfiltered by course assignment); also feeds the course instructor picker. */
export function useStaffRoster(enabled = true) {
  return useQuery({ queryKey: queryKeys.instructors.roster(), queryFn: fetchRoster, enabled });
}

export function useTeachingStaff() {
  const roster = useStaffRoster();
  const members = roster.data?.members ?? [];
  const admins = members.filter((m) => staffKind(m) === 'admin');
  const checks = useQueries({ queries: admins.map((admin) => coursesQuery(admin.id, 1)) });

  const teachingAdmins = new Set<string>();
  let checking = false;
  let unverified = 0;
  admins.forEach((admin, i) => {
    const check = checks[i];
    if (check.data) {
      if (check.data.pagination.total > 0) teachingAdmins.add(admin.id);
    } else if (check.isError) {
      unverified += 1;
    } else {
      checking = true;
    }
  });

  return {
    staff: members.filter((m) => staffKind(m) === 'instructor' || teachingAdmins.has(m.id)),
    isPending: roster.isPending || checking,
    error: roster.error,
    refetch: roster.refetch,
    truncated: roster.data?.truncated ?? false,
    /** Admins hidden because their course check failed (e.g. rate limited). */
    unverifiedAdmins: unverified,
    retryUnverified: () => checks.forEach((check) => check.isError && check.refetch()),
  };
}

/** Fetched only while the details drawer is open. */
export function useInstructorDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.instructors.detail(id ?? ''),
    queryFn: () => instructorsService.get(id as string),
    enabled: Boolean(id),
  });
}

/** Fetched only while the drawer is open; page 1 is already cached for Admins by the teaching check. */
export function useInstructorCourses(id: string | null, page: number) {
  return useQuery({
    ...coursesQuery(id ?? '', page),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateInstructorStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => instructorsService.updateStatus(id, status),
    onSuccess: (instructor) => {
      queryClient.setQueryData(queryKeys.instructors.detail(instructor.id), instructor);
      queryClient.setQueryData<StaffRoster>(queryKeys.instructors.roster(), (old) =>
        old ? { ...old, members: old.members.map((m) => (m.id === instructor.id ? instructor : m)) } : old
      );
      // The same account appears in User Management and dashboard counts
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
