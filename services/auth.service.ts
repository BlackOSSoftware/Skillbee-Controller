import { apiClient, refreshSession } from '@/lib/api-client';
import { tokenStore } from '@/lib/token-store';
import type { ApiEnvelope } from '@/types/api';
import type { AuthSession, AuthUser, LoginInput, UpdateProfileInput } from '@/types/auth';

export const authService = {
  async login(input: LoginInput): Promise<AuthSession> {
    const res = await apiClient.post<ApiEnvelope<AuthSession>>('/auth/login', input);
    tokenStore.set(res.data.data.accessToken);
    if (res.data.data.refreshToken) tokenStore.setRefresh(res.data.data.refreshToken);
    return res.data.data;
  },

  /** Restores the session via the stored refresh token (its response includes the user), else confirms via /auth/me. */
  async restoreSession(): Promise<AuthUser> {
    if (!tokenStore.get()) {
      const session = await refreshSession();
      return session.user;
    }
    const res = await apiClient.get<ApiEnvelope<{ user: AuthUser }>>('/auth/me');
    return res.data.data.user;
  },

  /**
   * PUT /auth/me — always multipart so name fields and the optional photo share
   * one request. Clearing Content-Type lets the browser set the multipart
   * boundary (same pattern as assignment submissions in the student app).
   */
  async updateProfile(input: UpdateProfileInput): Promise<AuthUser> {
    const form = new FormData();
    if (input.firstName !== undefined) form.append('firstName', input.firstName);
    if (input.lastName !== undefined) form.append('lastName', input.lastName);
    if (input.photo) form.append('profileImage', input.photo);
    if (input.removePhoto) form.append('removeProfileImage', 'true');
    const res = await apiClient.put<ApiEnvelope<{ user: AuthUser }>>('/auth/me', form, {
      headers: { 'Content-Type': undefined },
    });
    return res.data.data.user;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout', { refreshToken: tokenStore.getRefresh() });
    } finally {
      tokenStore.clear();
    }
  },
};
