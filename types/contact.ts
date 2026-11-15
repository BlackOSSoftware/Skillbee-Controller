import type { Pagination } from './api';

/** `SUPPORT_STATUS` in backend/src/config/security.js — shared by enquiries and tickets. */
export const SUPPORT_STATUSES = ['open', 'reviewed', 'resolved', 'closed'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const ENQUIRY_CATEGORIES = ['general', 'courses', 'pricing', 'technical', 'partnership', 'other'] as const;
export type EnquiryCategory = (typeof ENQUIRY_CATEGORIES)[number];

export const TICKET_CATEGORIES = [
  'account_login',
  'course_learning',
  'payment_fees',
  'certificate',
  'technical_issue',
  'other',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const MESSAGE_VISIBILITIES = ['public', 'internal'] as const;
export type MessageVisibility = (typeof MESSAGE_VISIBILITIES)[number];

export const TICKET_SENDER_ROLES = ['student', 'admin', 'instructor'] as const;
export type TicketSenderRole = (typeof TICKET_SENDER_ROLES)[number];

export interface StatusHistoryEntry {
  from: SupportStatus | null;
  to: SupportStatus;
  actorId: string | null;
  at: string;
}

export interface EnquiryReply {
  id: string;
  senderId: string;
  senderRole: 'admin' | 'instructor';
  message: string;
  notifiedAt: string | null;
  createdAt: string;
}

export interface EnquiryNote {
  id: string;
  authorId: string;
  authorRole: 'admin' | 'instructor';
  message: string;
  createdAt: string;
}

/** `ContactEnquiry.toSafeObject()`. */
export interface ContactEnquiry {
  id: string;
  referenceNumber: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  category: EnquiryCategory;
  status: SupportStatus;
  replies: EnquiryReply[];
  statusHistory: StatusHistoryEntry[];
  reviewedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  /** Admin-only fields. */
  internalNotes?: EnquiryNote[];
  deletedAt?: string | null;
}

export interface EnquiryListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: SupportStatus;
  category?: EnquiryCategory;
  startDate?: string;
  endDate?: string;
  sort?: 'newest' | 'last_activity';
}

export interface EnquiryListResponse {
  data: ContactEnquiry[];
  pagination: Pagination;
}

export interface SubmitEnquiryInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  category?: EnquiryCategory;
}

export interface TicketAttachment {
  id?: string;
  mediaAssetId: string | null;
  fileName: string;
  mimeType: string;
  publicUrl: string;
}

export interface TicketMessage {
  id: string;
  senderId: string;
  senderRole: TicketSenderRole;
  /** `internal` messages are staff-only and never returned to students. */
  visibility: MessageVisibility;
  message: string;
  attachments: TicketAttachment[];
  notifiedAt: string | null;
  createdAt: string;
}

export interface TicketStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** `SupportTicket.toSafeObject()`. */
export interface SupportTicket {
  id: string;
  ticketNumber: string;
  studentId: string;
  category: TicketCategory;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: SupportStatus;
  assignedTo: string | null;
  messages: TicketMessage[];
  statusHistory: StatusHistoryEntry[];
  resolvedAt: string | null;
  closedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  /** Admin-only populated fields. */
  student?: TicketStudent | null;
  assignee?: TicketStudent | null;
  deletedAt?: string | null;
}

export interface TicketListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: SupportStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  studentId?: string;
  assignedTo?: string;
  unassigned?: boolean;
  startDate?: string;
  endDate?: string;
  sort?: 'newest' | 'last_activity';
}

export interface TicketListResponse {
  data: SupportTicket[];
  pagination: Pagination;
}

export interface TicketReplyInput {
  message: string;
  attachments?: TicketAttachment[];
  idempotencyKey?: string;
}

export interface TicketHistoryResponse {
  ticketNumber?: string;
  referenceNumber?: string;
  status: SupportStatus;
  history: StatusHistoryEntry[];
}
