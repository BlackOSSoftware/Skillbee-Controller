import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope } from '@/types/api';
import type {
  ConfirmUploadInput,
  CourseVideoListParams,
  CourseVideoListResult,
  InitiateUploadInput,
  InitiateUploadResult,
  LessonPlaybackAuth,
  MediaAsset,
  MediaPlaybackAuth,
  MediaCategory,
  MediaCategoryInfo,
  MediaImageListParams,
  MediaListParams,
  MediaListResult,
  MediaReferences,
  MediaStorageStats,
  UpdateMediaInput,
} from '@/types/media';

interface MediaListEnvelope {
  success: true;
  data: { media: MediaAsset[] };
  pagination?: MediaListResult['pagination'];
}

interface MediaDetailEnvelope {
  success: true;
  data: { media: MediaAsset };
}

interface CourseVideoListEnvelope {
  success: true;
  data: { videos: CourseVideoListResult['videos'] };
  pagination?: CourseVideoListResult['pagination'];
}

export const mediaService = {
  /** GET /admin/media/course-videos — lesson videos stored on CourseLesson (not MediaAsset). */
  async listCourseVideos(params: CourseVideoListParams) {
    const res = await apiClient.get<CourseVideoListEnvelope>('/admin/media/course-videos', { params: compactParams(params) });
    return { videos: res.data.data.videos, pagination: res.data.pagination };
  },

  /** GET /learning/lessons/:lessonId/video/playback — playback token (admin/staff allowed). */
  async getLessonPlayback(lessonId: string) {
    const res = await apiClient.get<ApiEnvelope<LessonPlaybackAuth>>(`/learning/lessons/${lessonId}/video/playback`);
    return res.data.data;
  },

  /** GET /learning/media/:id/playback — view token for MediaAsset videos (admin allowed). */
  async getMediaPlayback(mediaId: string) {
    const res = await apiClient.get<ApiEnvelope<MediaPlaybackAuth>>(`/learning/media/${mediaId}/playback`);
    return res.data.data;
  },

  /** GET /admin/media/images — Cloudinary images for course thumbnails/gallery. */
  async listImages(params: MediaImageListParams) {
    const res = await apiClient.get<MediaListEnvelope>('/admin/media/images', { params: compactParams(params) });
    return { media: res.data.data.media, pagination: res.data.pagination };
  },

  /** POST /admin/media/images — multipart direct upload to Cloudinary. */
  async uploadImage(
    file: File,
    meta: { category: MediaCategory; courseId?: string },
    onProgress?: (percent: number) => void,
    signal?: AbortSignal
  ) {
    const form = new FormData();
    form.append('file', file);
    form.append(
      'meta',
      JSON.stringify({
        originalFileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        category: meta.category,
        ...(meta.courseId ? { courseId: meta.courseId } : {}),
      })
    );
    const res = await apiClient.post<MediaDetailEnvelope>('/admin/media/images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
      signal,
    });
    return res.data.data.media;
  },

  // ---------------- Media Library ----------------

  /** GET /admin/media — full library list with filters/sort/pagination. */
  async list(params: MediaListParams): Promise<MediaListResult> {
    const res = await apiClient.get<MediaListEnvelope>('/admin/media', { params: compactParams(params) });
    return { media: res.data.data.media, pagination: res.data.pagination ?? { page: params.page, limit: params.limit, total: res.data.data.media.length, totalPages: 1 } };
  },

  /** GET /admin/media/:id — includes referenceCount. */
  async get(id: string): Promise<MediaAsset> {
    const res = await apiClient.get<MediaDetailEnvelope>(`/admin/media/${id}`);
    return res.data.data.media;
  },

  /** PATCH /admin/media/:id — metadata only (title, description, altText, category, visibility). */
  async update(id: string, input: UpdateMediaInput): Promise<MediaAsset> {
    const res = await apiClient.patch<MediaDetailEnvelope>(`/admin/media/${id}`, input);
    return res.data.data.media;
  },

  /** DELETE /admin/media/:id — soft delete; 409 MEDIA_IN_USE when referenced. */
  async remove(id: string): Promise<MediaAsset> {
    const res = await apiClient.delete<MediaDetailEnvelope>(`/admin/media/${id}`);
    return res.data.data.media;
  },

  /** POST /admin/media/:id/restore — restore a soft-deleted asset. */
  async restore(id: string): Promise<MediaAsset> {
    const res = await apiClient.post<MediaDetailEnvelope>(`/admin/media/${id}/restore`);
    return res.data.data.media;
  },

  /** GET /admin/media/:id/references — where the asset is used. */
  async references(id: string): Promise<MediaReferences> {
    const res = await apiClient.get<ApiEnvelope<MediaReferences>>(`/admin/media/${id}/references`);
    return res.data.data;
  },

  /** GET /admin/media/storage — storage statistics. */
  async storage(): Promise<MediaStorageStats> {
    const res = await apiClient.get<ApiEnvelope<MediaStorageStats>>('/admin/media/storage');
    return res.data.data;
  },

  /** GET /admin/media/categories — supported categories and limits. */
  async categories(): Promise<MediaCategoryInfo[]> {
    const res = await apiClient.get<ApiEnvelope<{ categories: MediaCategoryInfo[] }>>('/admin/media/categories');
    return res.data.data.categories;
  },

  /** POST /admin/media/upload-url — initiate a video/document (local VPS) upload session. */
  async initiateUpload(input: InitiateUploadInput): Promise<InitiateUploadResult> {
    const res = await apiClient.post<ApiEnvelope<InitiateUploadResult>>('/admin/media/upload-url', input);
    return res.data.data;
  },

  /**
   * PUT /admin/media/uploads/:uploadId/content — raw file bytes with X-Upload-Token.
   * The backend streams the body to temporary storage; no multipart wrapper needed.
   */
  async uploadContent(
    uploadId: string,
    uploadToken: string,
    file: File,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal
  ) {
    const res = await apiClient.put<ApiEnvelope<unknown>>(`/admin/media/uploads/${uploadId}/content`, file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Upload-Token': uploadToken,
      },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
      signal,
    });
    return res.data;
  },

  /** POST /admin/media/confirm — finalize an initiated upload into a MediaAsset. */
  async confirmUpload(input: ConfirmUploadInput): Promise<MediaAsset> {
    const res = await apiClient.post<MediaDetailEnvelope>('/admin/media/confirm', input);
    return res.data.data.media;
  },
};
