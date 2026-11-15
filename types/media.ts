import type { Pagination } from './api';

/** Categories accepted by POST /admin/media/images for course imagery (backend MEDIA_CATEGORIES). */
export type CourseImageCategory = 'course_thumbnail' | 'course_gallery';

/** Image categories this console uploads to; certificate template images use `other`. */
export type ImageUploadCategory = CourseImageCategory | 'other';

export type MediaType = 'image' | 'video' | 'document';
export type MediaCategory =
  | 'course_thumbnail'
  | 'course_gallery'
  | 'instructor_image'
  | 'lesson_video'
  | 'study_material'
  | 'assignment_submission'
  | 'other';
export type MediaStorageProvider = 'cloudinary' | 'local';
export type MediaProcessingStatus = 'pending' | 'uploading' | 'processing' | 'ready' | 'failed';
export type MediaVisibility = 'public' | 'protected' | 'private';

/** `MediaAsset.toSafeObject()`; `publicId` / `secureUrl` are only present for Cloudinary assets. */
export interface MediaAsset {
  id: string;
  title: string;
  description: string;
  altText: string;
  originalFileName: string;
  storedFileName: string | null;
  mediaType: MediaType;
  category: MediaCategory | string;
  storageProvider: MediaStorageProvider;
  publicId?: string;
  secureUrl?: string;
  hasLocalFile?: boolean;
  mimeType: string;
  extension: string | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  checksum: string | null;
  processingStatus: MediaProcessingStatus | string;
  visibility: MediaVisibility;
  downloadAllowed: boolean;
  ownerId: string | null;
  courseId: string | null;
  lessonId: string | null;
  resourceId: string | null;
  uploadedBy: string | null;
  lastAccessedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on GET /admin/media/:id only. */
  referenceCount?: number;
  /**
   * Present when the item comes from CourseLesson.content.video (merged into
   * GET /admin/media). `id` is then `lesson:<lessonId>` — not a MediaAsset id,
   * so detail/update/delete/reference endpoints do not apply.
   */
  source?: 'media_asset' | 'lesson_video';
  courseName?: string | null;
  courseSlug?: string | null;
  topicId?: string | null;
  topicName?: string | null;
  lessonTitle?: string;
  lessonStatus?: string;
  isPreview?: boolean;
  hasHls?: boolean;
  playback?: { lessonId: string };
}

export interface MediaImageListParams {
  page: number;
  limit: number;
  search?: string;
  category?: CourseImageCategory;
}

export interface MediaListResponse {
  media: MediaAsset[];
  pagination: Pagination;
}

/** Backend IMAGE_MIME / IMAGE_EXT (SVG is rejected). */
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

// ---------------- Media Library (admin) ----------------

export interface MediaListParams {
  page: number;
  limit: number;
  search?: string;
  mediaType?: MediaType;
  category?: MediaCategory;
  storageProvider?: MediaStorageProvider;
  processingStatus?: MediaProcessingStatus;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'sizeBytes' | 'title' | 'originalFileName';
  sortOrder?: 'asc' | 'desc';
  includeDeleted?: boolean;
}

export interface MediaListResult {
  media: MediaAsset[];
  pagination: Pagination;
}

// ---------------- Course videos (lesson videos stored on CourseLesson) ----------------

export interface CourseVideoListParams {
  page: number;
  limit: number;
  search?: string;
  courseId?: string;
  status?: 'draft' | 'published' | 'archived';
  processingStatus?: MediaProcessingStatus;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'sizeBytes' | 'title';
  sortOrder?: 'asc' | 'desc';
}

/** GET /admin/media/course-videos item — lesson video aggregated from CourseLesson.content.video. */
export interface CourseVideo {
  id: string;
  source: 'lesson_video';
  mediaType: 'video';
  title: string;
  originalFileName: string;
  mimeType: string;
  extension: string | null;
  sizeBytes: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  storageProvider: MediaStorageProvider;
  processingStatus: MediaProcessingStatus | string;
  category: string;
  visibility: MediaVisibility;
  secureUrl: null;
  thumbnailUrl: null;
  altText: null;
  description: null;
  deletedAt: null;
  createdAt: string;
  updatedAt: string;
  courseId: string | null;
  courseName: string | null;
  courseSlug: string | null;
  topicId: string | null;
  topicName: string | null;
  lessonId: string;
  lessonTitle: string;
  lessonStatus: string;
  isPreview: boolean;
  hasHls: boolean;
  playback: { lessonId: string };
}

export interface CourseVideoListResult {
  videos: CourseVideo[];
  pagination: Pagination;
}

/** GET /learning/lessons/:lessonId/video/playback response. */
export type LessonPlaybackAuth =
  | { type: 'uploaded'; playbackToken: string; expiresIn: string; qualities: string[]; processingStatus: string }
  | { type: 'external'; externalUrl: string };

/** GET /learning/media/:id/playback response (MediaAsset videos). */
export type MediaPlaybackAuth =
  | { type: 'video'; viewToken: string; streamUrl: string; expiresIn: string; downloadAllowed: boolean; contentDisposition: string }
  | { type: 'image'; secureUrl: string | null };

/** One entry from GET /admin/media/:id/references. */
export interface MediaReference {
  id: string;
  title?: string;
  slug?: string;
  courseId?: string;
  lessonId?: string;
  type: string;
}

export interface MediaReferences {
  mediaId: string;
  references: {
    courses: MediaReference[];
    lessons: MediaReference[];
    resources: MediaReference[];
    instructors?: MediaReference[];
    certificateTemplates?: MediaReference[];
    certificates?: MediaReference[];
    total: number;
  };
}

/** GET /admin/media/storage */
export interface MediaStorageStats {
  server: {
    totalBytes: number | null;
    usedBytes: number | null;
    availableBytes: number | null;
    usagePercent: number | null;
    unavailableReason?: string;
  };
  localMedia: {
    videos: { count: number; totalBytes: number };
    documents: { count: number; totalBytes: number };
    root: string;
  };
  cloudinary: {
    images: { count: number; totalBytes: number; source: string };
  };
  totals: {
    mediaCount: number;
    localBytes: number;
    cloudinaryBytes: number;
  };
  cached: boolean;
  generatedAt: string;
}

/** GET /admin/media/categories — one catalog entry per supported category. */
export interface MediaCategoryInfo {
  category: MediaCategory | string;
  mediaType: MediaType | 'image|video|document';
  storageProvider: MediaStorageProvider | 'depends_on_type';
  acceptedMimeTypes?: string[];
  acceptedExtensions?: string[];
  maxSizeMb?: number;
  downloadAllowed?: boolean;
  accessMode?: string;
  resumableUpload?: boolean;
  notes?: string;
}

export interface InitiateUploadInput {
  mediaType: MediaType;
  category: MediaCategory;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  courseId?: string;
  lessonId?: string;
}

export interface InitiateUploadResult {
  uploadId: string;
  provider: 'cloudinary' | 'local';
  uploadUrl?: string;
  uploadParameters?: Record<string, string | number>;
  uploadToken?: string;
  expiresAt: string;
  accessMode?: string;
  downloadAllowed?: boolean;
  resumableUpload?: boolean;
}

export interface ConfirmUploadInput {
  uploadId: string;
  provider?: 'cloudinary' | 'local';
  cloudinary?: {
    publicId: string;
    secureUrl: string;
    bytes?: number;
    width?: number;
    height?: number;
    format?: string;
  };
}

export interface UpdateMediaInput {
  title?: string;
  description?: string;
  altText?: string;
  category?: MediaCategory;
  visibility?: MediaVisibility;
}
