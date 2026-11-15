'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { liveApplicationsService } from '@/services/live-applications.service';
import type {
  LiveApplicationListParams,
  UpdateLiveApplicationRemarksInput,
  UpdateLiveApplicationStatusInput,
} from '@/types/live-applications';

export function useLiveApplicationList(params: LiveApplicationListParams) {
  return useQuery({
    queryKey: queryKeys.liveApplications.list(params),
    queryFn: () => liveApplicationsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useLiveApplicationDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.liveApplications.detail(id ?? ''),
    queryFn: () => liveApplicationsService.get(id as string),
    enabled: Boolean(id),
    staleTime: 0,
  });
}

function useInvalidateLiveApplications() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.liveApplications.all });
  };
}

export function useUpdateLiveApplicationStatus() {
  const invalidate = useInvalidateLiveApplications();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLiveApplicationStatusInput }) =>
      liveApplicationsService.updateStatus(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateLiveApplicationRemarks() {
  const invalidate = useInvalidateLiveApplications();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLiveApplicationRemarksInput }) =>
      liveApplicationsService.updateRemarks(id, input),
    onSuccess: invalidate,
  });
}

export function useConvertLiveApplication() {
  const invalidate = useInvalidateLiveApplications();
  return useMutation({
    mutationFn: (id: string) => liveApplicationsService.convert(id),
    onSuccess: invalidate,
  });
}
