'use client';

import { Eye, Mail } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { formatDateTime } from '@/features/assignments/display';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/query-keys';
import type { EmailLogListParams, EmailLogStatus } from '@/types/email';
import { EMAIL_LOG_STATUSES } from '@/types/email';
import { useEmailLog, useEmailLogs } from '../hooks';

const PAGE_SIZES = [10, 20, 50];

const STATUS_LABEL: Record<EmailLogStatus, string> = {
  queued: 'Queued',
  processing: 'Processing',
  sent: 'Sent',
  failed: 'Failed',
  simulated: 'Simulated',
};

function statusTone(status: EmailLogStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'sent': return 'success';
    case 'simulated': return 'info';
    case 'queued':
    case 'processing': return 'warning';
    case 'failed': return 'danger';
    default: return 'neutral';
  }
}

export function EmailLogsPanel() {
  const [recipient, setRecipient] = useState('');
  const [status, setStatus] = useState<'' | EmailLogStatus>('');
  const [eventType, setEventType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [detailId, setDetailId] = useState<string | null>(null);

  const params: EmailLogListParams = {
    page,
    limit,
    recipient: recipient.trim() || undefined,
    status: status || undefined,
    eventType: eventType.trim() || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };
  const list = useEmailLogs(params);
  const rows = list.data?.data ?? [];
  const filtered = Boolean(recipient.trim() || status || eventType.trim() || startDate || endDate);

  function clearAll() {
    setRecipient('');
    setStatus('');
    setEventType('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="Email Delivery Logs"
        description="Actual backend delivery records — statuses reflect real send attempts, including simulated sends when SMTP is not configured."
        actions={<RefreshButton queryKeys={[queryKeys.emailLogs.lists()]} />}
      />

      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{filtered ? 'Filtered logs' : 'All logs'}</h2>
            <p className="text-xs text-ink-muted">Newest first. Filter by recipient email, status, event type or date range.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Input type="email" value={recipient} onChange={(e) => { setRecipient(e.target.value); setPage(1); }} placeholder="recipient@email.com" aria-label="Filter by recipient" />
            <Select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }} aria-label="Filter by status">
              <option value="">Any status</option>
              {EMAIL_LOG_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </Select>
            <Input value={eventType} onChange={(e) => { setEventType(e.target.value); setPage(1); }} placeholder="Event type" aria-label="Filter by event type" />
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} aria-label="From date" />
            <div className="flex gap-2">
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} aria-label="To date" />
              {filtered ? <Button variant="ghost" onClick={clearAll} className="shrink-0">Clear</Button> : null}
            </div>
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isPending && !rows.length ? (
          <EmptyState
            icon={<Mail className="size-5" aria-hidden />}
            title={filtered ? 'No logs match these filters' : 'No email logs yet'}
            description={filtered ? 'Try widening the date range or clearing filters.' : 'Delivery records appear here when the backend sends email.'}
            action={filtered ? <Button size="sm" variant="secondary" onClick={clearAll}>Clear filters</Button> : undefined}
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Recipient</th>
                    <th scope="col" className="px-3 py-2.5">Subject</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Template</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Attempts</th>
                    <th scope="col" className="px-3 py-2.5">Created</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3.5 pl-5 pr-3"><Skeleton className="h-3.5 w-44" /></td>
                          <td className="px-3 py-3.5"><Skeleton className="h-3.5 w-56" /></td>
                          <td className="hidden px-3 py-3.5 lg:table-cell"><Skeleton className="h-3.5 w-28" /></td>
                          <td className="px-3 py-3.5"><Skeleton className="h-5 w-16" /></td>
                          <td className="hidden px-3 py-3.5 lg:table-cell"><Skeleton className="h-3.5 w-8" /></td>
                          <td className="px-3 py-3.5"><Skeleton className="h-3.5 w-28" /></td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((log) => (
                        <tr key={log.id} className="group align-top transition-colors hover:bg-surface-2/50">
                          <td className="max-w-52 py-3.5 pl-5 pr-3">
                            <span className="block break-all font-mono text-xs text-ink">{log.recipient}</span>
                          </td>
                          <td className="max-w-64 px-3 py-3.5">
                            <span className="block truncate text-xs text-ink">{log.subject}</span>
                            <span className="block truncate text-[11px] text-ink-subtle">{log.eventType}</span>
                          </td>
                          <td className="hidden w-px px-3 py-3.5 lg:table-cell">
                            {log.templateSlug ? <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-ink-muted">{log.templateSlug}</code> : <span className="text-xs text-ink-subtle">—</span>}
                          </td>
                          <td className="w-px px-3 py-3.5"><Badge tone={statusTone(log.status)}>{STATUS_LABEL[log.status]}</Badge></td>
                          <td className="hidden w-px px-3 py-3.5 text-xs tabular-nums text-ink-muted lg:table-cell">{log.attempts}</td>
                          <td className="w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted" title={formatDateTime(log.createdAt)}>
                            {formatDateTime(log.createdAt)}
                          </td>
                          <td className="w-px py-3 pl-3 pr-5 text-right">
                            <button type="button" onClick={() => setDetailId(log.id)} aria-label={`View log for ${log.recipient}`} className="rounded-md p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink">
                              <Eye className="size-4" aria-hidden />
                            </button>
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
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </li>
                  ))
                : rows.map((log) => (
                    <li key={log.id} className="space-y-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={statusTone(log.status)}>{STATUS_LABEL[log.status]}</Badge>
                        <span className="text-[11px] text-ink-subtle">{log.attempts} attempt(s)</span>
                      </div>
                      <p className="break-all font-mono text-xs text-ink">{log.recipient}</p>
                      <p className="line-clamp-1 text-xs text-ink-muted">{log.subject}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-ink-subtle">{formatDateTime(log.createdAt)}</span>
                        <Button size="sm" variant="secondary" onClick={() => setDetailId(log.id)}>
                          <Eye className="size-3.5" aria-hidden /> Details
                        </Button>
                      </div>
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
          onPageSizeChange={(size) => { setLimit(size); setPage(1); }}
        />
      </Card>

      {detailId ? <EmailLogDrawer id={detailId} onClose={() => setDetailId(null)} /> : null}
    </>
  );
}

// ---------------- Detail drawer ----------------

function EmailLogDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useEmailLog(id);
  const log = detail.data;

  return (
    <Dialog open onClose={onClose} placement="right" size="lg" title={log?.subject ?? 'Email log'} description={log ? `To ${log.recipient}` : 'Loading…'}>
      {detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      ) : !log ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(log.status)}>{STATUS_LABEL[log.status]}</Badge>
            <Badge tone="neutral">{log.eventType}</Badge>
          </div>
          <section aria-label="Delivery">
            <dl className="divide-y divide-line rounded-lg border border-line">
              {[
                ['Recipient', <span key="r" className="break-all font-mono text-xs">{log.recipient}</span>],
                ['Subject', log.subject],
                ['Template', log.templateSlug ? <code key="t" className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{log.templateSlug}</code> : '—'],
                ['Status', STATUS_LABEL[log.status]],
                ['Attempts', String(log.attempts)],
                ['Provider message ID', log.providerMessageId ? <span key="p" className="break-all font-mono text-xs">{log.providerMessageId}</span> : '—'],
                ['Sent at', log.sentAt ? formatDateTime(log.sentAt) : '—'],
                ['Created', formatDateTime(log.createdAt)],
                ['Updated', formatDateTime(log.updatedAt)],
              ].map(([label, value]) => (
                <div key={label as string} className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
                  <dt className="text-xs text-ink-subtle">{label}</dt>
                  <dd className="min-w-0 break-words text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          {log.lastError ? (
            <section aria-label="Error">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Last error</h3>
              <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2.5 font-mono text-xs text-danger">{log.lastError}</p>
            </section>
          ) : null}
          {log.eventKey ? (
            <section aria-label="Idempotency">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Event key</h3>
              <p className="break-all rounded-lg border border-line bg-surface-2/40 px-3 py-2 font-mono text-xs text-ink-muted">{log.eventKey}</p>
            </section>
          ) : null}
          <p className="text-[11px] leading-snug text-ink-subtle">
            Status <code>simulated</code> means the backend recorded the email but intentionally did not send it (SMTP
            disabled or unconfigured). No credentials or provider configuration are exposed here.
          </p>
        </div>
      )}
    </Dialog>
  );
}
