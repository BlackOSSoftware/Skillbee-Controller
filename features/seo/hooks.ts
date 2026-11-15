'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { seoService } from '@/services/seo.service';
import type {
  CourseSeoData,
  CreateRedirectInput,
  PageSeo,
  RedirectListParams,
  SeoRedirect,
  SeoSettings,
  UpdateCourseSeoInput,
  UpdatePageSeoInput,
  UpdateRedirectInput,
  UpdateSeoSettingsInput,
} from '@/types/seo';

// ---- Global settings ----

export function useSeoSettings() {
  return useQuery({
    queryKey: queryKeys.seo.settings(),
    queryFn: () => seoService.getSettings(),
    staleTime: 60 * 1000,
  });
}

export function useUpdateSeoSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSeoSettingsInput) => seoService.updateSettings(input),
    onSuccess: (data: SeoSettings) => {
      queryClient.setQueryData(queryKeys.seo.settings(), data);
    },
  });
}

// ---- Page SEO ----

export function usePageSeo(id: string | null) {
  return useQuery({
    queryKey: queryKeys.seo.pages.detail(id ?? ''),
    queryFn: () => seoService.getPageSeo(id as string),
    enabled: Boolean(id),
    staleTime: 0,
  });
}

export function useUpdatePageSeo(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePageSeoInput) => seoService.updatePageSeo(id, input),
    onSuccess: (data: PageSeo) => {
      queryClient.setQueryData(queryKeys.seo.pages.detail(id), data);
    },
  });
}

// ---- Course SEO ----

export function useCourseSeo(id: string | null) {
  return useQuery({
    queryKey: queryKeys.seo.courses.detail(id ?? ''),
    queryFn: () => seoService.getCourseSeo(id as string),
    enabled: Boolean(id),
    staleTime: 0,
  });
}

export function useUpdateCourseSeo(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCourseSeoInput) => seoService.updateCourseSeo(id, input),
    onSuccess: (data: CourseSeoData) => {
      queryClient.setQueryData(queryKeys.seo.courses.detail(id), data);
      // Slug changes affect course caches — invalidate course detail too.
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.lists() });
    },
  });
}

// ---- Redirects ----

export function useRedirectList(params: RedirectListParams) {
  return useQuery({
    queryKey: queryKeys.seo.redirects.list(params),
    queryFn: () => seoService.listRedirects(params),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateRedirects() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.seo.redirects.lists() });
}

function useForgetMissingRedirect() {
  const invalidate = useInvalidateRedirects();
  return (error: unknown) => {
    if (normalizeApiError(error).status !== 404) return;
    invalidate();
  };
}

export function useCreateRedirect() {
  const invalidate = useInvalidateRedirects();
  return useMutation({
    mutationFn: (input: CreateRedirectInput) => seoService.createRedirect(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateRedirect() {
  const invalidate = useInvalidateRedirects();
  const forgetMissing = useForgetMissingRedirect();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRedirectInput }) => seoService.updateRedirect(id, input),
    onError: (e) => forgetMissing(e),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteRedirect() {
  const invalidate = useInvalidateRedirects();
  const forgetMissing = useForgetMissingRedirect();
  return useMutation({
    mutationFn: (id: string) => seoService.deleteRedirect(id),
    onError: (e) => forgetMissing(e),
    onSuccess: () => invalidate(),
  });
}

export type { SeoRedirect };
