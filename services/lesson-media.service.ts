import type { AxiosProgressEvent } from 'axios';
import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope } from '@/types/api';
import type { AdminLesson, AttachmentMetaInput, LessonAttachment, UpdateAttachmentInput, VideoStatus } from '@/types/curriculum';

export interface UploadOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** The shared client defaults to JSON; multipart needs the header so the browser adds the boundary. */
function multipartConfig({ onProgress, signal }: UploadOptions) {
  return {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    signal,
    onUploadProgress: (e: AxiosProgressEvent) => {
      if (onProgress && e.total) onProgress(Math.min(1, e.loaded / e.total));
    },
  };
}

/** Lesson video on VPS storage. */
export const lessonVideoService = {
  /** Multipart field `video` (mp4, webm, mov, avi). */
  async upload(lessonId: string, file: File, options: UploadOptions = {}): Promise<AdminLesson> {
    const form = new FormData();
    form.append('video', file);
    const res = await apiClient.post<ApiEnvelope<{ lesson: AdminLesson }>>(`/admin/lessons/${lessonId}/video/upload`, form, multipartConfig(options));
    return res.data.data.lesson;
  },

  async status(lessonId: string): Promise<VideoStatus> {
    const res = await apiClient.get<ApiEnvelope<VideoStatus>>(`/admin/lessons/${lessonId}/video/status`);
    return res.data.data;
  },

  /** Removes the video reference; the file is only deleted when no other lesson references it. */
  async remove(lessonId: string): Promise<AdminLesson> {
    const res = await apiClient.delete<ApiEnvelope<{ lesson: AdminLesson }>>(`/admin/lessons/${lessonId}/video`);
    return res.data.data.lesson;
  },
};

/** Lesson attachments (study materials) on VPS storage. */
export const lessonAttachmentsService = {
  async list(lessonId: string): Promise<LessonAttachment[]> {
    const res = await apiClient.get<ApiEnvelope<{ attachments: LessonAttachment[] }>>(`/admin/lessons/${lessonId}/attachments`);
    return res.data.data.attachments;
  },

  /** Multipart: `file` plus `meta` as a JSON string (the route parses `meta` before validating). */
  async upload(lessonId: string, file: File, meta: AttachmentMetaInput, options: UploadOptions = {}): Promise<LessonAttachment> {
    const form = new FormData();
    form.append('file', file);
    form.append('meta', JSON.stringify(meta));
    const res = await apiClient.post<ApiEnvelope<LessonAttachment>>(`/admin/lessons/${lessonId}/attachments`, form, multipartConfig(options));
    return res.data.data;
  },

  async get(lessonId: string, fileId: string): Promise<LessonAttachment> {
    const res = await apiClient.get<ApiEnvelope<LessonAttachment>>(`/admin/lessons/${lessonId}/attachments/${fileId}`);
    return res.data.data;
  },

  async update(lessonId: string, fileId: string, input: UpdateAttachmentInput): Promise<LessonAttachment> {
    const res = await apiClient.patch<ApiEnvelope<LessonAttachment>>(`/admin/lessons/${lessonId}/attachments/${fileId}`, input);
    return res.data.data;
  },

  /** Archives the record; the stored file is removed only when nothing else references it. */
  async archive(lessonId: string, fileId: string): Promise<LessonAttachment> {
    const res = await apiClient.delete<ApiEnvelope<LessonAttachment>>(`/admin/lessons/${lessonId}/attachments/${fileId}`);
    return res.data.data;
  },
};
