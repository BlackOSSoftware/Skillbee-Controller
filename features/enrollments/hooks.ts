'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { PERSIST_META } from '@/lib/query-persist';
import { coursesService } from '@/services/courses.service';
import { dashboardService } from '@/services/dashboard.service';
import { enrollmentsService } from '@/services/enrollments.service';
import { usersService } from '@/services/users.service';
import type { CourseListParams } from '@/types/courses';
import type { CreateEnrollmentInput, EnrollmentListParams, EnrollmentRecord, EnrollmentStatus } from '@/types/enrollments';
import type { UsersListParams } from '@/types/users';

export function useEnrollmentsList(params: EnrollmentListParams) {
  return useQuery({
    queryKey: queryKeys.enrollments.list(params),
    queryFn: () => enrollmentsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export const ENROLLMENT_STAT_KEYS = ['all', 'active', 'pending', 'completed', 'revoked'] as const;
export type EnrollmentStatKey = (typeof ENROLLMENT_STAT_KEYS)[number];

/** Totals from list pagination (no aggregate endpoint); persisted across reloads. */
export function useEnrollmentStats() {
  const results = useQueries({
    queries: ENROLLMENT_STAT_KEYS.map((key) => ({
      queryKey: queryKeys.enrollments.stat(key),
      queryFn: () => dashboardService.count('/admin/enrollments', key === 'all' ? {} : { status: key }),
      meta: PERSIST_META,
    })),
  });
  return ENROLLMENT_STAT_KEYS.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<EnrollmentStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

/** Fetched only while the learner drawer shows the matching tab. */
export function useEnrollmentProgress(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.enrollments.progress(id ?? ''),
    queryFn: () => enrollmentsService.progress(id as string),
    enabled: Boolean(id) && enabled,
  });
}

export function useEnrollmentHistory(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.enrollments.history(id ?? ''),
    queryFn: () => enrollmentsService.history(id as string),
    enabled: Boolean(id) && enabled,
  });
}

/** History only carries actor ids; names come from GET /admin/users/:id (shared users cache). */
export function useHistoryActors(ids: string[], enabled: boolean) {
  const unique = [...new Set(ids)].slice(0, 10);
  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: queryKeys.users.detail(id),
      queryFn: () => usersService.get(id),
      enabled,
      staleTime: 10 * 60_000,
      retry: false,
    })),
  });
  const names = new Map<string, string>();
  unique.forEach((id, i) => {
    const user = results[i].data;
    if (user) names.set(id, [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email);
  });
  return names;
}

/** Student picker for the create dialog (same cache entries as User Management). */
export function useStudentOptions(search: string, enabled: boolean) {
  const params: UsersListParams = { page: 1, limit: 8, role: 'student', search: search || undefined };
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => usersService.list(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** Course picker / filter options (same cache entries as Course Management). */
export function useCourseOptions(search: string, enabled: boolean, limit = 8) {
  const params: CourseListParams = { page: 1, limit, search: search || undefined, sortBy: 'title', sortOrder: 'asc' };
  return useQuery({
    queryKey: queryKeys.courses.list(params),
    queryFn: () => coursesService.list(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

function useInvalidateEnrollment() {
  const queryClient = useQueryClient();
  return (record: EnrollmentRecord) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.stats() });
    queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.progress(record.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.history(record.id) });
    // Dashboard counts enrollments; courses show enrolled-student totals and analytics
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.courses.analytics(record.courseId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.courses.detail(record.courseId) });
  };
}

export function useCreateEnrollment() {
  const invalidate = useInvalidateEnrollment();
  return useMutation({
    mutationFn: (input: CreateEnrollmentInput) => enrollmentsService.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateEnrollmentStatus() {
  const invalidate = useInvalidateEnrollment();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: EnrollmentStatus; reason?: string }) => enrollmentsService.updateStatus(id, status, reason),
    onSuccess: invalidate,
  });
}
