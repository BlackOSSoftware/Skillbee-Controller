'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { dashboardService } from '@/services/dashboard.service';
import { supportTicketsService } from '@/services/support-tickets.service';
import type {
  SupportStatus,
  SupportTicket,
  TicketListParams,
  TicketReplyInput,
} from '@/types/contact';

export const TICKET_STAT_KEYS = ['all', 'open', 'reviewed', 'resolved', 'closed'] as const;
export type TicketStatKey = (typeof TICKET_STAT_KEYS)[number];

const STAT_PARAMS: Record<TicketStatKey, Record<string, string>> = {
  all: {},
  open: { status: 'open' },
  reviewed: { status: 'reviewed' },
  resolved: { status: 'resolved' },
  closed: { status: 'closed' },
};

/** Admin totals from list pagination (no aggregate endpoint exists). */
export function useTicketStats() {
  const results = useQueries({
    queries: TICKET_STAT_KEYS.map((key) => ({
      queryKey: queryKeys.support.stat(key),
      queryFn: () => dashboardService.count('/admin/support/tickets', STAT_PARAMS[key]),
    })),
  });
  return TICKET_STAT_KEYS.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<TicketStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

// ---------- Admin ----------

export function useAdminTicketList(params: TicketListParams) {
  return useQuery({
    queryKey: queryKeys.support.adminList(params),
    queryFn: () => supportTicketsService.listAdmin(params),
    placeholderData: keepPreviousData,
  });
}

export function useAdminTicket(id: string, seed?: SupportTicket) {
  return useQuery({
    queryKey: queryKeys.support.adminDetail(id),
    queryFn: () => supportTicketsService.getAdmin(id),
    placeholderData: seed,
    staleTime: 0,
  });
}

function useInvalidateAdminTickets() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.support.adminLists() });
    for (const key of TICKET_STAT_KEYS) queryClient.invalidateQueries({ queryKey: queryKeys.support.stat(key) });
    queryClient.invalidateQueries({ queryKey: [...queryKeys.support.all, 'admin', 'detail'] });
    queryClient.invalidateQueries({ queryKey: [...queryKeys.support.all, 'admin', 'history'] });
  };
}

function useForgetMissingTicket() {
  const queryClient = useQueryClient();
  const invalidateAdmin = useInvalidateAdminTickets();
  return (error: unknown, id: string) => {
    if (normalizeApiError(error).status !== 404) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.support.adminDetail(id) });
    invalidateAdmin();
  };
}

export function useUpdateTicketStatus() {
  const invalidate = useInvalidateAdminTickets();
  const forgetMissing = useForgetMissingTicket();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SupportStatus }) => supportTicketsService.updateStatus(id, status),
    onError: (e, { id }) => forgetMissing(e, id),
    onSuccess: () => invalidate(),
  });
}

export function useAssignTicket() {
  const invalidate = useInvalidateAdminTickets();
  return useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string | null }) => supportTicketsService.assign(id, assignedTo),
    onSuccess: () => invalidate(),
  });
}

export function useReplyAdminTicket() {
  const invalidate = useInvalidateAdminTickets();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TicketReplyInput }) => supportTicketsService.replyAdmin(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useAddTicketNote() {
  const invalidate = useInvalidateAdminTickets();
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) => supportTicketsService.addNote(id, message),
    onSuccess: () => invalidate(),
  });
}
