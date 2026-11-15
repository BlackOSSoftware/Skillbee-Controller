'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { blogCategoriesService, categoriesService } from '@/services/categories.service';
import type { BlogCategoryInput, CategoryInput, CategoryOrderItem, CourseCategory, UpdateCategoryInput } from '@/types/categories';

/** Full category list in backend order; shared by the Categories page and the course form picker. */
export function useCourseCategories(enabled = true) {
  return useQuery({
    queryKey: queryKeys.categories.courseList(),
    queryFn: () => categoriesService.listAll(),
    enabled,
  });
}

function useCategoryCacheUpdate() {
  const queryClient = useQueryClient();
  return (category: CourseCategory) => {
    queryClient.setQueryData<CourseCategory[]>(queryKeys.categories.courseList(), (old) => {
      if (!old) return old;
      const exists = old.some((c) => c.id === category.id);
      const next = exists ? old.map((c) => (c.id === category.id ? category : c)) : [...old, category];
      return next.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    });
    // Course rows embed category name/status
    queryClient.invalidateQueries({ queryKey: queryKeys.courses.lists() });
  };
}

export function useCreateCategory() {
  const apply = useCategoryCacheUpdate();
  return useMutation({
    mutationFn: (input: CategoryInput) => categoriesService.create(input),
    onSuccess: apply,
  });
}

export function useUpdateCategory() {
  const apply = useCategoryCacheUpdate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) => categoriesService.update(id, input),
    onSuccess: apply,
  });
}

/** Optimistic: the list is reordered immediately and rolled back if the request fails. */
export function useReorderCategories() {
  const queryClient = useQueryClient();
  const key = queryKeys.categories.courseList();
  return useMutation({
    mutationFn: (items: CategoryOrderItem[]) => categoriesService.reorder(items),
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CourseCategory[]>(key);
      const order = new Map(items.map((i) => [i.id, i.sortOrder]));
      queryClient.setQueryData<CourseCategory[]>(key, (old) =>
        old
          ?.map((c) => (order.has(c.id) ? { ...c, sortOrder: order.get(c.id) as number } : c))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      );
      return { previous };
    },
    onError: (_error, _items, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function usePublishedBlogCategories(enabled = true) {
  return useQuery({
    queryKey: queryKeys.categories.blogList(),
    queryFn: () => blogCategoriesService.listPublished(),
    enabled,
  });
}

export function useCreateBlogCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BlogCategoryInput) => blogCategoriesService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories.blogList() }),
  });
}
