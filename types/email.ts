import type { Pagination } from './api';

/** `ALLOWED_TEMPLATE_VARS` from backend emailTemplate.service.js — the only valid template variables. */
export const TEMPLATE_VARIABLES = [
  'studentName',
  'email',
  'courseName',
  'orderId',
  'amount',
  'currency',
  'certificateNumber',
  'resetLink',
  'message',
  'title',
  'score',
  'assignmentTitle',
  'quizTitle',
  'ticketNumber',
  'enquiryNumber',
  'previousStatus',
  'newStatus',
  'applicationNumber',
] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

/** `EmailTemplate.toSafeObject()`. */
export interface EmailTemplate {
  id: string;
  name: string;
  slug: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  isActive: boolean;
  isSystem: boolean;
  /** Built-in design revision — system templates are upgraded when the backend bumps this. */
  designVersion?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmailTemplateInput {
  name: string;
  slug?: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables?: TemplateVariable[];
  isActive?: boolean;
}

export type UpdateEmailTemplateInput = Partial<CreateEmailTemplateInput>;

// ---------- Email logs ----------

export const EMAIL_LOG_STATUSES = ['queued', 'processing', 'sent', 'failed', 'simulated'] as const;
export type EmailLogStatus = (typeof EMAIL_LOG_STATUSES)[number];

/** `EmailLog.toSafeObject()` — meta is intentionally not exposed. */
export interface EmailLog {
  id: string;
  recipient: string;
  templateId: string | null;
  templateSlug: string;
  subject: string;
  eventType: string;
  status: EmailLogStatus;
  providerMessageId: string | null;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  eventKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailLogListParams {
  page: number;
  limit: number;
  recipient?: string;
  status?: EmailLogStatus;
  eventType?: string;
  startDate?: string;
  endDate?: string;
}

export interface EmailLogListResponse {
  data: EmailLog[];
  pagination: Pagination;
}
