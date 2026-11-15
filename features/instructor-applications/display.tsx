import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { ExpertiseLevel, InstructorAppStatus } from '@/types/instructor-applications';

export const APPLICATION_STATUS_LABEL: Record<InstructorAppStatus, string> = {
  pending: 'Pending',
  reviewing: 'Reviewing',
  shortlisted: 'Shortlisted',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_TONE: Record<InstructorAppStatus, BadgeTone> = {
  pending: 'warning',
  reviewing: 'info',
  shortlisted: 'brand',
  approved: 'success',
  rejected: 'danger',
};

export function ApplicationStatusBadge({ status }: { status: InstructorAppStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{APPLICATION_STATUS_LABEL[status] ?? status}</Badge>;
}

const EXPERTISE_TONE: Record<ExpertiseLevel, BadgeTone> = {
  Expert: 'success',
  Proficient: 'info',
  Competent: 'warning',
  Beginner: 'neutral',
};

export function ExpertiseBadge({ level }: { level: ExpertiseLevel }) {
  return <Badge tone={EXPERTISE_TONE[level] ?? 'neutral'}>{level}</Badge>;
}

export const APPLICATION_STATUSES = Object.keys(APPLICATION_STATUS_LABEL) as InstructorAppStatus[];
