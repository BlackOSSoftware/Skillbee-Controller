import type { Pagination } from './api';

/** Backend `config/security.js` LESSON_TYPES and VIDEO_PROCESSING_STATUS. */
export const LESSON_TYPES = ['video', 'text', 'live', 'resource'] as const;
export type LessonType = (typeof LESSON_TYPES)[number];

export const LESSON_STATUSES = ['draft', 'published', 'archived'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export type VideoProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type VideoProvider = 'local' | 'youtube' | 'vimeo' | 'other';

export interface TextContent {
  body: string;
  format: 'html' | 'markdown';
}

export interface LiveSession {
  meetingProvider?: string;
  meetingUrl?: string;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
  instructions?: string;
}

/**
 * `toAdminObject().content.video`. The response also carries `storageKey`; it is deliberately
 * left out of this type so the console never renders or forwards storage paths.
 */
export interface LessonVideo {
  source: 'uploaded' | 'external';
  provider: VideoProvider;
  externalUrl: string | null;
  storageProvider?: string;
  originalFileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  processingStatus: VideoProcessingStatus;
  availableQualities: string[];
  hasHls: boolean;
  hasThumbnail: boolean;
  uploadedAt: string | null;
}

/** GET /admin/lessons/:id → data.lesson (`CourseLesson.toAdminObject()`). */
export interface AdminLesson {
  id: string;
  courseId: string;
  topicId: string;
  title: string;
  slug: string;
  description: string;
  type: LessonType;
  content: {
    textContent: TextContent | null;
    video: LessonVideo | null;
    liveSession: LiveSession | null;
    resourceContent: { resourceIds: string[]; instructions: string } | null;
  };
  durationSeconds: number;
  isPreview: boolean;
  isRequired: boolean;
  sortOrder: number;
  scheduledAt: string | null;
  status: LessonStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Body for POST /admin/topics/:topicId/lessons (`createLessonSchema`, strict). Lessons start as draft. */
export interface CreateLessonInput {
  title: string;
  type: LessonType;
  description?: string;
  slug?: string;
}

/** Body for PATCH /admin/lessons/:id (`updateLessonSchema`: partial, at least one field). */
export interface UpdateLessonInput {
  title?: string;
  slug?: string;
  description?: string;
  type?: LessonType;
  textContent?: TextContent;
  liveSession?: LiveSession;
  resourceContent?: { resourceIds?: string[]; instructions?: string };
  video?: { source?: 'uploaded' | 'external'; provider?: VideoProvider; externalUrl?: string };
  durationSeconds?: number;
  isPreview?: boolean;
  isRequired?: boolean;
  scheduledAt?: string | null;
}

/** Body for POST /admin/lessons/:id/move (`moveLessonSchema`). Same-course topics only. */
export interface MoveLessonInput {
  targetTopicId: string;
  targetPosition?: number;
}

/** GET /admin/lessons/:id/video/status → data (`getUploadStatus`). */
export interface VideoStatus {
  lessonId: string;
  processingStatus: VideoProcessingStatus | null;
  source: 'uploaded' | 'external' | null;
  availableQualities: string[];
  hasHls: boolean;
  uploadedAt: string | null;
}

export const ATTACHMENT_VISIBILITIES = ['enrolled', 'preview', 'instructor_only'] as const;
export type AttachmentVisibility = (typeof ATTACHMENT_VISIBILITIES)[number];

export const RESOURCE_TYPES = ['pdf', 'document', 'spreadsheet', 'presentation', 'archive', 'text'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** `CourseResource.toSafeObject()` (lesson attachments). */
export interface LessonAttachment {
  id: string;
  courseId: string;
  topicId: string | null;
  lessonId: string | null;
  title: string;
  description: string;
  resourceType: ResourceType;
  storageProvider: string;
  originalFileName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  checksum: string;
  visibility: AttachmentVisibility;
  hasFile: boolean;
  sortOrder: number;
  status: 'active' | 'archived';
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** `attachmentMetaSchema`, sent as the multipart `meta` JSON field next to `file`. */
export interface AttachmentMetaInput {
  title?: string;
  description?: string;
  resourceType?: ResourceType;
  visibility?: AttachmentVisibility;
  sortOrder?: number;
}

/** Body for PATCH /admin/lessons/:id/attachments/:fileId (`updateAttachmentSchema`). */
export interface UpdateAttachmentInput {
  title?: string;
  description?: string;
  visibility?: AttachmentVisibility;
  sortOrder?: number;
  status?: 'active' | 'archived';
}

export type TopicStatus = 'draft' | 'published' | 'archived';

/** Body for POST /admin/courses/:courseId/topics and PATCH /admin/topics/:id (`createTopicSchema`). */
export interface TopicInput {
  title?: string;
  description?: string;
  availabilityType?: 'immediate' | 'scheduled';
  availableAt?: string | null;
  status?: TopicStatus;
  isRequired?: boolean;
}

export interface LessonListResponse {
  lessons: AdminLesson[];
  pagination: Pagination;
}
