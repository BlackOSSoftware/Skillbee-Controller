import type { QueryClient } from '@tanstack/react-query';
import { clearPersistedQueries } from '@/lib/query-persist';
import { queryKeys } from '@/lib/query-keys';
import { tokenStore } from '@/lib/token-store';

/**
 * Ends the client session without detaching observers (unlike `queryClient.clear()`):
 * setting the session to null first lets the guard unmount admin screens before their
 * cached data is dropped, so nothing refetches with a revoked token.
 */
export function endSession(queryClient: QueryClient) {
  tokenStore.clear();
  clearPersistedQueries();
  queryClient.setQueryData(queryKeys.auth.session(), null);
  queryClient.cancelQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.auth.all[0] });
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.auth.all[0] });
}
