import { apiClient } from '@/lib/api-client';
import type { Pagination } from '@/types/api';

interface CountableBody {
  pagination?: Pagination;
  data?: { pagination?: Pagination } | unknown;
}

/** List endpoints place pagination either at the top level or inside `data`. */
function extractTotal(body: CountableBody): number {
  const top = body.pagination?.total;
  if (typeof top === 'number') return top;
  const nested = (body.data as { pagination?: Pagination } | undefined)?.pagination?.total;
  if (typeof nested === 'number') return nested;
  throw new Error('Endpoint response did not include pagination.total');
}

export const dashboardService = {
  /** Counts records using an existing list endpoint with limit=1 (no aggregate dashboard API exists). */
  async count(path: string, params: Record<string, string | number> = {}): Promise<number> {
    const res = await apiClient.get<CountableBody>(path, { params: { ...params, page: 1, limit: 1 } });
    return extractTotal(res.data);
  },
};
