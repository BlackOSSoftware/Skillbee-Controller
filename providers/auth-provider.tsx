'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useEffect, useMemo, type ReactNode } from 'react';
import { useSessionQuery } from '@/features/auth/hooks';
import { endSession } from '@/features/auth/session';
import { queryKeys } from '@/lib/query-keys';
import { tokenStore } from '@/lib/token-store';
import type { AuthUser } from '@/types/auth';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  error: unknown;
  retry: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useSessionQuery();

  // A failed refresh anywhere in the app ends the session for every screen.
  useEffect(() => tokenStore.onUnauthorized(() => endSession(queryClient)), [queryClient]);

  // On 403, reload /auth/me so menus and buttons match the role's current permissions.
  useEffect(() => {
    let last = 0;
    return tokenStore.onForbidden(() => {
      const now = Date.now();
      if (now - last < 3000) return;
      last = now;
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.session() });
    });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthStatus;
    if (session.isPending) status = 'loading';
    // Keep the console usable if a background session refresh fails transiently
    else if (session.data) status = 'authenticated';
    else if (session.isError) status = 'error';
    else status = 'unauthenticated';
    return {
      user: session.data ?? null,
      status,
      error: session.error,
      retry: () => {
        session.refetch();
      },
    };
  }, [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
