import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { QuestionSort, QuestionStatus, QaStudent, ReplySenderRole } from '@/types/qa';

const STATUS_META: Record<QuestionStatus, { label: string; tone: BadgeTone }> = {
  open: { label: 'Open', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'success' },
};

export function questionStatusLabel(status: QuestionStatus): string {
  return STATUS_META[status]?.label ?? status;
}

export function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  return <Badge tone={STATUS_META[status]?.tone ?? 'neutral'}>{questionStatusLabel(status)}</Badge>;
}

export const QUESTION_SORT_LABEL: Record<QuestionSort, string> = {
  newest: 'Newest first',
  last_activity: 'Recent activity',
};

export const SENDER_ROLE_LABEL: Record<ReplySenderRole, string> = {
  student: 'Student',
  admin: 'Admin',
  instructor: 'Instructor',
};

export function qaStudentName(student: QaStudent | null | undefined): string {
  if (!student) return 'Unknown student';
  return [student.firstName, student.lastName].filter(Boolean).join(' ') || student.email;
}

export function qaStudentInitials(student: QaStudent | null | undefined): string {
  const name = qaStudentName(student);
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
