import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope } from '@/types/api';
import type { UserStatus } from '@/types/auth';
import type {
  AdminUser,
  CreateRoleInput,
  CreateUserInput,
  UpdateRoleInput,
  Permission,
  Role,
  UpdateUserInput,
  UsersListParams,
  UsersListResponse,
} from '@/types/users';

function compactParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
  ) as Partial<T>;
}

type UserEnvelope = ApiEnvelope<{ user: AdminUser }>;

export const usersService = {
  async list(params: UsersListParams): Promise<UsersListResponse> {
    const res = await apiClient.get<ApiEnvelope<UsersListResponse>>('/admin/users', {
      params: compactParams(params),
    });
    return res.data.data;
  },

  async get(id: string): Promise<AdminUser> {
    const res = await apiClient.get<UserEnvelope>(`/admin/users/${id}`);
    return res.data.data.user;
  },

  async create(input: CreateUserInput): Promise<AdminUser> {
    const res = await apiClient.post<UserEnvelope>('/admin/users', input);
    return res.data.data.user;
  },

  async update(id: string, input: UpdateUserInput): Promise<AdminUser> {
    const res = await apiClient.patch<UserEnvelope>(`/admin/users/${id}`, input);
    return res.data.data.user;
  },

  async updateStatus(id: string, status: UserStatus): Promise<AdminUser> {
    const res = await apiClient.patch<UserEnvelope>(`/admin/users/${id}/status`, { status });
    return res.data.data.user;
  },

  async softDelete(id: string): Promise<AdminUser> {
    const res = await apiClient.delete<UserEnvelope>(`/admin/users/${id}`);
    return res.data.data.user;
  },
};

type RoleEnvelope = ApiEnvelope<{ role: Role }>;

export const rolesService = {
  async list(): Promise<Role[]> {
    const res = await apiClient.get<ApiEnvelope<{ roles: Role[] }>>('/admin/roles');
    return res.data.data.roles;
  },

  async create(input: CreateRoleInput): Promise<Role> {
    const res = await apiClient.post<RoleEnvelope>('/admin/roles', input);
    return res.data.data.role;
  },

  async update(id: string, input: UpdateRoleInput): Promise<Role> {
    const res = await apiClient.patch<RoleEnvelope>(`/admin/roles/${id}`, input);
    return res.data.data.role;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/admin/roles/${id}`);
  },

  async assignPermissions(id: string, permissions: string[]): Promise<Role> {
    const res = await apiClient.patch<RoleEnvelope>(`/admin/roles/${id}/permissions`, { permissions });
    return res.data.data.role;
  },

  async permissions(): Promise<Permission[]> {
    const res = await apiClient.get<ApiEnvelope<{ permissions: Permission[] }>>('/admin/permissions');
    return res.data.data.permissions;
  },
};
