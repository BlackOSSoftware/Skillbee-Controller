import type { LessonStatus, LessonType, LiveSession, TextContent, VideoProcessingStatus, VideoProvider } from './curriculum';

/** `CourseLesson.toLearnerObject()`; content is only present when `locked` is false. */
export interface LearningLesson {
  id: string;
  title: string;
  slug: string;
  type: LessonType;
  durationSeconds: number;
  isPreview: boolean;
  isRequired: boolean;
  sortOrder: number;
  status: LessonStatus;
  scheduledAt: string | null;
  locked: boolean;
  description?: string;
  content?: {
    textContent?: TextContent;
    liveSession?: LiveSession | null;
    video?: {
      source?: 'uploaded' | 'external';
      provider?: VideoProvider;
      processingStatus?: VideoProcessingStatus;
      durationSeconds?: number;
      availableQualities: string[];
      externalUrl?: string;
    };
    resourceContent?: { resourceIds: string[]; instructions?: string } | null;
  };
}

export interface LearningTopic {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  locked: boolean;
  lessons: LearningLesson[];
}

/** GET /learning/courses/:courseId/curriculum → data. */
export interface LearningCurriculum {
  course: { id: string; title: string; slug: string; status: string };
  enrolled: boolean;
  isStaff: boolean;
  topics: LearningTopic[];
}

/**
 * GET /learning/lessons/:id/video/playback and POST /learning/lessons/:id/playback-token → data.
 * Both call `getPlaybackAuthorization` and return this same payload.
 */
export type PlaybackAuthorization =
  | { type: 'external'; externalUrl: string }
  | { type: 'uploaded'; playbackToken: string; expiresIn: string; qualities: string[]; processingStatus: VideoProcessingStatus };

/** GET /learning/lessons/:id/attachments → data.attachments (instructor-only files are excluded). */
export interface LearningAttachment {
  id: string;
  title: string;
  description: string;
  resourceType: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  visibility: 'enrolled' | 'preview' | 'instructor_only';
}

/** GET /student/my-courses → data.courses[]. */
export interface MyCourse {
  enrollmentId: string;
  enrollmentStatus: string;
  progressPercentage: number;
  completedLessonsCount: number;
  totalRequiredLessons: number;
  lastAccessedAt: string | null;
  nextIncompleteLesson: { lessonId: string; title: string } | null;
  course: { id: string; title: string; slug: string; status: string; thumbnail?: { secureUrl?: string } | null; level?: string };
}
