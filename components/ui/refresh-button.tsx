'use client';

import { partialMatchKey, useIsFetching, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { normalizeApiError } from '@/lib/api-error';
import { Button } from './button';

function matchesAny(queryKey: QueryKey, keys: readonly QueryKey[]): boolean {
  return keys.some((key) => partialMatchKey(queryKey, key));
}

/** Epoch ms until which a 429 under these keys asks clients to wait (0 when none). */
function useRateLimitedUntil(keys: readonly QueryKey[]): number {
  const cache = useQueryClient().getQueryCache();
  return useSyncExternalStore(
    (onChange) => cache.subscribe(onChange),
    () => {
      let until = 0;
      for (const query of cache.getAll()) {
        if (query.state.status !== 'error' || !matchesAny(query.queryKey, keys)) continue;
        const { status, retryAfterSeconds } = normalizeApiError(query.state.error);
        if (status === 429 && retryAfterSeconds) {
          until = Math.max(until, query.state.errorUpdatedAt + retryAfterSeconds * 1000);
        }
      }
      return until;
    },
    () => 0
  );
}

/** Seconds left until `until`; null while the first tick for a new deadline is pending. */
function useSecondsLeft(until: number): number | null {
  const [tick, setTick] = useState({ until: 0, left: 0 });
  useEffect(() => {
    if (!until) return;
    const update = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setTick({ until, left });
      if (left === 0) clearInterval(id);
    };
    const first = setTimeout(update, 0);
    const id = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [until]);
  if (!until) return 0;
  return tick.until === until ? tick.left : null;
}

interface RefreshButtonProps {
  /** Query key prefixes to refetch; also used to track loading and rate-limit cooldown. */
  queryKeys: readonly QueryKey[];
}

export function RefreshButton({ queryKeys: keys }: RefreshButtonProps) {
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ predicate: (query) => matchesAny(query.queryKey, keys) }) > 0;
  const secondsLeft = useSecondsLeft(useRateLimitedUntil(keys));
  const coolingDown = secondsLeft !== 0;

  function refresh() {
    // Rapid clicks can land before the disabled state renders, so check the cache synchronously
    if (coolingDown || keys.some((queryKey) => queryClient.isFetching({ queryKey }) > 0)) return;
    for (const queryKey of keys) {
      void queryClient.invalidateQueries({ queryKey }, { cancelRefetch: false });
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={fetching}
      disabled={coolingDown}
      title={coolingDown ? 'The API rate limit was reached. Wait before refreshing.' : undefined}
      onClick={refresh}
    >
      {!fetching ? <RefreshCw className="size-3.5" aria-hidden /> : null}
      {coolingDown && secondsLeft ? `Refresh in ${secondsLeft}s` : 'Refresh'}
    </Button>
  );
}
