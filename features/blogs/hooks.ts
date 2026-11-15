'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { dashboardService } from '@/services/dashboard.service';
import { blogsService } from '@/services/blogs.service';
import type {
  Blog,
  BlogCategory,
  BlogListParams,
  BlogStatus,
  CreateBlogCategoryInput,
  CreateBlogInput,
  UpdateBlogInput,
  UpdateBlogSeoInput,
} from '@/types/blogs';

export const BLOG_STATUSES = ['all', 'draft', 'published', 'archived'] as const;
export type BlogStatKey = (typeof BLOG_STATUSES)[number];

const STAT_PARAMS: Record<BlogStatKey, Record<string, string>> = {
  all: {},
  draft: { status: 'draft' },
  published: { status: 'published' },
  archived: { status: 'archived' },
};

/** Totals from list pagination (no aggregate endpoint exists). */
export function useBlogStats() {
  const results = useQueries({
    queries: BLOG_STATUSES.map((key) => ({
      queryKey: [...queryKeys.blogs.all, 'stat', key],
      queryFn: () => dashboardService.count('/admin/blogs', STAT_PARAMS[key]),
    })),
  });
  return BLOG_STATUSES.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<BlogStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

export function useBlogList(params: BlogListParams) {
  return useQuery({
    queryKey: queryKeys.blogs.list(params),
    queryFn: () => blogsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useBlogDetail(id: string, seed?: Blog) {
  return useQuery({
    queryKey: queryKeys.blogs.detail(id),
    queryFn: () => blogsService.get(id),
    placeholderData: seed,
    staleTime: 0,
  });
}

/** Published categories via the existing public endpoint (no admin list exists). */
export function useBlogCategories() {
  return useQuery({
    queryKey: queryKeys.blogs.categories(),
    queryFn: () => blogsService.listCategories(),
    staleTime: 5 * 60 * 1000,
  });
}

function useInvalidateBlogs() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.blogs.lists() });
    queryClient.invalidateQueries({ queryKey: [...queryKeys.blogs.all, 'detail'] });
    queryClient.invalidateQueries({ queryKey: [...queryKeys.blogs.all, 'seo'] });
    for (const key of BLOG_STATUSES) queryClient.invalidateQueries({ queryKey: [...queryKeys.blogs.all, 'stat', key] });
    queryClient.invalidateQueries({ queryKey: queryKeys.blogs.categories() });
  };
}

function useForgetMissingBlog() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateBlogs();
  return (error: unknown, id: string) => {
    if (normalizeApiError(error).status !== 404) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.blogs.detail(id) });
    invalidate();
  };
}

export function useCreateBlog() {
  const invalidate = useInvalidateBlogs();
  return useMutation({
    mutationFn: (input: CreateBlogInput) => blogsService.create(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateBlog() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateBlogs();
  const forgetMissing = useForgetMissingBlog();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBlogInput }) => blogsService.update(id, input),
    onError: (e, { id }) => forgetMissing(e, id),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.blogs.detail(updated.id), updated);
      invalidate();
    },
  });
}

export function useSetBlogStatus() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateBlogs();
  const forgetMissing = useForgetMissingBlog();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BlogStatus }) => blogsService.setStatus(id, status),
    onError: (e, { id }) => forgetMissing(e, id),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.blogs.detail(updated.id), updated);
      invalidate();
    },
  });
}

export function useDeleteBlog() {
  const invalidate = useInvalidateBlogs();
  const forgetMissing = useForgetMissingBlog();
  return useMutation({
    mutationFn: (id: string) => blogsService.remove(id),
    onError: (e, id) => forgetMissing(e, id),
    onSuccess: () => invalidate(),
  });
}

export function useCreateBlogCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBlogCategoryInput) => blogsService.createCategory(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.blogs.categories() }),
  });
}

export function useBlogSeo(id: string) {
  return useQuery({
    queryKey: queryKeys.blogs.seo(id),
    queryFn: () => blogsService.getSeo(id),
    staleTime: 0,
  });
}

export function useUpdateBlogSeo(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBlogSeoInput) => blogsService.updateSeo(id, input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.blogs.seo(id), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.blogs.detail(id) });
    },
  });
}

export function useBlogPreview() {
  return useMutation({
    mutationFn: (id: string) => blogsService.createPreview(id),
  });
}

export type { BlogCategory };
