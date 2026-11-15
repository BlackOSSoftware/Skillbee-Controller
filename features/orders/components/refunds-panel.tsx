'use client';

import { ExternalLink, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/cn';
import { hasPermissions } from '@/lib/roles';
import { REFUND_STATUSES, type Refund, type RefundListParams, type RefundStatus } from '@/types/commerce';
import { formatDateTime } from '@/features/assignments/display';
import { useUserNames } from '@/features/shared/lookups';
import { formatMoney, refundStatusLabel, RefundStatusBadge, shortId } from '../display';
import { useRefund, useRefundList } from '../hooks';
import { OrderDrawer } from './order-drawer';

const PAGE_SIZES = [10, 20, 50];

function RefundDetailDialog({ seed, learner, onClose, onOpenOrder }: { seed: Refund; learner?: string; onClose: () => void; onOpenOrder: (orderId: string) => void }) {
  const detail = useRefund(seed.id, seed);
  const r = detail.data ?? seed;
  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={`Refund ${formatMoney(r.amountPaise, r.currency)}`}
      description={r.providerRefundId ?? 'Awaiting gateway reference'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => onOpenOrder(r.orderId)}>
            <ExternalLink className="size-4" aria-hidden />
            Open order
          </Button>
        </>
      }
    >
      {detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <RefundStatusBadge status={r.status} />
            {r.status === 'initiated' ? <span className="text-xs text-ink-muted">Waiting for the payment gateway to confirm.</span> : null}
          </div>
          <dl className="divide-y divide-line rounded-lg border border-line text-sm">
            {[
              ['Amount', formatMoney(r.amountPaise, r.currency)],
              ['Learner', learner ?? `User ${r.studentId.slice(-6)}`],
              ['Order', <span key="o" className="font-mono text-xs">{r.orderId}</span>],
              ['Gateway refund', <span key="g" className="font-mono text-xs">{r.providerRefundId ?? '—'}</span>],
              ['Reason', r.reason || '—'],
              ['Enrollment', r.revokeEnrollment ? (r.enrollmentRevoked ? 'Revoked' : 'Will be revoked when processed') : 'Kept'],
              ['Initiated', formatDateTime(r.createdAt)],
              ['Processed', r.processedAt ? formatDateTime(r.processedAt) : '—'],
            ].map(([k, v]) => (
              <div key={String(k)} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-2">
                <dt className="text-xs text-ink-subtle">{k}</dt>
                <dd className="min-w-0 break-words text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Dialog>
  );
}

export function RefundsPanel() {
  const { user } = useAuth();
  const canReadUsers = hasPermissions(user, ['users:read']);
  const [status, setStatus] = useState<RefundStatus | ''>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [viewing, setViewing] = useState<Refund | null>(null);
  const [order, setOrder] = useState<string | null>(null);
  const params: RefundListParams = { page, limit, status: status || undefined };
  const list = useRefundList(params);
  const rows = list.data?.refunds ?? [];
  const names = useUserNames(rows.map((r) => r.studentId), canReadUsers);

  return (
    <>
      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Refunds</h2>
            <p className="text-xs text-ink-muted">Refunds start as Processing and update when the gateway confirms them.</p>
          </div>
          <div className="flex gap-2">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as RefundStatus | '');
                setPage(1);
              }}
              className="sm:w-44"
              aria-label="Filter by refund status"
            >
              <option value="">All statuses</option>
              {REFUND_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {refundStatusLabel(s)}
                </option>
              ))}
            </Select>
            {status ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setStatus('');
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
          <EmptyState icon={<RotateCcw className="size-5" aria-hidden />} title={status ? 'No refunds with this status' : 'No refunds yet'} description="Refunds are started from an order’s detail panel." />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Refund</th>
                    <th scope="col" className="px-3 py-2.5">Learner</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Reason</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="px-3 py-2.5">Initiated</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5">
                      <span className="sr-only">Order</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3.5 pl-5 pr-3">
                            <Skeleton className="h-4 w-24" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-4 w-32" />
                          </td>
                          <td className="hidden px-3 py-3.5 lg:table-cell">
                            <Skeleton className="h-4 w-40" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-5 w-20" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-4 w-24" />
                          </td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((r) => (
                        <tr key={r.id} className="group transition-colors hover:bg-surface-2/50">
                          <td className="whitespace-nowrap py-3.5 pl-5 pr-3">
                            <button type="button" onClick={() => setViewing(r)} className="text-left">
                              <span className="block font-medium tabular-nums text-ink group-hover:text-primary">{formatMoney(r.amountPaise, r.currency)}</span>
                              <span className="block font-mono text-[11px] text-ink-subtle">{shortId(r.providerRefundId, 14)}</span>
                            </button>
                          </td>
                          <td className="max-w-0 px-3 py-3.5 lg:w-1/5">
                            <span className="block truncate text-ink">{names.get(r.studentId)?.name ?? `User ${r.studentId.slice(-6)}`}</span>
                            {names.get(r.studentId)?.email ? <span className="block truncate text-xs text-ink-muted">{names.get(r.studentId)?.email}</span> : null}
                          </td>
                          <td className="hidden max-w-0 px-3 py-3.5 text-ink-muted lg:table-cell lg:w-1/4">
                            <span className="block truncate">{r.reason || '—'}</span>
                          </td>
                          <td className="w-px px-3 py-3.5">
                            <RefundStatusBadge status={r.status} />
                          </td>
                          <td className="w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted">{formatDateTime(r.createdAt)}</td>
                          <td className="w-px whitespace-nowrap py-3.5 pl-3 pr-5 text-right">
                            <Button size="sm" variant="ghost" onClick={() => setOrder(r.orderId)}>
                              Order
                              <ExternalLink className="size-3.5" aria-hidden />
                            </Button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            <ul className={cn('divide-y divide-line md:hidden', list.isPlaceholderData && 'opacity-60')}>
              {rows.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setViewing(r)} className="block w-full space-y-1.5 p-4 text-left">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium tabular-nums text-ink">{formatMoney(r.amountPaise, r.currency)}</span>
                      <RefundStatusBadge status={r.status} />
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {names.get(r.studentId)?.name ?? `User ${r.studentId.slice(-6)}`} · {formatDateTime(r.createdAt)}
                    </span>
                  </button>
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

      {viewing ? (
        <RefundDetailDialog
          key={viewing.id}
          seed={viewing}
          learner={names.get(viewing.studentId)?.name}
          onClose={() => setViewing(null)}
          onOpenOrder={(id) => {
            setViewing(null);
            setOrder(id);
          }}
        />
      ) : null}
      {order ? <OrderDrawer key={order} seed={{ id: order }} onClose={() => setOrder(null)} onOpen={setOrder} /> : null}
    </>
  );
}
