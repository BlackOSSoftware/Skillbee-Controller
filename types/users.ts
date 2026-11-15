import type { Pagination } from './api';
import type { AuthUser, UserStatus } from './auth';

export type AdminUser = AuthUser & {
  phoneVerified?: boolean;
  profile?: Record<string, unknown>;
};

export interface UsersListResponse {
  users: AdminUser[];
  pagination: Pagination;
}

/** Query params accepted by GET /admin/users (backend listUsersQuerySchema). No sort param exists. */
export interface UsersListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
  role?: string;
  roleId?: string;
}

/** Body for POST /admin/users (backend createUserSchema). */
export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  password: string;
  roleId: string;
  status?: UserStatus;
}

/** Body for PATCH /admin/users/:id (backend updateUserSchema). Status is changed via /status. */
export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  password?: string;
  roleId?: string;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Body for POST /admin/roles (backend createRoleSchema). System flag is always false server-side. */
export interface CreateRoleInput {
  name: string;
  slug?: string;
  description?: string;
  permissions?: string[];
  isActive?: boolean;
}

/** Body for PATCH /admin/roles/:id (backend updateRoleSchema). Slug and permissions are not editable here. */
export interface UpdateRoleInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  description?: string;
}
