import type { Pagination } from './api';

/** `QUESTION_STATUS` in backend/src/config/security.js. */
export const QUESTION_STATUSES = ['open', 'resolved'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

/** `answered` query filter of GET /admin/questions-answers (`adminQuestionListQuery`). */
export const ANSWERED_FILTERS = ['all', 'unanswered', 'answered'] as const;
export type AnsweredFilter = (typeof ANSWERED_FILTERS)[number];

export const QUESTION_SORTS = ['newest', 'last_activity'] as const;
export type QuestionSort = (typeof QUESTION_SORTS)[number];

/** `QUESTION_SENDER_ROLES` in backend/src/config/security.js. */
export const REPLY_SENDER_ROLES = ['student', 'admin', 'instructor'] as const;
export type ReplySenderRole = (typeof REPLY_SENDER_ROLES)[number];

export interface QaStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface QaCourse {
  id: string;
  title: string;
  slug: string;
}

export interface QaAttachment {
  id?: string;
  mediaAssetId: string | null;
  fileName: string;
  mimeType: string;
  publicUrl: string;
}

/** `QuestionReply.toSafeObject()`. */
export interface QuestionReply {
  id: string;
  questionId: string;
  senderId: string;
  senderRole: ReplySenderRole;
  message: string;
  attachments: QaAttachment[];
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `CourseQuestion.auditLog` entry (admin views only). */
export interface QuestionAuditEvent {
  action: string;
  actorId: string | null;
  at: string;
  meta: Record<string, unknown>;
}

/** Row of GET /admin/questions-answers (`toSafeObject({ includeAdmin: true })` + populated student/course). */
export interface CourseQuestion {
  id: string;
  courseId: string;
  studentId: string;
  lessonId: string | null;
  title: string;
  description: string;
  status: QuestionStatus;
  replyCount: number;
  lastActivityAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  auditLog?: QuestionAuditEvent[];
  deletedAt?: string | null;
  student?: QaStudent | null;
  course?: QaCourse | null;
}

/** GET /admin/questions-answers/:id — question plus chronological replies. */
export interface QuestionDetail extends CourseQuestion {
  replies: QuestionReply[];
}

/** Query for GET /admin/questions-answers (`adminQuestionListQuery`). */
export interface QuestionListParams {
  page?: number;
  limit?: number;
  search?: string;
  courseId?: string;
  status?: QuestionStatus;
  /** 'all' is the backend default and is omitted from requests. */
  answered?: Exclude<AnsweredFilter, 'all'>;
  sort?: QuestionSort;
}

export interface QuestionListResponse {
  questions: CourseQuestion[];
  pagination: Pagination;
}

/** POST /admin/questions-answers/:id/replies (`createReplyBody`). */
export interface CreateReplyInput {
  message: string;
  idempotencyKey: string;
}
