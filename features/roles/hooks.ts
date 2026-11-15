'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERSIST_META } from '@/lib/query-persist';
import { queryKeys } from '@/lib/query-keys';
import { dashboardService } from '@/services/dashboard.service';
import { rolesService } from '@/services/users.service';
import type { CreateRoleInput, Role, UpdateRoleInput } from '@/types/users';

export { usePermissionsCatalog, useRolesList } from '@/features/users/hooks';

/** Writes the returned role into the cached list so the UI updates before the refetch lands. */
function useSyncRoles() {
  const queryClient = useQueryClient();
  return (role?: Role, removedId?: string) => {
    queryClient.setQueryData<Role[]>(queryKeys.roles.list(), (list) => {
      if (!list) return list;
      if (removedId) return list.filter((r) => r.id !== removedId);
      if (!role) return list;
      return list.some((r) => r.id === role.id) ? list.map((r) => (r.id === role.id ? role : r)) : [...list, role];
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.roles.list() });
    // User rows embed role name/permissions
    queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
  };
}

export function useCreateRole() {
  const sync = useSyncRoles();
  return useMutation({
    mutationFn: (input: CreateRoleInput) => rolesService.create(input),
    onSuccess: (role) => sync(role),
  });
}

export function useUpdateRole() {
  const sync = useSyncRoles();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRoleInput }) => rolesService.update(id, input),
    onSuccess: (role) => sync(role),
  });
}

export function useDeleteRole() {
  const sync = useSyncRoles();
  return useMutation({
    mutationFn: (id: string) => rolesService.remove(id),
    onSuccess: (_data, id) => sync(undefined, id),
  });
}

export function useAssignPermissions() {
  const sync = useSyncRoles();
  return useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: string[] }) =>
      rolesService.assignPermissions(id, permissions),
    onSuccess: (role) => sync(role),
  });
}

/** Users assigned to a role (needs users:read). Backend blocks deleting roles that are in use. */
export function useRoleUserCount(roleId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.roles.userCount(roleId),
    queryFn: () => dashboardService.count('/admin/users', { roleId }),
    enabled,
    meta: PERSIST_META,
  });
}
