import { Ban, CircleCheck, CircleDashed, Clock3, FilePen, PauseCircle, Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { CertificateStatus, ConfigRecord, FieldToggle, HistoryAction, IssueSource, TemplateStatus } from '@/types/certificates';

const pill = 'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset';

const TEMPLATE_STATUS: Record<TemplateStatus, { label: string; className: string; icon: typeof CircleCheck }> = {
  active: { label: 'Active', className: 'bg-success/10 text-success ring-success/25', icon: CircleCheck },
  draft: { label: 'Draft', className: 'bg-surface-2 text-ink-muted ring-line', icon: FilePen },
  inactive: { label: 'Inactive', className: 'bg-warning/10 text-warning ring-warning/25', icon: PauseCircle },
};

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  const s = TEMPLATE_STATUS[status];
  return (
    <span className={cn(pill, s.className)}>
      <s.icon className="size-3" aria-hidden />
      {s.label}
    </span>
  );
}

export function DefaultBadge() {
  return (
    <span className={cn(pill, 'bg-primary/10 text-primary ring-primary/25')}>
      <Star className="size-3 fill-current" aria-hidden />
      Default
    </span>
  );
}

export const templateStatusLabel = (s: TemplateStatus) => TEMPLATE_STATUS[s].label;

const CERT_STATUS: Record<CertificateStatus, { label: string; className: string; icon: typeof CircleCheck }> = {
  issued: { label: 'Issued', className: 'bg-success/10 text-success ring-success/25', icon: CircleCheck },
  revoked: { label: 'Revoked', className: 'bg-danger/10 text-danger ring-danger/25', icon: Ban },
  expired: { label: 'Expired', className: 'bg-surface-2 text-ink-muted ring-line', icon: Clock3 },
};

export function CertificateStatusBadge({ status }: { status: CertificateStatus }) {
  const s = CERT_STATUS[status];
  return (
    <span className={cn(pill, s.className)}>
      <s.icon className="size-3" aria-hidden />
      {s.label}
    </span>
  );
}

export const certificateStatusLabel = (s: CertificateStatus) => CERT_STATUS[s].label;

export const ISSUE_SOURCE_LABEL: Record<IssueSource, string> = { manual: 'Manual', automatic: 'Automatic', regenerate: 'Regenerated' };

export const HISTORY_LABEL: Record<HistoryAction, string> = { issued: 'Issued', revoked: 'Revoked', regenerated: 'PDF regenerated', replaced: 'Replaced' };

export const FIELD_TOGGLE_LABEL: Record<FieldToggle, string> = {
  showStudentName: 'Learner name',
  showCourseName: 'Course name',
  showCertificateNumber: 'Certificate number',
  showCompletionDate: 'Completion date',
  showIssueDate: 'Issue date',
  showVerificationUrl: 'Verification link',
  showQrCode: 'Verification QR code',
  showSignatory: 'Signatory',
};

/** The renderer treats a missing toggle as shown. */
export function toggleOn(config: ConfigRecord | null | undefined, key: FieldToggle): boolean {
  return config?.[key] !== false;
}

/** Layout values the PDF renderer reads, with its own fallbacks. */
export function layoutOf(config: ConfigRecord | null | undefined) {
  const orientation = config?.orientation === 'portrait' ? 'portrait' : 'landscape';
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && v > 0 ? v : Number(v) > 0 ? Number(v) : fallback);
  return {
    orientation,
    pageWidth: num(config?.pageWidth, orientation === 'landscape' ? 842 : 595),
    pageHeight: num(config?.pageHeight, orientation === 'landscape' ? 595 : 842),
    margin: num(config?.margin, 40),
  } as const;
}

/** Plain-language rendering of `missingRequirements` codes from the eligibility engine. */
export function describeRequirement(code: string): string {
  if (code === 'active_certificate_exists') return 'An active certificate already exists for this enrollment.';
  if (code === 'course') return 'The course could not be found.';
  if (code === 'certificate.enabled') return 'Certificates are not enabled for this course.';
  if (code === 'course.status') return 'The course is archived.';
  if (code === 'enrollment') return 'The learner is not enrolled in this course.';
  if (code === 'enrollment.status') return 'The enrollment status does not allow a certificate.';
  if (code === 'enrollment.expiresAt') return 'The enrollment has expired.';
  if (code === 'enrollment.access') return 'The enrollment does not grant learning access.';
  if (code === 'courseCompletionStatus') return 'The course is not marked as completed.';
  if (code.startsWith('quiz:')) return `A lesson-linked quiz has not been passed (quiz ${code.slice(5, 13)}…).`;
  if (code.startsWith('assignment:')) return `A lesson-linked assignment has not been evaluated (assignment ${code.slice(11, 19)}…).`;
  const lessons = /^required_lessons \((\d+)\/(\d+) completed\)$/.exec(code);
  if (lessons) return `Required lessons completed: ${lessons[1]} of ${lessons[2]}.`;
  if (code.startsWith('required_lessons (course has zero')) return 'The course has no required published lessons yet.';
  const pct = /^minimumCompletionPercentage \((\d+)% < (\d+)%\)$/.exec(code);
  if (pct) return `Progress is ${pct[1]}%; at least ${pct[2]}% is required.`;
  return code;
}

export function RequirementIcon({ met }: { met: boolean }) {
  return met ? <CircleCheck className="size-4 shrink-0 text-success" aria-hidden /> : <CircleDashed className="size-4 shrink-0 text-danger" aria-hidden />;
}

export function shortHash(value: string | null | undefined, size = 10): string {
  return value ? `${value.slice(0, size)}…` : '—';
}
