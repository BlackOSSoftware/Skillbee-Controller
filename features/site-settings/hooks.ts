'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { siteSettingsService } from '@/services/site-settings.service';
import type { UpdateSiteSettingsInput } from '@/types/site-settings';

export function useSiteSettingsAdmin() {
  return useQuery({
    queryKey: queryKeys.siteSettings.admin(),
    queryFn: () => siteSettingsService.getAdmin(),
    staleTime: 60 * 1000,
  });
}

export function useUpdateSiteSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSiteSettingsInput) => siteSettingsService.updateAdmin(input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.siteSettings.admin(), data);
      // Public projection is cached server-side (300s) — refetch to verify.
      queryClient.invalidateQueries({ queryKey: queryKeys.siteSettings.public() });
    },
  });
}

export function usePublicSiteSettings(enabled = true) {
  return useQuery({
    queryKey: queryKeys.siteSettings.public(),
    queryFn: () => siteSettingsService.getPublic(),
    enabled,
    staleTime: 60 * 1000,
  });
}
