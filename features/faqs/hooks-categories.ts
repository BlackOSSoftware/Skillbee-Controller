'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { faqsService } from '@/services/faqs.service';

/**
 * Category options for the admin FAQ filter.
 * Categories are free-text on the backend (no dedicated list endpoint),
 * so we read them from a wide unfiltered page of FAQs.
 */
export function useFaqCategories() {
  return useQuery({
    queryKey: queryKeys.faqs.categories(),
    queryFn: async () => {
      const res = await faqsService.list({ page: 1, limit: 100 });
      const cats = new Set<string>();
      for (const f of res.data) {
        const c = (f.category || 'general').trim();
        if (c) cats.add(c);
      }
      return [...cats].sort((a, b) => a.localeCompare(b));
    },
    staleTime: 60 * 1000,
  });
}
