'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { dashboardService } from '@/services/dashboard.service';
import { faqsService } from '@/services/faqs.service';
import type { CreateFaqInput, Faq, FaqListParams, FaqStatus, UpdateFaqInput } from '@/types/faqs';

export const FAQ_STATUSES = ['all', 'draft', 'published'] as const;
export type FaqStatKey = (typeof FAQ_STATUSES)[number];

const STAT_PARAMS: Record<FaqStatKey, Record<string, string>> = {
  all: {},
  draft: { status: 'draft' },
  published: { status: 'published' },
};

/** Totals from list pagination (no aggregate endpoint exists). */
export function useFaqStats() {
  const results = useQueries({
    queries: FAQ_STATUSES.map((key) => ({
      queryKey: [...queryKeys.faqs.all, 'stat', key],
      queryFn: () => dashboardService.count('/admin/faqs', STAT_PARAMS[key]),
    })),
  });
  return FAQ_STATUSES.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<FaqStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

export function useFaqList(params: FaqListParams) {
  return useQuery({
    queryKey: queryKeys.faqs.list(params),
    queryFn: () => faqsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useFaqDetail(id: string, seed?: Faq) {
  return useQuery({
    queryKey: queryKeys.faqs.detail(id),
    queryFn: () => faqsService.get(id),
    placeholderData: seed,
    staleTime: 0,
  });
}

function useInvalidateFaqs() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.faqs.lists() });
    queryClient.invalidateQueries({ queryKey: [...queryKeys.faqs.all, 'detail'] });
    for (const key of FAQ_STATUSES) queryClient.invalidateQueries({ queryKey: [...queryKeys.faqs.all, 'stat', key] });
  };
}

function useForgetMissingFaq() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateFaqs();
  return (error: unknown, id: string) => {
    if (normalizeApiError(error).status !== 404) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.faqs.detail(id) });
    invalidate();
  };
}

export function useCreateFaq() {
  const invalidate = useInvalidateFaqs();
  return useMutation({
    mutationFn: (input: CreateFaqInput) => faqsService.create(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateFaq() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateFaqs();
  const forgetMissing = useForgetMissingFaq();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFaqInput }) => faqsService.update(id, input),
    onError: (e, { id }) => forgetMissing(e, id),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.faqs.detail(updated.id), updated);
      invalidate();
    },
  });
}

export function useSetFaqStatus() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateFaqs();
  const forgetMissing = useForgetMissingFaq();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: FaqStatus }) => faqsService.setStatus(id, status),
    onError: (e, { id }) => forgetMissing(e, id),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.faqs.detail(updated.id), updated);
      invalidate();
    },
  });
}

export function useReorderFaqs() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateFaqs();
  return useMutation({
    mutationFn: (orderedIds: string[]) => faqsService.reorder(orderedIds),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: queryKeys.faqs.categories() });
    },
  });
}

export function useDeleteFaq() {
  const invalidate = useInvalidateFaqs();
  const forgetMissing = useForgetMissingFaq();
  return useMutation({
    mutationFn: (id: string) => faqsService.remove(id),
    onError: (e, id) => forgetMissing(e, id),
    onSuccess: () => invalidate(),
  });
}
