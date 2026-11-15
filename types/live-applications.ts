import type { Paginated } from './instructors';

export const LIVE_APPLICATION_STATUSES = [
  'PENDING',
  'UNDER_REVIEW',
  'CONTACTED',
  'APPROVED',
  'REJECTED',
  'CONVERTED',
] as const;
export type LiveApplicationStatus = (typeof LIVE_APPLICATION_STATUSES)[number];

export interface LiveApplicationCourseRef {
  id: string;
  title: string;
  slug: string;
  courseType?: string;
}

export interface LiveApplicationStudentRef {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface LiveApplicationReviewerRef {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

/** Shape returned by GET /admin/live-course-applications (list, populated refs). */
export interface LiveCourseApplication {
  id: string;
  applicationReference: string;
  student?: LiveApplicationStudentRef | string | null;
  name: string;
  email: string;
  whatsappNumber: string;
  currentCompany: string;
  currentCity: string;
  courseInterested: string;
  liveCourse: LiveApplicationCourseRef | string;
  referralSource: string;
  comment?: string;
  status: LiveApplicationStatus;
  adminRemarks?: string;
  reviewedBy?: LiveApplicationReviewerRef | string | null;
  reviewedAt?: string | null;
  convertedEnrollment?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type LiveApplicationsResponse = Paginated<LiveCourseApplication>;

/** Query params for GET /admin/live-course-applications (adminListQuery). */
export interface LiveApplicationListParams {
  page?: number;
  limit?: number;
  status?: LiveApplicationStatus;
  liveCourse?: string;
  courseInterested?: string;
  search?: string;
}

export interface UpdateLiveApplicationStatusInput {
  status: LiveApplicationStatus;
}

export interface UpdateLiveApplicationRemarksInput {
  adminRemarks: string;
}

export interface ConvertLiveApplicationResult {
  application: LiveCourseApplication;
  alreadyConverted: boolean;
}
