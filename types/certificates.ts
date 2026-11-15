import type { Pagination } from './api';

/** Backend `CERTIFICATE_TEMPLATE_STATUSES`. */
export const TEMPLATE_STATUSES = ['draft', 'active', 'inactive'] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

/**
 * Template image reference. `storageKey` is an internal server path: it is never displayed or sent
 * by this console.
 */
export interface MediaRef {
  storageKey?: string | null;
  mediaAssetId?: string | null;
  url?: string | null;
  originalFileName?: string | null;
}

/** Toggles read by the PDF renderer (`certificatePdf.service`); a missing key counts as shown. */
export const FIELD_TOGGLES = [
  'showStudentName',
  'showCourseName',
  'showCertificateNumber',
  'showCompletionDate',
  'showIssueDate',
  'showVerificationUrl',
  'showQrCode',
  'showSignatory',
] as const;
export type FieldToggle = (typeof FIELD_TOGGLES)[number];

/** Free-form JSON objects on the backend (`z.record(z.unknown())`). */
export type ConfigRecord = Record<string, unknown>;

/** `CertificateTemplate.toSafeObject()`. */
export interface CertificateTemplate {
  id: string;
  name: string;
  description: string;
  templateCode: string;
  backgroundImage: MediaRef | null;
  organizationName: string;
  organizationLogo: MediaRef | null;
  signatureImage: MediaRef | null;
  authorizedSignatoryName: string;
  authorizedSignatoryDesignation: string;
  certificateTitle: string;
  certificateDescription: string;
  fieldConfiguration: ConfigRecord | null;
  layoutConfiguration: ConfigRecord | null;
  status: TemplateStatus;
  isDefault: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Query accepted by GET /admin/certificate-templates (`templateListQuery`). */
export interface TemplateListParams {
  page: number;
  limit: number;
  status?: TemplateStatus;
  search?: string;
}

export interface TemplateListResponse {
  templates: CertificateTemplate[];
  pagination: Pagination;
}

/** The three template image slots. */
export const TEMPLATE_IMAGE_FIELDS = ['backgroundImage', 'organizationLogo', 'signatureImage'] as const;
export type TemplateImageField = (typeof TEMPLATE_IMAGE_FIELDS)[number];

/**
 * Image reference sent to the API: an uploaded image asset, or all-null to clear the slot.
 * The backend resolves the stored URL from the asset.
 */
export interface MediaRefInput {
  mediaAssetId: string | null;
  url?: string | null;
  originalFileName?: string | null;
  storageKey?: null;
}

/** Body for POST /admin/certificate-templates (`createTemplateBody`, strict). */
export interface CreateTemplateInput {
  name: string;
  backgroundImage?: MediaRefInput;
  organizationLogo?: MediaRefInput;
  signatureImage?: MediaRefInput;
  description?: string;
  templateCode?: string;
  organizationName?: string;
  authorizedSignatoryName?: string;
  authorizedSignatoryDesignation?: string;
  certificateTitle?: string;
  certificateDescription?: string;
  fieldConfiguration?: ConfigRecord;
  layoutConfiguration?: ConfigRecord;
  status?: TemplateStatus;
  isDefault?: boolean;
}

/** Body for PATCH /admin/certificate-templates/:id (`updateTemplateBody`: partial, at least one field). */
export type UpdateTemplateInput = Partial<Omit<CreateTemplateInput, 'isDefault' | 'status'>>;

/** Backend `CERTIFICATE_STATUSES` and `CERTIFICATE_ISSUE_SOURCES`. */
export const CERTIFICATE_STATUSES = ['issued', 'revoked', 'expired'] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];
export type IssueSource = 'manual' | 'automatic' | 'regenerate';

/** Template fields frozen into the certificate when it was issued (`toSnapshot()`). */
export interface TemplateSnapshot {
  templateId?: string;
  name?: string;
  templateCode?: string;
  organizationName?: string;
  authorizedSignatoryName?: string;
  authorizedSignatoryDesignation?: string;
  certificateTitle?: string;
  certificateDescription?: string;
  fieldConfiguration?: ConfigRecord | null;
  layoutConfiguration?: ConfigRecord | null;
  backgroundImage?: MediaRef | null;
  organizationLogo?: MediaRef | null;
  signatureImage?: MediaRef | null;
  snapshottedAt?: string;
}

/** `Certificate.toSafeObject({ includeInternal: true })`. */
export interface Certificate {
  id: string;
  certificateNumber: string;
  studentId: string;
  courseId: string;
  enrollmentId: string;
  certificateTemplateId: string | null;
  studentName: string;
  courseName: string;
  organizationName: string;
  completionDate: string;
  issueDate: string;
  verificationUrl: string;
  certificateStatus: CertificateStatus;
  issueSource: IssueSource;
  revokedAt: string | null;
  revocationReason: string | null;
  replacesCertificateId: string | null;
  replacedByCertificateId: string | null;
  createdAt: string;
  updatedAt: string;
  pdfFileName?: string;
  pdfChecksum?: string;
  issuedBy?: string | null;
  revokedBy?: string | null;
  eligibilitySnapshot?: CertificateEligibility | null;
  templateSnapshot?: TemplateSnapshot | null;
}

/** Query accepted by GET /admin/certificates (`certificateListQuery`). No free-text search. */
export interface CertificateListParams {
  page: number;
  limit: number;
  studentId?: string;
  courseId?: string;
  status?: CertificateStatus;
}

export interface CertificateListResponse {
  certificates: Certificate[];
  pagination: Pagination;
}

/** Body for POST /admin/certificates/issue (`issueCertificateBody`, strict). */
export interface IssueCertificateInput {
  studentId: string;
  courseId: string;
  templateId?: string;
  reason?: string;
  replaceRevokedId?: string;
}

export type HistoryAction = 'issued' | 'revoked' | 'regenerated' | 'replaced';

/** GET /admin/certificates/:id/history → data. */
export interface CertificateHistory {
  certificateId: string;
  certificateNumber: string;
  history: Array<{ id?: string; action: HistoryAction; actorId: string | null; reason: string | null; meta: ConfigRecord | null; at: string }>;
}

/**
 * GET /admin/students/:studentId/certificate-eligibility/:courseId → data.eligibility
 * (`getEligibilityDetails`). Early refusals return only the common fields.
 */
export interface CertificateEligibility {
  eligible: boolean;
  reason: string;
  evaluatedAt?: string;
  courseId?: string;
  studentId?: string;
  enrollmentId?: string;
  enrollmentStatus?: string;
  courseCompletionStatus?: string;
  requiredLessonsCompleted: number;
  totalRequiredLessons: number;
  progressPercentage: number;
  minimumCompletionPercentage?: number;
  requiredQuizzesPassed: boolean;
  requiredAssignmentsCompleted: boolean;
  failedQuizzes?: string[];
  pendingAssignments?: string[];
  missingRequirements: string[];
  completionDate?: string | null;
  certificateEnabled?: boolean;
  autoIssue?: boolean;
  templateId?: string | null;
  existingCertificateId?: string;
  existingCertificateNumber?: string;
}
