'use client';

import { Award, Download, Eye, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { ActionMenu } from '@/components/ui/menu';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { hasPermissions } from '@/lib/roles';
import { useToast } from '@/providers/toast-provider';
import { CERTIFICATE_STATUSES, type Certificate, type CertificateListParams, type CertificateStatus } from '@/types/certificates';
import { certificateStatusLabel, CertificateStatusBadge, ISSUE_SOURCE_LABEL } from '../display';
import { LearnerFilter } from '@/features/shared/learner-filter';
import { useCertificateList, useCourseCatalog, useDownloadCertificate } from '../hooks';
import { CertificateDrawer } from './certificate-drawer';
import { IssueCertificateDialog, type IssueTarget } from './issue-certificate-dialog';

const PAGE_SIZES = [10, 20, 50];

type Modal = { kind: 'certificate'; seed: Pick<Certificate, 'id'> & Partial<Certificate> } | { kind: 'issue'; preset?: IssueTarget } | null;

export function IssuedPanel() {
  const { user } = useAuth();
  const toast = useToast();
  const canReadUsers = hasPermissions(user, ['users:read']);
  const [status, setStatus] = useState<CertificateStatus | ''>('');
  const [courseId, setCourseId] = useState('');
  const [learner, setLearner] = useState<{ id: string; name: string } | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [modal, setModal] = useState<Modal>(null);
  const catalog = useCourseCatalog();
  const download = useDownloadCertificate();
  const params: CertificateListParams = { page, limit, status: status || undefined, courseId: courseId || undefined, studentId: learner?.id };
  const list = useCertificateList(params);
  const rows = list.data?.certificates ?? [];
  const filtered = Boolean(status || courseId || learner);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function runDownload(c: Certificate) {
    download.mutate(c, { onError: (e) => toast.error('Download failed', normalizeApiError(e).message) });
  }

  const actionsFor = (c: Certificate) => [
    { key: 'view', label: 'View details', icon: <Eye className="size-4" />, onSelect: () => setModal({ kind: 'certificate', seed: c }) },
    { key: 'download', label: 'Download PDF', icon: <Download className="size-4" />, disabled: download.isPending, onSelect: () => runDownload(c) },
  ];

  return (
    <>
      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Issued certificates</h2>
              <p className="text-xs text-ink-muted">Every certificate keeps the learner, course and design captured when it was issued.</p>
            </div>
            <Button size="sm" onClick={() => setModal({ kind: 'issue' })}>
              <Plus className="size-4" aria-hidden />
              Issue certificate
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canReadUsers ? <LearnerFilter value={learner} onChange={resetPage(setLearner)} /> : null}
            <Select value={courseId} onChange={(e) => resetPage(setCourseId)(e.target.value)} className="min-w-0 sm:w-60" aria-label="Filter by course" disabled={catalog.query.isPending || catalog.query.isError}>
              <option value="">{catalog.query.isError ? 'Courses unavailable' : 'All courses'}</option>
              {catalog.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => resetPage(setStatus)(e.target.value as CertificateStatus | '')} className="sm:w-40" aria-label="Filter by status">
              <option value="">All statuses</option>
              {CERTIFICATE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {certificateStatusLabel(s)}
                </option>
              ))}
            </Select>
            {filtered ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setStatus('');
                  setCourseId('');
                  setLearner(null);
                  setPage(1);
                }}
              >
                <X className="size-4" aria-hidden />
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isPending && !rows.length ? (
          <EmptyState
            icon={<Award className="size-5" aria-hidden />}
            title={filtered ? 'No certificates match these filters' : 'No certificates issued yet'}
            description={filtered ? 'Try another learner, course or status.' : 'Issue a certificate once a learner meets the course completion requirements.'}
            action={filtered ? undefined : <Button size="sm" onClick={() => setModal({ kind: 'issue' })}>Issue a certificate</Button>}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Learner</th>
                    <th scope="col" className="px-3 py-2.5">Course</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Certificate no.</th>
                    <th scope="col" className="px-3 py-2.5">Issued</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3.5 pl-5 pr-3">
                            <Skeleton className="h-4 w-36" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-4 w-44" />
                          </td>
                          <td className="hidden px-3 py-3.5 lg:table-cell">
                            <Skeleton className="h-4 w-32" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-5 w-16" />
                          </td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((c) => (
                        <tr key={c.id} className="group transition-colors hover:bg-surface-2/50">
                          <td className="max-w-0 py-3.5 pl-5 pr-3 lg:w-1/4">
                            <button type="button" onClick={() => setModal({ kind: 'certificate', seed: c })} className="flex w-full min-w-0 items-center gap-3 text-left">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{c.studentName.slice(0, 2).toUpperCase()}</span>
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-ink group-hover:text-primary">{c.studentName}</span>
                                <span className="block truncate font-mono text-[11px] text-ink-subtle lg:hidden">{c.certificateNumber}</span>
                              </span>
                            </button>
                          </td>
                          <td className="max-w-0 px-3 py-3.5 lg:w-1/3">
                            <span className="block truncate text-ink">{c.courseName}</span>
                            <span className="block text-[11px] text-ink-subtle">{ISSUE_SOURCE_LABEL[c.issueSource] ?? c.issueSource} issue</span>
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-3.5 font-mono text-xs text-ink-muted lg:table-cell">{c.certificateNumber}</td>
                          <td className="w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted">{formatDate(c.issueDate)}</td>
                          <td className="w-px px-3 py-3.5">
                            <CertificateStatusBadge status={c.certificateStatus} />
                          </td>
                          <td className="w-px py-3.5 pl-3 pr-5 text-right">
                            <ActionMenu label={`Actions for ${c.certificateNumber}`} items={actionsFor(c)} />
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            <ul className={cn('divide-y divide-line md:hidden', list.isPlaceholderData && 'opacity-60')}>
              {list.isPending
                ? Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="space-y-2 p-4">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </li>
                  ))
                : rows.map((c) => (
                    <li key={c.id} className="flex items-start gap-2 p-4">
                      <button type="button" onClick={() => setModal({ kind: 'certificate', seed: c })} className="block min-w-0 flex-1 space-y-1.5 text-left">
                        <span className="block truncate font-medium text-ink">{c.studentName}</span>
                        <span className="block truncate text-xs text-ink-muted">{c.courseName}</span>
                        <span className="flex flex-wrap items-center gap-2">
                          <CertificateStatusBadge status={c.certificateStatus} />
                          <span className="font-mono text-[11px] text-ink-subtle">{c.certificateNumber}</span>
                          <span className="text-[11px] text-ink-subtle">{formatDate(c.issueDate)}</span>
                        </span>
                      </button>
                      <ActionMenu label={`Actions for ${c.certificateNumber}`} items={actionsFor(c)} />
                    </li>
                  ))}
            </ul>
          </>
        )}
        <Pagination
          meta={list.data?.pagination}
          onPageChange={setPage}
          disabled={list.isFetching}
          pageSizeOptions={PAGE_SIZES}
          onPageSizeChange={(size) => {
            setLimit(size);
            setPage(1);
          }}
        />
      </Card>

      {modal?.kind === 'certificate' ? (
        <CertificateDrawer
          key={modal.seed.id}
          seed={modal.seed}
          onClose={() => setModal(null)}
          onOpen={(id) => setModal({ kind: 'certificate', seed: { id } })}
          onIssueReplacement={(preset) => setModal({ kind: 'issue', preset })}
        />
      ) : null}
      {modal?.kind === 'issue' ? (
        <IssueCertificateDialog preset={modal.preset} onClose={() => setModal(null)} onOpenCertificate={(c) => setModal({ kind: 'certificate', seed: c })} />
      ) : null}
    </>
  );
}