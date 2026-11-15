import { apiClient } from '@/lib/api-client';
import { fetchDownload, type DownloadedFile } from '@/lib/download';
import { env } from '@/lib/env';
import type { ApiEnvelope } from '@/types/api';
import type { LearningAttachment, LearningCurriculum, LearningLesson, MyCourse, PlaybackAuthorization } from '@/types/learning';

/** Enrolled-learner (and authorized staff) curriculum and lesson payloads. */
export const learningService = {
  async myCourses(): Promise<MyCourse[]> {
    const res = await apiClient.get<ApiEnvelope<{ courses: MyCourse[] }>>('/student/my-courses');
    return res.data.data.courses;
  },

  async curriculum(courseId: string): Promise<LearningCurriculum> {
    const res = await apiClient.get<ApiEnvelope<LearningCurriculum>>(`/learning/courses/${courseId}/curriculum`);
    return res.data.data;
  },

  async lesson(lessonId: string): Promise<LearningLesson> {
    const res = await apiClient.get<ApiEnvelope<LearningLesson>>(`/learning/lessons/${lessonId}`);
    return res.data.data;
  },

  async attachments(lessonId: string): Promise<LearningAttachment[]> {
    const res = await apiClient.get<ApiEnvelope<{ attachments: LearningAttachment[] }>>(`/learning/lessons/${lessonId}/attachments`);
    return res.data.data.attachments;
  },
};

/**
 * Protected playback. Both endpoints run the same backend authorization and return the same
 * payload; the player issues with GET /video/playback and renews an expired token with the POST.
 */
export const playbackService = {
  async authorize(lessonId: string): Promise<PlaybackAuthorization> {
    const res = await apiClient.get<ApiEnvelope<PlaybackAuthorization>>(`/learning/lessons/${lessonId}/video/playback`);
    return res.data.data;
  },

  async renewToken(lessonId: string): Promise<PlaybackAuthorization> {
    const res = await apiClient.post<ApiEnvelope<PlaybackAuthorization>>(`/learning/lessons/${lessonId}/playback-token`);
    return res.data.data;
  },

  /**
   * Range-capable stream URL for a native <video>. The playback token travels in `?token=` as the
   * backend requires; the request itself is authenticated by the httpOnly session cookie.
   */
  streamUrl(lessonId: string, playbackToken: string): string {
    return `${env.apiBaseUrl}/learning/lessons/${lessonId}/video/stream?token=${encodeURIComponent(playbackToken)}`;
  },
};

/** Authenticated downloads only — never public static URLs. */
export const protectedDownloadsService = {
  async lessonAttachment(lessonId: string, fileId: string, fallbackName: string): Promise<DownloadedFile> {
    const result = await fetchDownload(`/learning/lessons/${lessonId}/attachments/${fileId}/download`, fallbackName);
    if ('url' in result) throw new Error('Unexpected redirect for a lesson attachment');
    return result;
  },

  /** Course resources may be external links, returned as `{ url }` instead of a file stream. */
  async resource(resourceId: string, fallbackName: string): Promise<DownloadedFile | { url: string }> {
    return fetchDownload(`/learning/resources/${resourceId}/download`, fallbackName);
  },
};
