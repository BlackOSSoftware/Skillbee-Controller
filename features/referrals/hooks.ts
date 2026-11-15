'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { dashboardService } from '@/services/dashboard.service';
import { referralsService } from '@/services/referrals.service';
import type { Referral, ReferralListParams, UpdateReferralStatusInput } from '@/types/referrals';

export const REFERRAL_STATUSES = ['all', 'pending', 'contacted', 'converted', 'rejected'] as const;
export type ReferralStatKey = (typeof REFERRAL_STATUSES)[number];

const STAT_PARAMS: Record<ReferralStatKey, Record<string, string>> = {
  all: {},
  pending: { status: 'pending' },
  contacted: { status: 'contacted' },
  converted: { status: 'converted' },
  rejected: { status: 'rejected' },
};

/** Totals from list pagination (no aggregate endpoint exists). */
export function useReferralStats() {
  const results = useQueries({
    queries: REFERRAL_STATUSES.map((key) => ({
      queryKey: queryKeys.referrals.stat(key),
      queryFn: () => dashboardService.count('/admin/referrals', STAT_PARAMS[key]),
    })),
  });
  return REFERRAL_STATUSES.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<ReferralStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

export function useReferralList(params: ReferralListParams) {
  return useQuery({
    queryKey: queryKeys.referrals.list(params),
    queryFn: () => referralsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useReferralDetail(id: string, seed?: Referral) {
  return useQuery({
    queryKey: queryKeys.referrals.detail(id),
    queryFn: () => referralsService.get(id),
    placeholderData: seed,
    staleTime: 0,
  });
}

function useInvalidateReferrals() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.referrals.lists() });
    queryClient.invalidateQueries({ queryKey: [...queryKeys.referrals.all, 'detail'] });
    for (const key of REFERRAL_STATUSES) queryClient.invalidateQueries({ queryKey: queryKeys.referrals.stat(key) });
  };
}

function useForgetMissingReferral() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateReferrals();
  return (error: unknown, id: string) => {
    if (normalizeApiError(error).status !== 404) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.referrals.detail(id) });
    invalidate();
  };
}

export function useUpdateReferralStatus() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateReferrals();
  const forgetMissing = useForgetMissingReferral();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReferralStatusInput }) =>
      referralsService.updateStatus(id, input),
    onError: (e, { id }) => forgetMissing(e, id),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.referrals.detail(updated.id), updated);
      invalidate();
    },
  });
}

export function useDeleteReferral() {
  const invalidate = useInvalidateReferrals();
  const forgetMissing = useForgetMissingReferral();
  return useMutation({
    mutationFn: (id: string) => referralsService.remove(id),
    onError: (e, id) => forgetMissing(e, id),
    onSuccess: () => invalidate(),
  });
}
