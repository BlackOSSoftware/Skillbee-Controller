import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';

/**
 * Persists only queries marked `meta: { persist: true }` (aggregate counts, never personal data)
 * to sessionStorage, so a full page reload does not re-request every statistic. The backend
 * rate-limits per IP, and each dashboard reload otherwise costs ~14 requests.
 */
const STORAGE_KEY = 'skillbee-admin-query-cache';
const MAX_AGE_MS = 10 * 60_000;

export const PERSIST_META = { persist: true } as const;

export function restorePersistedQueries(client: QueryClient) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    const now = Date.now();
    state.queries = (state.queries ?? []).filter(
      (q: { state?: { dataUpdatedAt?: number } }) => now - (q.state?.dataUpdatedAt ?? 0) < MAX_AGE_MS
    );
    state.mutations = [];
    hydrate(client, state);
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function subscribePersistedQueries(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const write = () => {
    timer = null;
    try {
      const state = dehydrate(client, {
        shouldDehydrateQuery: (q) => q.meta?.persist === true && q.state.status === 'success',
        shouldDehydrateMutation: () => false,
      });
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or unavailable; persistence is best-effort
    }
  };
  return client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.query.meta?.persist !== true) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, 300);
  });
}

export function clearPersistedQueries() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
