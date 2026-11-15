'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { mediaService } from '@/services/media.service';
import type {
  CourseImageCategory,
  CourseVideoListParams,
  MediaAsset,
  MediaListParams,
  UpdateMediaInput,
} from '@/types/media';

/** Permission checks mirroring the backend route guards (adminMedia.routes.js). */
export const mediaPolicy = {
  canBrowse(user: { role?: { permissions?: string[] } | null } | null): boolean {
    const perms = user?.role?.permissions ?? [];
    return perms.includes('media.read') || perms.includes('courses.media.upload');
  },
  canUpload(user: { role?: { permissions?: string[] } | null } | null): boolean {
    const perms = user?.role?.permissions ?? [];
    return perms.includes('media.upload') || perms.includes('courses.media.upload');
  },
  canUpdate(user: { role?: { permissions?: string[] } | null } | null): boolean {
    const perms = user?.role?.permissions ?? [];
    return perms.includes('media.update') || perms.includes('courses.media.upload');
  },
  canDelete(user: { role?: { permissions?: string[] } | null } | null): boolean {
    const perms = user?.role?.permissions ?? [];
    return perms.includes('media.delete') || perms.includes('courses.media.delete');
  },
  canRestore(user: { role?: { permissions?: string[] } | null } | null): boolean {
    const perms = user?.role?.permissions ?? [];
    return perms.includes('media.restore') || perms.includes('media.delete');
  },
  canReadStorage(user: { role?: { permissions?: string[] } | null } | null): boolean {
    const perms = user?.role?.permissions ?? [];
    return perms.includes('media.storage.read') || perms.includes('media.read');
  },
  canReadReferences(user: { role?: { permissions?: string[] } | null } | null): boolean {
    const perms = user?.role?.permissions ?? [];
    return perms.includes('media.references.read') || perms.includes('media.read');
  },
};

export function useMediaImages(params: { page: number; limit: number; search?: string; category?: CourseImageCategory }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.media.images(params),
    queryFn: () => mediaService.listImages(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useUploadImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      category,
      courseId,
      onProgress,
    }: {
      file: File;
      category: CourseImageCategory;
      courseId?: string;
      onProgress?: (percent: number) => void;
    }) => mediaService.uploadImage(file, { category, courseId }, onProgress),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.media.all });
    },
  });
}

// ---------------- Media Library ----------------

export function useCourseVideos(params: CourseVideoListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.media.courseVideos(params),
    queryFn: () => mediaService.listCourseVideos(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMediaList(params: MediaListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.media.list(params),
    queryFn: () => mediaService.list(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMediaDetail(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.media.detail(id ?? ''),
    queryFn: () => mediaService.get(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 0,
  });
}

export function useMediaReferences(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.media.references(id ?? ''),
    queryFn: () => mediaService.references(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
  });
}

/** Usage badges for a page of assets — one references call per asset, batched by React Query. */
export function useMediaUsageMap(assets: MediaAsset[], enabled: boolean) {
  const results = useQueries({
    queries: assets.map((a) => ({
      queryKey: queryKeys.media.references(a.id),
      queryFn: () => mediaService.references(a.id),
      // Lesson videos are not MediaAssets — no /admin/media/:id/references endpoint applies.
      enabled: enabled && a.source !== 'lesson_video',
      staleTime: 60_000,
      retry: 1,
    })),
  });
  const map = new Map<string, { total: number | null; error: boolean }>();
  assets.forEach((a, i) => {
    const r = results[i];
    if (!enabled || !r) {
      map.set(a.id, { total: null, error: false });
    } else if (r.isPending) {
      map.set(a.id, { total: null, error: false });
    } else if (r.isError) {
      map.set(a.id, { total: null, error: true });
    } else {
      map.set(a.id, { total: r.data.references.total, error: false });
    }
  });
  return map;
}

export function useMediaStorage(enabled = true) {
  return useQuery({
    queryKey: queryKeys.media.storage(),
    queryFn: () => mediaService.storage(),
    staleTime: 60_000,
    enabled,
  });
}

export function useMediaCategories(enabled = true) {
  return useQuery({
    queryKey: queryKeys.media.categories(),
    queryFn: () => mediaService.categories(),
    staleTime: 5 * 60_000,
    enabled,
  });
}

function useInvalidateMedia() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.media.lists() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.media.details() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.media.storage() });
    void queryClient.invalidateQueries({ queryKey: [...queryKeys.media.all, 'references'] });
  };
}

export function useUpdateMedia() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMediaInput }) => mediaService.update(id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.media.detail(updated.id), updated);
      invalidate();
    },
  });
}

export function useDeleteMedia() {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: (id: string) => mediaService.remove(id),
    onSuccess: () => invalidate(),
  });
}

export function useRestoreMedia() {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: (id: string) => mediaService.restore(id),
    onSuccess: () => invalidate(),
  });
}
