'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { dashboardService } from '@/services/dashboard.service';
import { newsletterService } from '@/services/newsletter.service';
import type {
  CampaignListParams,
  CreateCampaignInput,
  NewsletterCampaign,
  NewsletterSubscriber,
  SubscriberListParams,
  SubscriberStatus,
} from '@/types/newsletter';

export const SUBSCRIBER_STATUSES = ['all', 'pending', 'subscribed', 'unsubscribed'] as const;
export type SubscriberStatKey = (typeof SUBSCRIBER_STATUSES)[number];

const SUB_STAT_PARAMS: Record<SubscriberStatKey, Record<string, string>> = {
  all: {},
  pending: { status: 'pending' },
  subscribed: { status: 'subscribed' },
  unsubscribed: { status: 'unsubscribed' },
};

/** Totals from list pagination (no aggregate endpoint exists). */
export function useSubscriberStats() {
  const results = useQueries({
    queries: SUBSCRIBER_STATUSES.map((key) => ({
      queryKey: [...queryKeys.newsletter.all, 'sub-stat', key],
      queryFn: () => dashboardService.count('/admin/newsletter/subscribers', SUB_STAT_PARAMS[key]),
    })),
  });
  return SUBSCRIBER_STATUSES.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<SubscriberStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

export function useSubscriberList(params: SubscriberListParams) {
  return useQuery({
    queryKey: queryKeys.newsletter.subscribers.list(params),
    queryFn: () => newsletterService.listSubscribers(params),
    placeholderData: keepPreviousData,
  });
}

export function useSubscriberDetail(id: string, seed?: NewsletterSubscriber) {
  return useQuery({
    queryKey: queryKeys.newsletter.subscribers.detail(id),
    queryFn: () => newsletterService.getSubscriber(id),
    placeholderData: seed,
    staleTime: 0,
  });
}

function useInvalidateSubscribers() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.newsletter.subscribers.lists() });
    queryClient.invalidateQueries({ queryKey: [...queryKeys.newsletter.all, 'subscribers', 'detail'] });
  };
}

function useForgetMissingSubscriber() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateSubscribers();
  return (error: unknown, id: string) => {
    if (normalizeApiError(error).status !== 404) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.newsletter.subscribers.detail(id) });
    invalidate();
  };
}

export function useSetSubscriberStatus() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateSubscribers();
  const forgetMissing = useForgetMissingSubscriber();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SubscriberStatus }) =>
      newsletterService.setSubscriberStatus(id, status),
    onError: (e, { id }) => forgetMissing(e, id),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.newsletter.subscribers.detail(updated.id), updated);
      invalidate();
    },
  });
}

export function useDeleteSubscriber() {
  const invalidate = useInvalidateSubscribers();
  const forgetMissing = useForgetMissingSubscriber();
  return useMutation({
    mutationFn: (id: string) => newsletterService.deleteSubscriber(id),
    onError: (e, id) => forgetMissing(e, id),
    onSuccess: () => invalidate(),
  });
}

// ---- Campaigns ----

export function useCampaignList(params: CampaignListParams) {
  return useQuery({
    queryKey: queryKeys.newsletter.campaigns.list(params),
    queryFn: () => newsletterService.listCampaigns(params),
    placeholderData: keepPreviousData,
  });
}

export function useCampaignDetail(id: string, seed?: NewsletterCampaign) {
  return useQuery({
    queryKey: queryKeys.newsletter.campaigns.detail(id),
    queryFn: () => newsletterService.getCampaign(id),
    placeholderData: seed,
    staleTime: 0,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCampaignInput) => newsletterService.createCampaign(input),
    onSuccess: (created) => {
      queryClient.setQueryData(queryKeys.newsletter.campaigns.detail(created.id), created);
      queryClient.invalidateQueries({ queryKey: queryKeys.newsletter.campaigns.lists() });
    },
  });
}
