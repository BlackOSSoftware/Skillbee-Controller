'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { PERSIST_META } from '@/lib/query-persist';
import { coursesService } from '@/services/courses.service';
import { dashboardService } from '@/services/dashboard.service';
import type { Course, CourseInput, CourseListParams, CourseStatus, UpdateCourseInput } from '@/types/courses';

export function useCoursesList(params: CourseListParams) {
  return useQuery({
    queryKey: queryKeys.courses.list(params),
    queryFn: () => coursesService.list(params),
    placeholderData: keepPreviousData,
  });
}

/**
 * List rows already carry the full admin object, so the row seeds the detail cache and the
 * GET /admin/courses/:id request only runs once that seed is stale.
 */
export function useCourseDetail(id: string | null, seed?: { course: Course; updatedAt: number }) {
  return useQuery({
    queryKey: queryKeys.courses.detail(id ?? ''),
    queryFn: () => coursesService.get(id as string),
    enabled: Boolean(id),
    initialData: seed?.course,
    initialDataUpdatedAt: seed?.updatedAt,
  });
}

export function useCourseAnalytics(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.courses.analytics(id ?? ''),
    queryFn: () => coursesService.analytics(id as string),
    enabled: Boolean(id) && enabled,
  });
}

export function useCourseTopics(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.courses.topics(id ?? ''),
    queryFn: () => coursesService.topics(id as string),
    enabled: Boolean(id) && enabled,
  });
}

export const COURSE_STAT_KEYS = ['all', 'published', 'draft', 'archived'] as const;
export type CourseStatKey = (typeof COURSE_STAT_KEYS)[number];

/** Totals from list pagination (no aggregate endpoint); persisted across reloads. */
export function useCourseStats() {
  const results = useQueries({
    queries: COURSE_STAT_KEYS.map((key) => ({
      queryKey: queryKeys.courses.stat(key),
      queryFn: () => dashboardService.count('/admin/courses', key === 'all' ? {} : { status: key }),
      meta: PERSIST_META,
    })),
  });
  return COURSE_STAT_KEYS.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<CourseStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

function useApplyCourse() {
  const queryClient = useQueryClient();
  return (course: Course, { instructorsChanged = false }: { instructorsChanged?: boolean } = {}) => {
    queryClient.setQueryData(queryKeys.courses.detail(course.id), course);
    queryClient.invalidateQueries({ queryKey: queryKeys.courses.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.courses.stats() });
    queryClient.invalidateQueries({ queryKey: queryKeys.courses.analytics(course.id) });
    // Dashboard shows total and published course counts
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    if (instructorsChanged) queryClient.invalidateQueries({ queryKey: [...queryKeys.instructors.all, 'courses'] });
  };
}

export function useCreateCourse() {
  const apply = useApplyCourse();
  return useMutation({
    mutationFn: (input: CourseInput) => coursesService.create(input),
    onSuccess: (course, input) => apply(course, { instructorsChanged: Boolean(input.instructorIds?.length) }),
  });
}

export function useUpdateCourse() {
  const apply = useApplyCourse();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCourseInput }) => coursesService.update(id, input),
    onSuccess: (course, { input }) => apply(course, { instructorsChanged: input.instructorIds !== undefined }),
  });
}

export function useUpdateCourseStatus() {
  const apply = useApplyCourse();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CourseStatus }) => coursesService.updateStatus(id, status),
    onSuccess: (course) => apply(course),
  });
}
