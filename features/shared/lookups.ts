'use client';

import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { coursesService } from '@/services/courses.service';
import { usersService } from '@/services/users.service';
import type { CourseListParams } from '@/types/courses';
import type { UsersListParams } from '@/types/users';

/** Title-sorted course page shared by every module's course filter (one cache entry). */
const COURSE_CATALOG: CourseListParams = { page: 1, limit: 100, sortBy: 'title', sortOrder: 'asc' };
export const COURSE_CATALOG_KEY = queryKeys.courses.list(COURSE_CATALOG);

export function useCourseCatalog() {
  const query = useQuery({ queryKey: queryKeys.courses.list(COURSE_CATALOG), queryFn: () => coursesService.list(COURSE_CATALOG), staleTime: 5 * 60_000 });
  return { query, courses: query.data?.data ?? [] };
}

/** Learner lookup for student filters (needs users:read). */
export function useLearnerSearch(search: string, enabled: boolean) {
  const params: UsersListParams = { page: 1, limit: 6, search, role: 'student' };
  return useQuery({ queryKey: queryKeys.users.list(params), queryFn: () => usersService.list(params), enabled: enabled && search.length >= 2, placeholderData: keepPreviousData });
}

/** Resolves user ids to display names when the viewer can read users. */
export function useUserNames(ids: Array<string | null | undefined>, canRead: boolean) {
  const unique = canRead ? [...new Set(ids.filter((id): id is string => Boolean(id)))].slice(0, 10) : [];
  const results = useQueries({
    queries: unique.map((id) => ({ queryKey: queryKeys.users.detail(id), queryFn: () => usersService.get(id), staleTime: 10 * 60_000, retry: false })),
  });
  const names = new Map<string, { name: string; email: string }>();
  results.forEach((r, i) => {
    const u = r.data;
    if (u) names.set(unique[i], { name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email, email: u.email });
  });
  return names;
}
