'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { PERSIST_META } from '@/lib/query-persist';
import { isHiddenRole } from '@/lib/roles';
import { dashboardService } from '@/services/dashboard.service';
import { rolesService, usersService } from '@/services/users.service';
import type { UserStatus } from '@/types/auth';
import type { AdminUser, CreateUserInput, UpdateUserInput, UsersListParams } from '@/types/users';

export function useUsersList(params: UsersListParams) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => usersService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useUserDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.users.detail(id ?? ''),
    queryFn: () => usersService.get(id as string),
    enabled: Boolean(id),
  });
}

export const USER_STAT_KEYS = ['all', 'active', 'inactive', 'suspended'] as const;
export type UserStatKey = (typeof USER_STAT_KEYS)[number];

/** Totals per status from list pagination (no aggregate endpoint). Soft-deleted users are excluded by the backend. */
export function useUserStats() {
  const results = useQueries({
    queries: USER_STAT_KEYS.map((key) => ({
      queryKey: queryKeys.users.stat(key),
      queryFn: () => dashboardService.count('/admin/users', key === 'all' ? {} : { status: key }),
      meta: PERSIST_META,
    })),
  });
  return USER_STAT_KEYS.reduce(
    (acc, key, index) => {
      const r = results[index];
      acc[key] = { value: r.data ?? null, isLoading: r.isPending, error: r.error };
      return acc;
    },
    {} as Record<UserStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

/** Any user mutation can change lists, per-status totals and dashboard counts. */
function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return (updated?: AdminUser) => {
    if (updated) queryClient.setQueryData(queryKeys.users.detail(updated.id), updated);
    queryClient.invalidateQueries({ queryKey: queryKeys.users.lists() });
    queryClient.invalidateQueries({ queryKey: [...queryKeys.users.all, 'stat'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  };
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (input: CreateUserInput) => usersService.create(input),
    onSuccess: (user) => invalidate(user),
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => usersService.update(id, input),
    onSuccess: (user) => invalidate(user),
  });
}

export function useUpdateUserStatus() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => usersService.updateStatus(id, status),
    onSuccess: (user) => invalidate(user),
  });
}

export function useSoftDeleteUser() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => usersService.softDelete(id),
    onSuccess: (user) => {
      queryClient.removeQueries({ queryKey: queryKeys.users.detail(user.id) });
      invalidate();
    },
  });
}

export function useRolesList(enabled = true) {
  return useQuery({
    queryKey: queryKeys.roles.list(),
    queryFn: () => rolesService.list(),
    select: (roles) => roles.filter((r) => !isHiddenRole(r)),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** `fresh` re-asks the backend on mount so a revoked permissions:read is caught (403) instead of served from cache. */
export function usePermissionsCatalog(enabled = true, { fresh = false }: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.roles.permissions(),
    queryFn: () => rolesService.permissions(),
    enabled,
    staleTime: 10 * 60_000,
    ...(fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}
