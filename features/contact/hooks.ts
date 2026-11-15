'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { contactEnquiriesService } from '@/services/contact-enquiries.service';
import { dashboardService } from '@/services/dashboard.service';
import type { ContactEnquiry, EnquiryListParams, SupportStatus } from '@/types/contact';

export const ENQUIRY_STAT_KEYS = ['all', 'open', 'reviewed', 'resolved', 'closed'] as const;
export type EnquiryStatKey = (typeof ENQUIRY_STAT_KEYS)[number];

/** Count queries mirror the list filters so each card matches what clicking it shows. */
const STAT_PARAMS: Record<EnquiryStatKey, Record<string, string>> = {
  all: {},
  open: { status: 'open' },
  reviewed: { status: 'reviewed' },
  resolved: { status: 'resolved' },
  closed: { status: 'closed' },
};

/** Totals from list pagination (the backend has no enquiry aggregate endpoint). */
export function useEnquiryStats() {
  const results = useQueries({
    queries: ENQUIRY_STAT_KEYS.map((key) => ({
      queryKey: queryKeys.contact.stat(key),
      queryFn: () => dashboardService.count('/admin/contact-enquiries', STAT_PARAMS[key]),
    })),
  });
  return ENQUIRY_STAT_KEYS.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<EnquiryStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

export function useEnquiryList(params: EnquiryListParams) {
  return useQuery({
    queryKey: queryKeys.contact.list(params),
    queryFn: () => contactEnquiriesService.list(params),
    placeholderData: keepPreviousData,
  });
}

/** Seeded from the list row; the detail adds notes/replies and is re-read on open. */
export function useEnquiry(id: string, seed?: ContactEnquiry) {
  return useQuery({
    queryKey: queryKeys.contact.detail(id),
    queryFn: () => contactEnquiriesService.get(id),
    placeholderData: seed,
    staleTime: 0,
  });
}

function useInvalidateEnquiries() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.contact.lists() });
    for (const key of ENQUIRY_STAT_KEYS) queryClient.invalidateQueries({ queryKey: queryKeys.contact.stat(key) });
    queryClient.invalidateQueries({ queryKey: [...queryKeys.contact.all, 'detail'] });
    queryClient.invalidateQueries({ queryKey: [...queryKeys.contact.all, 'history'] });
  };
}

/** A 404 means the enquiry is gone: refresh what still shows it. */
function useForgetMissingEnquiry() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateEnquiries();
  return (error: unknown, id: string) => {
    if (normalizeApiError(error).status !== 404) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.contact.detail(id) });
    invalidate();
  };
}

export function useUpdateEnquiryStatus() {
  const invalidate = useInvalidateEnquiries();
  const forgetMissing = useForgetMissingEnquiry();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SupportStatus }) => contactEnquiriesService.updateStatus(id, status),
    onError: (e, { id }) => forgetMissing(e, id),
    onSuccess: () => invalidate(),
  });
}

export function useReplyEnquiry() {
  const invalidate = useInvalidateEnquiries();
  return useMutation({
    mutationFn: ({ id, message, idempotencyKey }: { id: string; message: string; idempotencyKey?: string }) =>
      contactEnquiriesService.reply(id, message, idempotencyKey),
    onSuccess: () => invalidate(),
  });
}

export function useAddEnquiryNote() {
  const invalidate = useInvalidateEnquiries();
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => contactEnquiriesService.addNote(id, message),
    onSuccess: () => invalidate(),
  });
}
