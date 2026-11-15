'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { dashboardService } from '@/services/dashboard.service';
import { reviewsService } from '@/services/reviews.service';
import type { AdminReview, AdminReviewDetail, ModerateReviewInput, ReviewListParams } from '@/types/reviews';
import { COURSE_CATALOG_KEY, useCourseCatalog } from '@/features/shared/lookups';

export const REVIEW_STAT_KEYS = ['all', 'pending', 'approved', 'rejected'] as const;
export type ReviewStatKey = (typeof REVIEW_STAT_KEYS)[number];

/** Totals from list pagination (the backend has no review aggregate endpoint). */
export function useReviewStats() {
  const results = useQueries({
    queries: REVIEW_STAT_KEYS.map((key) => ({
      queryKey: queryKeys.reviews.stat(key),
      queryFn: () => dashboardService.count('/admin/reviews', key === 'all' ? {} : { status: key }),
    })),
  });
  return REVIEW_STAT_KEYS.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<ReviewStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

/**
 * Average of approved reviews from each course's backend-maintained `ratingStats`. Only reported when
 * the course catalog is complete (every course loaded), otherwise it would be a partial figure.
 */
export function useApprovedRating(courseId: string) {
  const { query, courses } = useCourseCatalog();
  const complete = Boolean(query.data && query.data.pagination.total <= courses.length);
  const scope = courseId ? courses.filter((c) => c.id === courseId) : courses;
  const count = scope.reduce((n, c) => n + (c.ratingStats?.approvedReviewCount ?? 0), 0);
  const sum = scope.reduce((n, c) => n + (c.ratingStats?.averageRating ?? 0) * (c.ratingStats?.approvedReviewCount ?? 0), 0);
  return {
    isLoading: query.isPending,
    error: query.error,
    available: courseId ? scope.length === 1 : complete,
    average: count ? sum / count : null,
    count,
  };
}

export function useReviewList(params: ReviewListParams) {
  return useQuery({ queryKey: queryKeys.reviews.list(params), queryFn: () => reviewsService.list(params), placeholderData: keepPreviousData });
}

/** Seeded from the list row; the detail adds moderation history and is re-read on open. */
export function useReview(id: string, seed?: AdminReview) {
  return useQuery({
    queryKey: queryKeys.reviews.detail(id),
    queryFn: () => reviewsService.get(id),
    placeholderData: seed ? ({ ...seed, moderationHistory: [], deletedAt: null } satisfies AdminReviewDetail) : undefined,
    staleTime: 0,
  });
}

/** Moderation changes counts, lists and the course's approved rating. */
function useInvalidateReviews() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.reviews.lists() });
    for (const key of REVIEW_STAT_KEYS) queryClient.invalidateQueries({ queryKey: queryKeys.reviews.stat(key) });
    queryClient.invalidateQueries({ queryKey: COURSE_CATALOG_KEY });
  };
}

/** A 404 means another admin already deleted the review: drop it and refresh what still shows it. */
function useForgetMissingReview() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateReviews();
  return (error: unknown, id: string) => {
    if (normalizeApiError(error).status !== 404) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.reviews.detail(id) });
    invalidate();
  };
}

export function useModerateReview() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateReviews();
  const forgetMissing = useForgetMissingReview();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ModerateReviewInput }) => reviewsService.moderate(id, input),
    onError: (e, { id }) => forgetMissing(e, id),
    onSuccess: (r) => {
      // The PATCH response is not populated; keep the cached student/course and take the new moderation fields.
      queryClient.setQueryData<AdminReviewDetail>(queryKeys.reviews.detail(r.id), (old) =>
        old ? { ...old, status: r.status, rejectionReason: r.rejectionReason, moderatedAt: r.moderatedAt, moderationHistory: r.moderationHistory, updatedAt: r.updatedAt } : old
      );
      invalidate();
    },
  });
}

/** Soft-deleted reviews return 404 afterwards, so the cached detail is dropped. */
export function useDeleteReview() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateReviews();
  const forgetMissing = useForgetMissingReview();
  return useMutation({
    mutationFn: (id: string) => reviewsService.remove(id),
    onError: (e, id) => forgetMissing(e, id),
    onSuccess: (_r, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.reviews.detail(id) });
      invalidate();
    },
  });
}
