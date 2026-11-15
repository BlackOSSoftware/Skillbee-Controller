import type { Paginated } from './instructors';

export type InstructorAppStatus = 'pending' | 'reviewing' | 'shortlisted' | 'approved' | 'rejected';

export type ExpertiseLevel = 'Expert' | 'Proficient' | 'Competent' | 'Beginner';

export interface InstructorApplicationResume {
  originalFileName: string;
  mimeType: string;
  fileSize: number;
}

export interface ApplicationAuditEntry {
  action: string;
  actorId?: string | null;
  at: string;
  meta?: { from?: string; to?: string } & Record<string, unknown>;
}

/** Shape returned by toAdminObject() on the backend. */
export interface InstructorApplication {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  expertSubject: string;
  expertiseLevel: ExpertiseLevel;
  resume: InstructorApplicationResume;
  linkedinProfileUrl: string;
  comments: string;
  status: InstructorAppStatus;
  adminNotes: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  auditLog: ApplicationAuditEntry[];
}

export type InstructorApplicationsResponse = Paginated<InstructorApplication>;

/** Query params accepted by GET /admin/instructor-applications (adminListQuery). */
export interface InstructorApplicationListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: InstructorAppStatus;
  expertSubject?: string;
  expertiseLevel?: ExpertiseLevel;
  sort?: 'newest' | 'oldest';
}

/** Body for PATCH /admin/instructor-applications/:id/status (statusBody). */
export interface UpdateApplicationStatusInput {
  status: InstructorAppStatus;
  adminNotes?: string;
}

