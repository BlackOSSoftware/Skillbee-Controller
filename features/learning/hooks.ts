'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { saveBlob } from '@/lib/download';
import { queryKeys } from '@/lib/query-keys';
import { learningService, playbackService, protectedDownloadsService } from '@/services/learning.service';

export function useMyCourses(enabled: boolean) {
  return useQuery({ queryKey: queryKeys.learning.myCourses(), queryFn: () => learningService.myCourses(), enabled });
}

export function useLearningCurriculum(courseId: string) {
  return useQuery({ queryKey: queryKeys.learning.curriculum(courseId), queryFn: () => learningService.curriculum(courseId), staleTime: 60_000 });
}

export function useLearningLesson(lessonId: string | null) {
  return useQuery({
    queryKey: queryKeys.learning.lesson(lessonId ?? ''),
    queryFn: () => learningService.lesson(lessonId as string),
    enabled: Boolean(lessonId),
    staleTime: 60_000,
  });
}

export function useLearningAttachments(lessonId: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.learning.attachments(lessonId), queryFn: () => learningService.attachments(lessonId), enabled, staleTime: 60_000 });
}

/**
 * Playback authorizations are mutations, not cached queries: the short-lived token lives only in
 * the player's component state (never in the query cache, persistence or localStorage).
 */
export function usePlaybackAuthorization() {
  return useMutation({ mutationFn: (lessonId: string) => playbackService.authorize(lessonId) });
}

export function useRenewPlaybackToken() {
  return useMutation({ mutationFn: (lessonId: string) => playbackService.renewToken(lessonId) });
}

export function useDownloadLessonAttachment() {
  return useMutation({
    mutationFn: async ({ lessonId, fileId, filename }: { lessonId: string; fileId: string; filename: string }) => {
      saveBlob(await protectedDownloadsService.lessonAttachment(lessonId, fileId, filename));
    },
  });
}

export function useDownloadResource() {
  return useMutation({
    mutationFn: async ({ resourceId, filename }: { resourceId: string; filename: string }) => {
      const result = await protectedDownloadsService.resource(resourceId, filename);
      if ('url' in result) window.open(result.url, '_blank', 'noopener,noreferrer');
      else saveBlob(result);
    },
  });
}
