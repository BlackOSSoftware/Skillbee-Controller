import type { Pagination } from './api';

/** Backend `config/security.js` ASSIGNMENT_STATUS, ASSIGNMENT_SUBMISSION_TYPES and SUBMISSION_STATUS. */
export const ASSIGNMENT_STATUSES = ['draft', 'published', 'closed', 'archived'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export type SubmissionType = 'file_upload' | 'text' | 'file_and_text';

export const SUBMISSION_STATUSES = ['submitted', 'under_review', 'evaluated', 'returned', 'resubmitted'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** `Assignment.toSafeObject()`. */
export interface Assignment {
  id: string;
  title: string;
  slug: string;
  instructions: string;
  courseId: string;
  topicId: string | null;
  lessonId: string | null;
  dueDate: string | null;
  maximumMarks: number;
  allowedFileTypes: string[];
  maximumFileSizeBytes: number;
  submissionType: SubmissionType;
  allowLateSubmission: boolean;
  allowResubmission: boolean;
  maxSubmissions: number;
  status: AssignmentStatus;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const ASSIGNMENT_SORT_FIELDS = ['createdAt', 'dueDate', 'title', 'status', 'maximumMarks'] as const;
export type AssignmentSortField = (typeof ASSIGNMENT_SORT_FIELDS)[number];

/** Query accepted by GET /admin/assignments (`listAssignmentsQuerySchema`, strict). */
export interface AssignmentListParams {
  page: number;
  limit: number;
  search?: string;
  courseId?: string;
  status?: AssignmentStatus;
  dueBefore?: string;
  dueAfter?: string;
  sortBy?: AssignmentSortField;
  sortOrder?: 'asc' | 'desc';
}

export interface AssignmentListResponse {
  assignments: Assignment[];
  pagination: Pagination;
}

export interface SubmissionAttachment {
  id: string;
  originalFileName: string;
  mimeType: string;
  extension: string | null;
  sizeBytes: number;
  downloadAvailable: boolean;
}

export interface EvaluationHistoryEntry {
  _id?: string;
  marksAwarded: number | null;
  feedback: string;
  status: SubmissionStatus;
  evaluatedBy: string | null;
  evaluatedAt: string;
  note: string;
}

/** Earlier submission versions (`versionHistory`) kept when a learner resubmits. */
export interface SubmissionVersion {
  id?: string;
  version: number;
  textContent: string;
  attachments: SubmissionAttachment[];
  submittedAt: string;
  isLate: boolean;
  submissionStatus: SubmissionStatus;
  marksAwarded: number | null;
  feedback: string;
  evaluatedBy: string | null;
  evaluatedAt: string | null;
}

/**
 * `AssignmentSubmission.toSafeObject({ includeFeedback: true })`. Detail, history, grade and
 * return responses also include `evaluationHistory` and `versionHistory`.
 */
export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  courseId: string;
  lessonId: string | null;
  version: number;
  textContent: string;
  attachments: SubmissionAttachment[];
  submittedAt: string;
  submissionStatus: SubmissionStatus;
  isLate: boolean;
  marksAwarded: number | null;
  feedback: string;
  evaluatedBy: string | null;
  evaluatedAt: string | null;
  evaluationHistory?: EvaluationHistoryEntry[];
  versionHistory?: SubmissionVersion[];
  createdAt: string;
  updatedAt: string;
}

/** Query accepted by GET /admin/assignments/:id/submissions (`listSubmissionsQuerySchema`, strict). */
export interface SubmissionListParams {
  page: number;
  limit: number;
  search?: string;
  status?: SubmissionStatus;
  isLate?: boolean;
  sortOrder?: 'asc' | 'desc';
}

export interface SubmissionListResponse {
  submissions: Submission[];
  pagination: Pagination;
}

export const SUBMISSION_TYPES = ['file_upload', 'text', 'file_and_text'] as const satisfies readonly SubmissionType[];

/** Body for POST /admin/assignments (`createAssignmentSchema`, strict). New assignments start as draft. */
export interface CreateAssignmentInput {
  title: string;
  instructions: string;
  courseId: string;
  dueDate?: string | null;
  maximumMarks: number;
  allowedFileTypes?: string[];
  maximumFileSizeBytes?: number;
  submissionType: SubmissionType;
  allowLateSubmission?: boolean;
  allowResubmission?: boolean;
  maxSubmissions?: number;
}

/** Body for PATCH /admin/assignments/:id (`updateAssignmentSchema`: partial, course is fixed). */
export type UpdateAssignmentInput = Partial<Omit<CreateAssignmentInput, 'courseId'>>;

/** Body for PATCH /admin/submissions/:id/grade (`gradeSubmissionSchema`, strict). */
export interface GradeSubmissionInput {
  marksAwarded: number;
  feedback?: string;
  status?: 'evaluated' | 'returned';
}
