import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { EnquiryCategory, SupportStatus, TicketCategory, TicketPriority, TicketSenderRole } from '@/types/contact';

const STATUS_META: Record<SupportStatus, { label: string; tone: BadgeTone }> = {
  open: { label: 'Open', tone: 'info' },
  reviewed: { label: 'Reviewed', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
};

export function supportStatusLabel(status: SupportStatus): string {
  return STATUS_META[status]?.label ?? status;
}

export function SupportStatusBadge({ status }: { status: SupportStatus }) {
  return <Badge tone={STATUS_META[status]?.tone ?? 'neutral'}>{supportStatusLabel(status)}</Badge>;
}

export const ENQUIRY_CATEGORY_LABEL: Record<EnquiryCategory, string> = {
  general: 'General',
  courses: 'Courses',
  pricing: 'Pricing',
  technical: 'Technical',
  partnership: 'Partnership',
  other: 'Other',
};

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  account_login: 'Account & Login',
  course_learning: 'Course & Learning',
  payment_fees: 'Payment & Fees',
  certificate: 'Certificate',
  technical_issue: 'Technical Issue',
  other: 'Other',
};

const PRIORITY_META: Record<TicketPriority, { label: string; tone: BadgeTone }> = {
  low: { label: 'Low', tone: 'neutral' },
  normal: { label: 'Normal', tone: 'info' },
  high: { label: 'High', tone: 'warning' },
  urgent: { label: 'Urgent', tone: 'danger' },
};

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.normal;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export const SENDER_ROLE_LABEL: Record<TicketSenderRole, string> = {
  student: 'Student',
  admin: 'Admin',
  instructor: 'Instructor',
};

export function senderRoleLabel(role: TicketSenderRole | 'admin' | 'instructor'): string {
  return SENDER_ROLE_LABEL[role] ?? role;
}
