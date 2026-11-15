'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { dashboardService } from '@/services/dashboard.service';
import { instructorApplicationsService } from '@/services/instructor-applications.service';
import type {
  InstructorApplication,
  InstructorApplicationListParams,
  UpdateApplicationStatusInput,
} from '@/types/instructor-applications';

export const APPLICATION_STATUSES = ['all', 'pending', 'reviewing', 'shortlisted', 'approved', 'rejected'] as const;
export type ApplicationStatKey = (typeof APPLICATION_STATUSES)[number];

const STAT_PARAMS: Record<ApplicationStatKey, Record<string, string>> = {
  all: {},
  pending: { status: 'pending' },
  reviewing: { status: 'reviewing' },
  shortlisted: { status: 'shortlisted' },
  approved: { status: 'approved' },
  rejected: { status: 'rejected' },
};

/** Totals from list pagination (no aggregate endpoint exists). */
export function useApplicationStats() {
  const results = useQueries({
    queries: APPLICATION_STATUSES.map((key) => ({
      queryKey: queryKeys.instructorApplications.stat(key),
      queryFn: () => dashboardService.count('/admin/instructor-applications', STAT_PARAMS[key]),
    })),
  });
  return APPLICATION_STATUSES.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<ApplicationStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

export function useApplicationList(params: InstructorApplicationListParams) {
  return useQuery({
    queryKey: queryKeys.instructorApplications.list(params),
    queryFn: () => instructorApplicationsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useApplicationDetail(id: string, seed?: InstructorApplication) {
  return useQuery({
    queryKey: queryKeys.instructorApplications.detail(id),
    queryFn: () => instructorApplicationsService.get(id),
    placeholderData: seed,
    staleTime: 0,
  });
}

function useInvalidateApplications() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.instructorApplications.lists() });
    queryClient.invalidateQueries({ queryKey: [...queryKeys.instructorApplications.all, 'detail'] });
    for (const key of APPLICATION_STATUSES) {
      queryClient.invalidateQueries({ queryKey: queryKeys.instructorApplications.stat(key) });
    }
  };
}

function useForgetMissingApplication() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateApplications();
  return (error: unknown, id: string) => {
    if (normalizeApiError(error).status !== 404) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.instructorApplications.detail(id) });
    invalidate();
  };
}

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateApplications();
  const forgetMissing = useForgetMissingApplication();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateApplicationStatusInput }) =>
      instructorApplicationsService.updateStatus(id, input),
    onError: (e, { id }) => forgetMissing(e, id),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.instructorApplications.detail(updated.id), updated);
      invalidate();
    },
  });
}

export function useDeleteApplication() {
  const invalidate = useInvalidateApplications();
  const forgetMissing = useForgetMissingApplication();
  return useMutation({
    mutationFn: (id: string) => instructorApplicationsService.remove(id),
    onError: (e, id) => forgetMissing(e, id),
    onSuccess: () => invalidate(),
  });
}

export function useDownloadResume() {
  return useMutation({
    mutationFn: ({ id, fallbackName }: { id: string; fallbackName: string }) =>
      instructorApplicationsService.downloadResume(id, fallbackName),
  });
}
