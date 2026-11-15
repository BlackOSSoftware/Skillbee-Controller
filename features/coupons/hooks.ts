'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { couponsService } from '@/services/coupons.service';
import { dashboardService } from '@/services/dashboard.service';
import type { Coupon, CouponListParams, CouponUsageParams, CreateCouponInput, UpdateCouponInput } from '@/types/coupons';

export const COUPON_STAT_KEYS = ['all', 'active', 'paused', 'expired'] as const;
export type CouponStatKey = (typeof COUPON_STAT_KEYS)[number];

const STAT_PARAMS: Record<CouponStatKey, Record<string, string>> = {
  all: {},
  active: { isActive: 'true' },
  paused: { isActive: 'false' },
  expired: { expired: 'true' },
};

/** Totals from list pagination (the backend has no coupon aggregate endpoint). */
export function useCouponStats() {
  const results = useQueries({
    queries: COUPON_STAT_KEYS.map((key) => ({
      queryKey: queryKeys.coupons.stat(key),
      queryFn: () => dashboardService.count('/admin/coupons', STAT_PARAMS[key]),
    })),
  });
  return COUPON_STAT_KEYS.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<CouponStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

export function useCouponList(params: CouponListParams) {
  return useQuery({ queryKey: queryKeys.coupons.list(params), queryFn: () => couponsService.list(params), placeholderData: keepPreviousData });
}

/** Detail is re-read on open: usage counters move as learners check out. */
export function useCoupon(id: string | null, seed?: Coupon) {
  return useQuery({
    queryKey: queryKeys.coupons.detail(id ?? ''),
    queryFn: () => couponsService.get(id as string),
    enabled: Boolean(id),
    placeholderData: seed,
    staleTime: 0,
  });
}

export function useCouponUsage(id: string, params: CouponUsageParams, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.coupons.usage(id, params),
    queryFn: () => couponsService.usage(id, params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

function useInvalidateCouponLists() {
  const queryClient = useQueryClient();
  return ({ stats = true }: { stats?: boolean } = {}) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.coupons.lists() });
    if (stats) for (const key of COUPON_STAT_KEYS) queryClient.invalidateQueries({ queryKey: queryKeys.coupons.stat(key) });
  };
}

/** The counters only depend on these fields (see STAT_PARAMS). */
const STAT_FIELDS: Array<keyof UpdateCouponInput> = ['isActive', 'expiryDate', 'startDate'];

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCouponLists();
  return useMutation({
    mutationFn: (input: CreateCouponInput) => couponsService.create(input),
    onSuccess: (coupon) => {
      queryClient.setQueryData(queryKeys.coupons.detail(coupon.id), coupon);
      invalidate();
    },
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCouponLists();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCouponInput }) => couponsService.update(id, input),
    onSuccess: (coupon, { input }) => {
      queryClient.setQueryData(queryKeys.coupons.detail(coupon.id), coupon);
      invalidate({ stats: STAT_FIELDS.some((k) => input[k] !== undefined) });
    },
  });
}

/** Archived coupons return 404 afterwards, so their cached detail and usage are dropped. */
export function useDeactivateCoupon() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCouponLists();
  return useMutation({
    mutationFn: (id: string) => couponsService.deactivate(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.coupons.detail(id) });
      queryClient.removeQueries({ queryKey: queryKeys.coupons.usages(id) });
      invalidate();
    },
  });
}
