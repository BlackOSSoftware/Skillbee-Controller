'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { PERSIST_META } from '@/lib/query-persist';
import { queryKeys } from '@/lib/query-keys';
import { dashboardService } from '@/services/dashboard.service';
import { usersService } from '@/services/users.service';
import type { DashboardStatDefinition } from './stats';

export interface StatResult {
  value: number | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

/** One query per source so a 403 on one statistic does not block the others. */
export function useDashboardStat(stat: DashboardStatDefinition): StatResult {
  const results = useQueries({
    queries: stat.sources.map((source, index) => ({
      queryKey: [...queryKeys.dashboard.stat(stat.id), index, source.path, source.params ?? {}],
      queryFn: () => dashboardService.count(source.path, source.params),
      staleTime: 5 * 60_000,
      meta: PERSIST_META,
    })),
  });

  const failed = results.find((r) => r.isError);
  const isLoading = results.some((r) => r.isPending);
  const value =
    !results.length || failed || isLoading ? null : results.reduce((sum, r) => sum + (r.data ?? 0), 0);

  return {
    value,
    isLoading,
    error: failed?.error ?? null,
    refetch: () => results.forEach((r) => r.refetch()),
  };
}

export function useRecentUsers(limit = 6) {
  return useQuery({
    queryKey: queryKeys.users.list({ page: 1, limit }),
    queryFn: () => usersService.list({ page: 1, limit }),
  });
}
