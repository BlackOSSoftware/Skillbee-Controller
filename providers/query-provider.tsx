'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { normalizeApiError } from '@/lib/api-error';
import { restorePersistedQueries, subscribePersistedQueries } from '@/lib/query-persist';

function shouldRetry(failureCount: number, error: unknown): boolean {
  const { status } = normalizeApiError(error);
  // Never retry 4xx: auth/permission/validation failures and 429 rate limits
  if (status !== null && status >= 400 && status < 500) return false;
  return failureCount < 2;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Backend rate-limits per IP; keep data warm instead of refetching on every navigation
          staleTime: 5 * 60_000,
          gcTime: 10 * 60_000,
          refetchOnWindowFocus: false,
          retry: shouldRetry,
        },
        mutations: { retry: false },
      },
    });
    restorePersistedQueries(queryClient);
    return queryClient;
  });

  useEffect(() => subscribePersistedQueries(client), [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
