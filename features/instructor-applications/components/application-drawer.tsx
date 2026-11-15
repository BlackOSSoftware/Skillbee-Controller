'use client';

import { Download, ExternalLink, FileText, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { hasPermissions } from '@/lib/roles';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import { formatDateTime } from '@/features/assignments/display';
import { useUserNames } from '@/features/shared/lookups';
import type { InstructorAppStatus, InstructorApplication } from '@/types/instructor-applications';
import { ApplicationStatusBadge, APPLICATION_STATUS_LABEL, APPLICATION_STATUSES, ExpertiseBadge } from '../display';
import { useApplicationDetail, useDownloadResume } from '../hooks';
import { ApplicationDeleteDialog, ApplicationStatusDialog } from './application-actions';

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function auditLabel(entry: { action: string; meta?: { from?: string; to?: string } }): string {
  if (entry.action === 'status_changed') {
    const from = entry.meta?.from ? APPLICATION_STATUS_LABEL[entry.meta.from as InstructorAppStatus] ?? entry.meta.from : '—';
    const to = entry.meta?.to ? APPLICATION_STATUS_LABEL[entry.meta.to as InstructorAppStatus] ?? entry.meta.to : '—';
    return `${from} → ${to}`;
  }
  if (entry.action === 'deleted') return 'Application deleted';
  if (entry.action === 'submitted') return 'Application submitted';
  return entry.action;
}

export function ApplicationDrawer({ seed, onClose }: { seed: InstructorApplication; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const detail = useApplicationDetail(seed.id, seed);
  const application = detail.data;
  const [statusDialog, setStatusDialog] = useState<InstructorAppStatus | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const download = useDownloadResume();

  const actorIds = useMemo(
    () => [
      ...(application?.auditLog ?? []).map((e) => e.actorId),
      application?.reviewedBy,
    ],
    [application]
  );
  const names = useUserNames(actorIds, hasPermissions(user, ['users:read']));

  function nameOf(id: string | null | undefined): string {
    if (!id) return 'System';
    if (user && id === user.id) return 'You';
    return names.get(id)?.name ?? 'Staff member';
  }

  function downloadResume() {
    if (!application || download.isPending) return;
    download.mutate(
      { id: application.id, fallbackName: application.resume.originalFileName || 'resume' },
      {
        onSuccess: ({ blob, fileName }) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          toast.success('Resume downloaded', fileName);
        },
        onError: (e) => toast.error('Could not download resume', normalizeApiError(e).message),
      }
    );
  }

  const status: InstructorAppStatus = application?.status ?? 'pending';

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        placement="right"
        size="lg"
        title={application ? application.fullName : 'Application'}
        description={application ? `${application.expertSubject} · ${application.expertiseLevel}` : 'Loading…'}
        footer={
          application && !detail.isError ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto flex items-center gap-2 text-xs text-ink-subtle">
                <ApplicationStatusBadge status={status} />
                Applied {formatDateTime(application.createdAt)}
              </span>
              <Button size="sm" variant="secondary" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-3.5" aria-hidden />
                Delete
              </Button>
              {APPLICATION_STATUSES.filter((s) => s !== status).map((s) => (
                <Button key={s} size="sm" variant="secondary" onClick={() => setStatusDialog(s)}>
                  Set {APPLICATION_STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
          ) : undefined
        }
      >
        {detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        ) : !application ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <section aria-label="Applicant">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Applicant</h3>
              <dl className="divide-y divide-line rounded-lg border border-line">
                <Meta label="Full name">{application.fullName}</Meta>
                <Meta label="Email">
                  <a href={`mailto:${application.email}`} className="text-primary hover:underline">
                    {application.email}
                  </a>
                </Meta>
                <Meta label="Phone">{application.phone}</Meta>
                <Meta label="Applied">{formatDateTime(application.createdAt)}</Meta>
                <Meta label="Last updated">{formatDateTime(application.updatedAt)}</Meta>
              </dl>
            </section>

            <section aria-label="Professional background">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Professional background</h3>
              <dl className="divide-y divide-line rounded-lg border border-line">
                <Meta label="Expert subject">{application.expertSubject}</Meta>
                <Meta label="Expertise level">
                  <ExpertiseBadge level={application.expertiseLevel} />
                </Meta>
                <Meta label="LinkedIn">
                  {application.linkedinProfileUrl ? (
                    <a
                      href={application.linkedinProfileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                      View profile
                    </a>
                  ) : (
                    '—'
                  )}
                </Meta>
              </dl>
              {application.comments ? (
                <div className="mt-3 rounded-lg border border-line bg-surface-2/40 p-3.5">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{application.comments}</p>
                </div>
              ) : null}
            </section>

            <section aria-label="Resume">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                <FileText className="size-3.5" aria-hidden />
                Resume
              </h3>
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{application.resume.originalFileName}</p>
                  <p className="text-xs text-ink-muted">
                    {application.resume.mimeType} · {formatBytes(application.resume.fileSize)}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={downloadResume} loading={download.isPending}>
                  <Download className="size-3.5" aria-hidden />
                  Download resume
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-ink-subtle">Secure download — the file is streamed through the authenticated API.</p>
            </section>

            <section aria-label="Review">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Review</h3>
              <dl className="divide-y divide-line rounded-lg border border-line">
                <Meta label="Status">
                  <ApplicationStatusBadge status={status} />
                </Meta>
                <Meta label="Reviewed by">
                  {application.reviewedBy ? nameOf(application.reviewedBy) : 'Not reviewed yet'}
                  {application.reviewedAt ? ` · ${formatDateTime(application.reviewedAt)}` : ''}
                </Meta>
                <Meta label="Admin notes">
                  {application.adminNotes ? (
                    <span className="whitespace-pre-line">{application.adminNotes}</span>
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </Meta>
              </dl>
            </section>

            <section aria-label="History">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">History</h3>
              {detail.isPlaceholderData ? (
                <Skeleton className="h-16 w-full" />
              ) : !application.auditLog.length ? (
                <p className="text-sm text-ink-subtle">No history recorded.</p>
              ) : (
                <ol className="relative space-y-3 border-l border-line pl-4">
                  {[...application.auditLog].reverse().map((entry, i) => (
                    <li key={`${entry.at}-${i}`} className="relative">
                      <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-ink-subtle ring-2 ring-surface" aria-hidden />
                      <p className="text-sm font-medium text-ink">{auditLabel(entry)}</p>
                      <p className="text-xs text-ink-muted">
                        {formatDateTime(entry.at)}
                        {entry.actorId ? ` · ${nameOf(entry.actorId)}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </Dialog>

      {statusDialog && application ? (
        <ApplicationStatusDialog
          application={application}
          target={statusDialog}
          onClose={() => setStatusDialog(null)}
          onDone={onClose}
        />
      ) : null}
      {deleteOpen && application ? (
        <ApplicationDeleteDialog application={application} onClose={() => setDeleteOpen(false)} onDone={onClose} />
      ) : null}
    </>
  );
}
