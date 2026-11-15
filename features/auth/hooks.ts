'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeApiError } from '@/lib/api-error';
import { clearPersistedQueries } from '@/lib/query-persist';
import { queryKeys } from '@/lib/query-keys';
import { tokenStore } from '@/lib/token-store';
import { authService } from '@/services/auth.service';
import type { AuthUser, LoginInput, UpdateProfileInput } from '@/types/auth';
import { endSession } from './session';

/** Resolves to the current user, or null when there is no valid session. */
export function useSessionQuery() {
  return useQuery<AuthUser | null>({
    queryKey: queryKeys.auth.session(),
    queryFn: async () => {
      try {
        return await authService.restoreSession();
      } catch (error) {
        const { status } = normalizeApiError(error);
        if (status === 401 || status === 403) {
          tokenStore.clear();
          return null;
        }
        throw error;
      }
    },
    // Role permissions can change while signed in; re-check on focus (after 5 min) and periodically.
    // Any 403 also forces an immediate re-check (see AuthProvider).
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60_000,
    retry: false,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    onSuccess: (session) => {
      // Counts from a previous account must not be shown to this one
      clearPersistedQueries();
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.auth.all[0] });
      queryClient.setQueryData(queryKeys.auth.session(), session.user);
    },
  });
}

/** PUT /auth/me — refreshes the session cache so the whole console sees the update. */
export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => authService.updateProfile(input),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.auth.session(), user);
    },
  });
}

/** The admin guard redirects to /login once the session becomes null. */
export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => endSession(queryClient),
  });
}
