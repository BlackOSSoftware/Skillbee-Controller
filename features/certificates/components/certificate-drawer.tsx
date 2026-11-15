'use client';

import { Ban, Download, ExternalLink, History, Link2, RefreshCcw, RotateCcw, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/input';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { hasPermissions } from '@/lib/roles';
import { useToast } from '@/providers/toast-provider';
import type { Certificate } from '@/types/certificates';
import { formatDate } from '@/lib/format';
import { formatDateTime } from '@/features/assignments/display';
import { CertificateStatusBadge, HISTORY_LABEL, ISSUE_SOURCE_LABEL, shortHash } from '../display';
import { useCertificate, useCertificateHistory, useDownloadCertificate, useRegenerateCertificate, useRevokeCertificate, useUserNames } from '../hooks';
import { CertificatePreview } from './certificate-preview';
import type { IssueTarget } from './issue-certificate-dialog';

/** The PDF prints dates as YYYY-MM-DD. */
const isoDay = (value: string | null | undefined) => (value ? new Date(value).toISOString().slice(0, 10) : '');

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-2">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

function HistoryTab({ id, canReadUsers }: { id: string; canReadUsers: boolean }) {
  const history = useCertificateHistory(id, true);
  const events = [...(history.data?.history ?? [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const names = useUserNames(events.map((e) => e.actorId), canReadUsers);
  if (history.isError) return <ErrorState error={history.error} onRetry={() => history.refetch()} compact />;
  if (history.isPending)
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
        ))}
      </div>
    );
  if (!events.length) return <p className="py-6 text-center text-sm text-ink-subtle">No history recorded.</p>;
  return (
    <ol className="relative space-y-5 border-l border-line pl-5">
      {events.map((e, i) => {
        const checksum = typeof e.meta?.pdfChecksum === 'string' ? e.meta.pdfChecksum : null;
        return (
          <li key={e.id ?? i} className="relative">
            <span
              className={cn(
                'absolute -left-[26px] top-1 size-2.5 rounded-full ring-4 ring-surface',
                e.action === 'revoked' ? 'bg-danger' : e.action === 'regenerated' ? 'bg-info' : e.action === 'replaced' ? 'bg-warning' : 'bg-success'
              )}
              aria-hidden
            />
            <p className="text-sm font-medium text-ink">{HISTORY_LABEL[e.action] ?? e.action}</p>
            <p className="text-xs text-ink-muted">
              {formatDateTime(e.at)}
              {' · '}
              {e.actorId ? (names.get(e.actorId)?.name ?? `User ${e.actorId.slice(-6)}`) : 'System'}
            </p>
            {e.reason ? <p className="mt-1 text-sm text-ink-muted">{e.reason}</p> : null}
            {checksum ? <p className="mt-0.5 font-mono text-[11px] text-ink-subtle" title={checksum}>New PDF checksum {shortHash(checksum, 12)}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

interface CertificateDrawerProps {
  seed: Pick<Certificate, 'id'> & Partial<Certificate>;
  onClose: () => void;
  onOpen: (id: string) => void;
  onIssueReplacement: (target: IssueTarget) => void;
}

export function CertificateDrawer({ seed, onClose, onOpen, onIssueReplacement }: CertificateDrawerProps) {
  const { user } = useAuth();
  const toast = useToast();
  const canReadUsers = hasPermissions(user, ['users:read']);
  const detail = useCertificate(seed.id, seed.certificateNumber ? (seed as Certificate) : undefined);
  const [tab, setTab] = useState<'details' | 'history'>('details');
  const [confirm, setConfirm] = useState<'revoke' | 'regenerate' | null>(null);
  const [reason, setReason] = useState('');
  const download = useDownloadCertificate();
  const regenerate = useRegenerateCertificate();
  const revoke = useRevokeCertificate();
  const c = detail.data;
  const issuedState = c?.certificateStatus === 'issued';
  const snapshot = c?.templateSnapshot;

  function runDownload() {
    if (!c) return;
    download.mutate(c, { onError: (e) => toast.error('Download failed', normalizeApiError(e).message) });
  }

  function runConfirm() {
    if (!c) return;
    if (confirm === 'regenerate') {
      regenerate.mutate(c.id, {
        onSuccess: () => {
          toast.success('PDF regenerated', 'Rebuilt from the stored snapshot; certificate details are unchanged.');
          setConfirm(null);
        },
        onError: (e) => {
          toast.error('Could not regenerate PDF', normalizeApiError(e).message);
          setConfirm(null);
        },
      });
    } else if (confirm === 'revoke') {
      if (reason.trim().length > 2000) return;
      revoke.mutate(
        { id: c.id, reason: reason.trim() || undefined },
        {
          onSuccess: () => {
            toast.success('Certificate revoked', 'Public verification now reports it as revoked.');
            setConfirm(null);
            setReason('');
          },
          onError: (e) => {
            toast.error('Could not revoke certificate', normalizeApiError(e).message);
            setConfirm(null);
          },
        }
      );
    }
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        placement="right"
        title={c?.certificateNumber ?? 'Certificate'}
        description={c ? `${c.studentName} · ${c.courseName}` : undefined}
        toolbar={
          <div className="flex items-center justify-between gap-3">
            <div role="tablist" aria-label="Certificate sections" className="flex gap-1">
              {(['details', 'history'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', tab === t ? 'bg-primary/10 text-primary' : 'text-ink-muted hover:bg-surface-2 hover:text-ink')}
                >
                  {t === 'details' ? 'Details' : 'History'}
                </button>
              ))}
            </div>
            {c ? <CertificateStatusBadge status={c.certificateStatus} /> : null}
          </div>
        }
        footer={
          c ? (
            <>
              {issuedState ? (
                <Button variant="danger" size="sm" className="mr-auto" onClick={() => setConfirm('revoke')}>
                  <Ban className="size-3.5" aria-hidden />
                  Revoke
                </Button>
              ) : c.certificateStatus === 'revoked' && !c.replacedByCertificateId ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mr-auto"
                  onClick={() => onIssueReplacement({ studentId: c.studentId, courseId: c.courseId, studentName: c.studentName, courseName: c.courseName, replaceRevokedId: c.id, replaceNumber: c.certificateNumber })}
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Issue replacement
                </Button>
              ) : null}
              {issuedState ? (
                <Button variant="secondary" size="sm" onClick={() => setConfirm('regenerate')}>
                  <RefreshCcw className="size-3.5" aria-hidden />
                  Regenerate PDF
                </Button>
              ) : null}
              <Button size="sm" onClick={runDownload} loading={download.isPending}>
                <Download className="size-3.5" aria-hidden />
                Download PDF
              </Button>
            </>
          ) : undefined
        }
      >
        {detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        ) : !c ? (
          <div className="space-y-3">
            <Skeleton className="aspect-[842/595] w-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : tab === 'history' ? (
          <HistoryTab id={c.id} canReadUsers={canReadUsers} />
        ) : (
          <div className="space-y-5">
            {snapshot ? (
              <div>
                <CertificatePreview
                  content={snapshot}
                  values={{
                    studentName: c.studentName,
                    courseName: c.courseName,
                    certificateNumber: c.certificateNumber,
                    completionDate: isoDay(c.completionDate),
                    issueDate: isoDay(c.issueDate),
                    verificationUrl: c.verificationUrl,
                  }}
                  className={c.certificateStatus === 'revoked' ? 'opacity-60 grayscale' : undefined}
                />
                <p className="mt-2 text-[11px] text-ink-subtle">Drawn from the template snapshot stored with this certificate. Download the PDF for the official document.</p>
              </div>
            ) : null}

            {c.certificateStatus === 'revoked' ? (
              <div className="rounded-lg border border-danger/25 bg-danger/[0.05] px-3 py-2.5 text-sm">
                <p className="font-medium text-danger">Revoked {formatDateTime(c.revokedAt)}</p>
                {c.revocationReason ? <p className="mt-0.5 text-ink-muted">{c.revocationReason}</p> : null}
              </div>
            ) : null}

            <dl className="divide-y divide-line rounded-lg border border-line">
              <Row label="Learner">{c.studentName}</Row>
              <Row label="Course">{c.courseName}</Row>
              <Row label="Organization">{c.organizationName}</Row>
              <Row label="Completed">{formatDate(c.completionDate)}</Row>
              <Row label="Issued">
                {formatDateTime(c.issueDate)} · {ISSUE_SOURCE_LABEL[c.issueSource] ?? c.issueSource}
              </Row>
              <Row label="Template">
                {snapshot?.name ?? '—'}
                {snapshot?.templateCode ? <span className="ml-1 font-mono text-[11px] text-ink-subtle">{snapshot.templateCode}</span> : null}
                {snapshot?.snapshottedAt ? <span className="block text-[11px] text-ink-subtle">Snapshot {formatDateTime(snapshot.snapshottedAt)}</span> : null}
              </Row>
              <Row label="Verification">
                <a href={c.verificationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  Public verification
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </Row>
              <Row label="PDF">
                {c.pdfFileName ?? '—'}
                {c.pdfChecksum ? (
                  <span className="block font-mono text-[11px] text-ink-subtle" title={`SHA-256 ${c.pdfChecksum}`}>
                    SHA-256 {shortHash(c.pdfChecksum, 16)}
                  </span>
                ) : null}
              </Row>
            </dl>

            {c.replacesCertificateId || c.replacedByCertificateId ? (
              <div className="flex flex-wrap gap-2">
                {c.replacesCertificateId ? (
                  <Button size="sm" variant="secondary" onClick={() => onOpen(c.replacesCertificateId as string)}>
                    <Link2 className="size-3.5" aria-hidden />
                    Replaces an earlier certificate
                  </Button>
                ) : null}
                {c.replacedByCertificateId ? (
                  <Button size="sm" variant="secondary" onClick={() => onOpen(c.replacedByCertificateId as string)}>
                    <Link2 className="size-3.5" aria-hidden />
                    Open replacement certificate
                  </Button>
                ) : null}
              </div>
            ) : null}

            {c.eligibilitySnapshot ? (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Completion at issue time</p>
                <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line text-sm [&>div]:bg-surface [&>div]:px-3 [&>div]:py-2">
                  <div>
                    <p className="text-[11px] text-ink-subtle">Lessons</p>
                    <p className="font-medium tabular-nums text-ink">
                      {c.eligibilitySnapshot.requiredLessonsCompleted}/{c.eligibilitySnapshot.totalRequiredLessons}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-ink-subtle">Progress</p>
                    <p className="font-medium tabular-nums text-ink">{c.eligibilitySnapshot.progressPercentage}%</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-ink-subtle">Evaluated</p>
                    <p className="font-medium text-ink">{formatDate(c.eligibilitySnapshot.evaluatedAt ?? null)}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <button type="button" onClick={() => setTab('history')} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              <History className="size-3.5" aria-hidden />
              View full history
            </button>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirm === 'regenerate'}
        title="Regenerate this PDF?"
        confirmLabel="Regenerate PDF"
        tone="primary"
        loading={regenerate.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
        description={<p>The PDF is rebuilt from the snapshot stored at issue time: same learner name, course, dates, number and design. Later template changes are not applied.</p>}
      />
      <ConfirmDialog
        open={confirm === 'revoke'}
        title="Revoke this certificate?"
        confirmLabel="Revoke certificate"
        loading={revoke.isPending}
        onCancel={() => {
          setConfirm(null);
          setReason('');
        }}
        onConfirm={runConfirm}
        description={
          <div className="space-y-3">
            <p>Public verification will report it as revoked. The record and its history are kept, and a replacement can be issued later.</p>
            <Field id="revoke-reason" label="Reason" hint="Optional · recorded in the history" error={reason.trim().length > 2000 ? '2,000 characters or less.' : undefined}>
              <Textarea id="revoke-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby="revoke-reason-msg" />
            </Field>
          </div>
        }
      />
    </>
  );
}
