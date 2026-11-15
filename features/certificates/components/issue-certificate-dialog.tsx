'use client';

import { ArrowLeft, Award, CircleAlert, CircleCheckBig, Download, RefreshCw, Search, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import type { Certificate, CertificateEligibility } from '@/types/certificates';
import { describeRequirement, RequirementIcon } from '../display';
import { useActiveTemplates, useCourseCatalog, useDownloadCertificate, useEligibility, useEnrollmentPicker, useIssueCertificate } from '../hooks';

export interface IssueTarget {
  studentId: string;
  courseId: string;
  studentName: string;
  courseName: string;
  /** Issue as a replacement for this revoked certificate. */
  replaceRevokedId?: string;
  replaceNumber?: string;
}

function EligibilityPanel({ result, onViewExisting }: { result: CertificateEligibility; onViewExisting?: (id: string) => void }) {
  const hasProgress = result.totalRequiredLessons > 0 || result.minimumCompletionPercentage !== undefined;
  return (
    <div className={cn('rounded-xl border p-4', result.eligible ? 'border-success/30 bg-success/[0.05]' : 'border-danger/25 bg-danger/[0.04]')}>
      <div className="flex items-start gap-3">
        {result.eligible ? <CircleCheckBig className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />}
        <div className="min-w-0">
          <p className={cn('text-sm font-semibold', result.eligible ? 'text-success' : 'text-danger')}>{result.eligible ? 'Eligible for a certificate' : 'Not eligible yet'}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{result.reason}</p>
        </div>
      </div>

      {hasProgress ? (
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line text-sm sm:grid-cols-4 [&>div]:bg-surface [&>div]:px-3 [&>div]:py-2">
          <div>
            <dt className="text-[11px] text-ink-subtle">Required lessons</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-ink">
              {result.requiredLessonsCompleted}/{result.totalRequiredLessons}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-subtle">Progress</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-ink">
              {result.progressPercentage}%{result.minimumCompletionPercentage !== undefined ? <span className="font-normal text-ink-subtle"> / {result.minimumCompletionPercentage}%</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-subtle">Linked quizzes</dt>
            <dd className={cn('mt-0.5 font-medium', result.requiredQuizzesPassed ? 'text-success' : 'text-danger')}>{result.requiredQuizzesPassed ? 'Passed' : 'Pending'}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-subtle">Linked assignments</dt>
            <dd className={cn('mt-0.5 font-medium', result.requiredAssignmentsCompleted ? 'text-success' : 'text-danger')}>{result.requiredAssignmentsCompleted ? 'Evaluated' : 'Pending'}</dd>
          </div>
        </dl>
      ) : null}

      {result.missingRequirements.length ? (
        <ul className="mt-3 space-y-1.5">
          {result.missingRequirements.map((code) => (
            <li key={code} className="flex items-start gap-2 text-sm text-ink">
              <RequirementIcon met={false} />
              {describeRequirement(code)}
            </li>
          ))}
        </ul>
      ) : null}

      {result.existingCertificateId && onViewExisting ? (
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => onViewExisting(result.existingCertificateId as string)}>
          <Award className="size-3.5" aria-hidden />
          View certificate {result.existingCertificateNumber}
        </Button>
      ) : null}
      {result.evaluatedAt ? <p className="mt-3 text-[11px] text-ink-subtle">Checked by the server {formatDate(result.evaluatedAt)}</p> : null}
    </div>
  );
}

interface IssueCertificateDialogProps {
  preset?: IssueTarget;
  onClose: () => void;
  onOpenCertificate: (certificate: Pick<Certificate, 'id'> & Partial<Certificate>) => void;
}

export function IssueCertificateDialog({ preset, onClose, onOpenCertificate }: IssueCertificateDialogProps) {
  const toast = useToast();
  const [target, setTarget] = useState<IssueTarget | null>(preset ?? null);
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [reason, setReason] = useState('');
  const [issued, setIssued] = useState<Certificate | null>(null);
  const debounced = useDebouncedValue(search.trim(), 400);
  const catalog = useCourseCatalog();
  const picker = useEnrollmentPicker(debounced, courseId, !target);
  const eligibility = useEligibility(target?.studentId ?? null, target?.courseId ?? null, !issued);
  const templates = useActiveTemplates(Boolean(eligibility.data?.eligible));
  const issue = useIssueCertificate();
  const download = useDownloadCertificate();
  const rows = picker.data?.enrollments ?? [];
  const reasonTooLong = reason.trim().length > 2000;

  function runIssue() {
    if (!target || !eligibility.data?.eligible || reasonTooLong) return;
    issue.mutate(
      {
        studentId: target.studentId,
        courseId: target.courseId,
        ...(templateId ? { templateId } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(target.replaceRevokedId ? { replaceRevokedId: target.replaceRevokedId } : {}),
      },
      {
        onSuccess: (c) => {
          setIssued(c);
          toast.success('Certificate issued', `${c.certificateNumber} · ${c.studentName}`);
        },
        onError: (error) => {
          const { code, message } = normalizeApiError(error);
          toast.error(code === 'NOT_ELIGIBLE' ? 'The server found the learner ineligible' : 'Could not issue certificate', message);
          if (code === 'NOT_ELIGIBLE' || code === 'DUPLICATE_CERTIFICATE') void eligibility.refetch();
        },
      }
    );
  }

  const footer = issued ? (
    <>
      <Button variant="secondary" onClick={onClose}>
        Done
      </Button>
      <Button variant="secondary" onClick={() => download.mutate(issued, { onError: (e) => toast.error('Download failed', normalizeApiError(e).message) })} loading={download.isPending}>
        <Download className="size-4" aria-hidden />
        Download PDF
      </Button>
      <Button onClick={() => onOpenCertificate(issued)}>View certificate</Button>
    </>
  ) : target ? (
    <>
      {!preset ? (
        <Button variant="ghost" className="mr-auto" onClick={() => setTarget(null)} disabled={issue.isPending}>
          <ArrowLeft className="size-4" aria-hidden />
          Change learner
        </Button>
      ) : null}
      <Button variant="secondary" onClick={onClose} disabled={issue.isPending}>
        Cancel
      </Button>
      {eligibility.data?.eligible ? (
        <Button onClick={runIssue} loading={issue.isPending} disabled={reasonTooLong || eligibility.isFetching}>
          <Award className="size-4" aria-hidden />
          Issue certificate
        </Button>
      ) : null}
    </>
  ) : (
    <Button variant="secondary" onClick={onClose}>
      Cancel
    </Button>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      busy={issue.isPending}
      size="lg"
      title={target?.replaceRevokedId ? 'Issue replacement certificate' : 'Issue certificate'}
      description="The server checks completion requirements before anything is issued."
      footer={footer}
    >
      {issued ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/[0.05] p-4">
            <CircleCheckBig className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-success">Certificate issued</p>
              <p className="mt-0.5 text-sm text-ink-muted">The PDF was generated and the learner can now verify it publicly.</p>
            </div>
          </div>
          <dl className="divide-y divide-line rounded-lg border border-line text-sm">
            {[
              ['Certificate no.', <span key="n" className="font-mono">{issued.certificateNumber}</span>],
              ['Learner', issued.studentName],
              ['Course', issued.courseName],
              ['Issued', formatDate(issued.issueDate)],
              ['Completed', formatDate(issued.completionDate)],
              ['Template', issued.templateSnapshot?.name ?? '—'],
            ].map(([k, val]) => (
              <div key={String(k)} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-2">
                <dt className="text-xs text-ink-subtle">{k}</dt>
                <dd className="min-w-0 break-words text-ink">{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : !target ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search learner name or email" className="pl-9" aria-label="Search enrolled learners" />
            </div>
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="sm:w-56" aria-label="Filter by course" disabled={catalog.query.isPending || catalog.query.isError}>
              <option value="">{catalog.query.isError ? 'Courses unavailable' : 'All courses'}</option>
              {catalog.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-ink-muted">Choose an enrollment. Certificates are issued per learner and course.</p>
          {picker.isError ? (
            <ErrorState error={picker.error} onRetry={() => picker.refetch()} compact />
          ) : !picker.isPending && !rows.length ? (
            <EmptyState icon={<UserRound className="size-5" aria-hidden />} title="No enrollments found" description="Try another name, email or course." />
          ) : (
            <ul className={cn('divide-y divide-line overflow-hidden rounded-lg border border-line', picker.isPlaceholderData && 'opacity-60')}>
              {picker.isPending
                ? Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="space-y-1.5 px-4 py-3">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-3 w-64" />
                    </li>
                  ))
                : rows.map((e) => {
                    const name = e.student ? [e.student.firstName, e.student.lastName].filter(Boolean).join(' ') || e.student.email : 'Unknown learner';
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          disabled={!e.student || !e.course}
                          onClick={() => e.student && e.course && setTarget({ studentId: e.studentId, courseId: e.courseId, studentName: name, courseName: e.course.title })}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60 disabled:opacity-50"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                            {name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">{name}</span>
                            <span className="block truncate text-xs text-ink-muted">
                              {e.course?.title ?? 'Unknown course'} · {e.student?.email}
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-xs tabular-nums text-ink-muted">
                            {Math.round(e.progressPercentage)}%<span className="block text-[11px] text-ink-subtle">{e.status}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {target.replaceRevokedId ? (
            <p className="rounded-lg border border-warning/30 bg-warning/[0.06] px-3 py-2 text-xs text-ink-muted">
              Replaces revoked certificate <span className="font-mono text-ink">{target.replaceNumber}</span>. The old record stays revoked and links to the new one.
            </p>
          ) : null}
          <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{target.studentName.slice(0, 2).toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{target.studentName}</p>
              <p className="truncate text-xs text-ink-muted">{target.courseName}</p>
            </div>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => eligibility.refetch()} loading={eligibility.isFetching} aria-label="Check eligibility again">
              <RefreshCw className="size-3.5" aria-hidden />
              Re-check
            </Button>
          </div>

          {eligibility.isPending ? (
            <div className="space-y-2 rounded-xl border border-line p-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72" />
              <Skeleton className="mt-3 h-14 w-full" />
            </div>
          ) : eligibility.isError ? (
            <ErrorState error={eligibility.error} onRetry={() => eligibility.refetch()} compact />
          ) : eligibility.data ? (
            <EligibilityPanel result={eligibility.data} onViewExisting={(id) => onOpenCertificate({ id })} />
          ) : null}

          {eligibility.data?.eligible ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ic-template" label="Template" hint={templates.isError ? 'Templates could not be loaded; the server will choose' : 'Course template or the default when left automatic'}>
                <Select id="ic-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={templates.isPending || templates.isError}>
                  <option value="">Automatic</option>
                  {(templates.data?.templates ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="ic-reason" label="Note for the history" error={reasonTooLong ? '2,000 characters or less.' : undefined} hint="Optional">
                <Textarea id="ic-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby="ic-reason-msg" />
              </Field>
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
