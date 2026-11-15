import type { Pagination } from './api';
import type { CourseStatus } from './courses';

/** Backend `models/CourseEnrollment.js` enums. `cancelled` is a legacy alias of revoked. */
export const ENROLLMENT_STATUSES = ['active', 'pending', 'completed', 'expired', 'revoked', 'suspended', 'cancelled'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const ENROLLMENT_TYPES = ['purchase', 'manual', 'free', 'admin_granted', 'migration'] as const;
export type EnrollmentType = (typeof ENROLLMENT_TYPES)[number];

export const COMPLETION_STATUSES = ['not_started', 'in_progress', 'requirements_pending', 'completed'] as const;
export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];

/** `CourseEnrollment.toSafeObject()` — returned by create and status updates (no populated refs). */
export interface EnrollmentRecord {
  id: string;
  courseId: string;
  studentId: string;
  status: EnrollmentStatus;
  enrollmentStatus: EnrollmentStatus;
  enrollmentType: EnrollmentType;
  progressPercentage: number;
  completedLessonsCount: number;
  totalRequiredLessons: number;
  courseCompletionStatus: CompletionStatus;
  enrolledAt: string;
  enrollmentExpiresAt: string | null;
  completedAt: string | null;
  lastAccessedAt: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /admin/enrollments rows (`serializeEnrollmentLean`) with student and course populated. */
export interface Enrollment extends EnrollmentRecord {
  student: { id: string; firstName: string; lastName: string; email: string } | null;
  course: { id: string; title: string; slug: string; status: CourseStatus } | null;
}

export const ENROLLMENT_SORT_FIELDS = ['enrolledAt', 'expiresAt', 'progressPercentage', 'createdAt', 'updatedAt'] as const;
export type EnrollmentSortField = (typeof ENROLLMENT_SORT_FIELDS)[number];

/** Query accepted by GET /admin/enrollments (`adminListQuery`). */
export interface EnrollmentListParams {
  page: number;
  limit: number;
  search?: string;
  status?: EnrollmentStatus;
  enrollmentType?: EnrollmentType;
  courseId?: string;
  courseCompletionStatus?: CompletionStatus;
  progressMin?: number;
  progressMax?: number;
  enrolledFrom?: string;
  enrolledTo?: string;
  sortBy?: EnrollmentSortField;
  sortOrder?: 'asc' | 'desc';
}

export interface EnrollmentListResponse {
  enrollments: Enrollment[];
  pagination: Pagination;
}

/** Body for POST /admin/enrollments (`createEnrollmentBody`). */
export interface CreateEnrollmentInput {
  studentId: string;
  courseId: string;
  enrollmentType?: EnrollmentType;
  status?: 'active' | 'pending';
  enrollmentExpiresAt?: string | null;
  reason?: string;
  allowUnpublished?: boolean;
}

export type LessonCompletionStatus = 'not_started' | 'in_progress' | 'completed';

/** GET /admin/enrollments/:id/progress → data.progress (`getEnrollmentProgressDetail`). */
export interface EnrollmentProgress {
  enrollmentId: string;
  courseId: string;
  studentId: string;
  enrollmentStatus: EnrollmentStatus;
  progressPercentage: number;
  completedLessonsCount: number;
  totalRequiredLessons: number;
  courseCompletionStatus: CompletionStatus;
  completionEvaluationAt: string | null;
  completedAt: string | null;
  lastAccessedAt: string | null;
  lessons: Array<{
    lessonId: string;
    title: string;
    type: 'video' | 'text' | 'live' | 'resource';
    isRequired: boolean;
    completionStatus: LessonCompletionStatus;
    completedAt: string | null;
  }>;
  nextIncompleteLesson: { lessonId: string; title: string } | null;
}

export type HistoryAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'revoked'
  | 'reactivated'
  | 'expired'
  | 'progress_recalculated'
  | 'completed'
  | 'suspended';

/** GET /admin/enrollments/:id/history → data (`getEnrollmentHistory`). */
export interface EnrollmentHistory {
  enrollmentId: string;
  history: Array<{
    id: string;
    action: HistoryAction;
    fromStatus: string | null;
    toStatus: string | null;
    reason: string | null;
    actorId: string | null;
    at: string;
  }>;
}
