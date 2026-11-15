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

/** PUT /auth/me — only these fields are writable; email/phone are read-only. */
export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  /** New profile photo — uploaded to Cloudinary by the backend. */
  photo?: File | null;
  /** Remove the current profile photo. */
  removePhoto?: boolean;
}
