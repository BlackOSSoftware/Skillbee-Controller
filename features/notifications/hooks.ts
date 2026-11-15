'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { notificationsService } from '@/services/notifications.service';
import type { AdminNotificationListParams, CreateAdminNotificationInput } from '@/types/notifications';

export function useMyNotifications(limit = 8, enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications.mine(limit),
    queryFn: () => notificationsService.listMine(limit),
    enabled,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

// ---- Admin notification management ----

export function useAdminNotifications(params: AdminNotificationListParams) {
  return useQuery({
    queryKey: queryKeys.notifications.admin.list(params),
    queryFn: () => notificationsService.listAdmin(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateAdminNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAdminNotificationInput) => notificationsService.createAdmin(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.admin.lists() });
    },
  });
}

// ---- Admin notification campaigns ----

export function useNotificationCampaigns(params: AdminNotificationListParams) {
  return useQuery({
    queryKey: [...queryKeys.notifications.admin.lists(), 'campaigns', params],
    queryFn: () => notificationsService.listCampaigns(params),
    placeholderData: keepPreviousData,
  });
}

export function useNotificationCampaign(campaignId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.notifications.admin.lists(), 'campaign', campaignId],
    queryFn: () => notificationsService.getCampaign(campaignId as string),
    enabled: Boolean(campaignId),
  });
}
