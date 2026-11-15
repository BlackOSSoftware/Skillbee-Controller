export interface RoleSummary {
  id: string;
  name?: string;
  slug?: string;
  permissions?: string[];
}

export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  profileImage?: string | null;
  roleId: string | null;
  role: RoleSummary | null;
  status: UserStatus;
  emailVerified?: boolean;
  lastLogin?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
