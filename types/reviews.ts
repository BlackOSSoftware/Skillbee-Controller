import type { Pagination } from './api';

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** PATCH /admin/reviews/:id/status accepts only these (`reviewStatusSchema`). */
export type ModerationStatus = Exclude<ReviewStatus, 'pending'>;

export const REVIEW_SORTS = ['newest', 'oldest', 'highest', 'lowest'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export interface ReviewStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ReviewCourse {
  id: string;
  title: string;
  slug: string;
}

/** Row of GET /admin/reviews. */
export interface AdminReview {
  id: string;
  userId: string;
  courseId: string;
  enrollmentId: string | null;
  rating: number;
  title: string;
  comment: string;
  status: ReviewStatus;
  rejectionReason: string | null;
  moderatedBy: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  student: ReviewStudent | null;
  course: ReviewCourse | null;
}

export interface ModerationEvent {
  _id: string;
  action: 'submitted' | 'edited' | 'approved' | 'rejected' | 'deleted' | 'status_changed';
  fromStatus: ReviewStatus | null;
  toStatus: ReviewStatus | null;
  actorId: string | null;
  reason: string | null;
  at: string;
}

/**
 * GET /admin/reviews/:id. The backend populates `userId`, `courseId` and `moderatedBy` before
 * serialising them, so those three arrive as text dumps rather than ids; use `student.id`,
 * `course.id` and the moderation history's `actorId` instead.
 */
export interface AdminReviewDetail extends Omit<AdminReview, 'userId' | 'courseId' | 'moderatedBy'> {
  moderationHistory: ModerationEvent[];
  deletedAt: string | null;
}

/** PATCH /admin/reviews/:id/status → data.review (`toSafeObject({ includeAdmin: true })`, not populated). */
export interface ModeratedReview {
  id: string;
  status: ReviewStatus;
  rejectionReason: string | null;
  moderatedAt: string | null;
  moderationHistory: ModerationEvent[];
  updatedAt: string;
}

/** Query for GET /admin/reviews (`adminReviewListQuery`). */
export interface ReviewListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ReviewStatus;
  courseId?: string;
  rating?: number;
  sort?: ReviewSort;
}

export interface ReviewListResponse {
  reviews: AdminReview[];
  pagination: Pagination;
}

export interface ModerateReviewInput {
  status: ModerationStatus;
  rejectionReason?: string;
}
