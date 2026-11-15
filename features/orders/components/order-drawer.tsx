'use client';

import { BadgeCheck, Download, FileText, RotateCcw, ShieldCheck, ShieldOff, SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { hasPermissions } from '@/lib/roles';
import { useToast } from '@/providers/toast-provider';
import type { Order } from '@/types/commerce';
import { formatDateTime } from '@/features/assignments/display';
import { useUserNames } from '@/features/shared/lookups';
import { formatMoney, GATEWAY_LABEL, GatewayPaymentBadge, historyLabel, orderGatewayLabel, orderStatusLabel, OrderStatusBadge, paymentStatusLabel, PaymentStatusBadge, RefundStatusBadge } from '../display';
import { useDownloadInvoice, useOrder, useOrderHistory, useOrderPayments, useOrderRefunds, useStudentOrders } from '../hooks';
import { OrderStatusDialog } from './order-status-dialog';
import { RefundDialog, refundableOf } from './refund-dialog';

type Tab = 'details' | 'payments' | 'history';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-3 py-2">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs text-ink">{children}</span>;
}

function HistoryTab({ orderId, canReadUsers }: { orderId: string; canReadUsers: boolean }) {
  const history = useOrderHistory(orderId, true);
  const events = [...(history.data?.history ?? [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const names = useUserNames(events.map((e) => e.actorId), canReadUsers);
  if (history.isError) return <ErrorState error={history.error} onRetry={() => history.refetch()} compact />;
  if (history.isPending)
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        ))}
      </div>
    );
  if (!events.length) return <p className="py-6 text-center text-sm text-ink-subtle">No history recorded.</p>;
  return (
    <ol className="relative space-y-5 border-l border-line pl-5">
      {events.map((e, i) => {
        const amount = typeof e.meta?.amountPaise === 'number' ? e.meta.amountPaise : null;
        return (
          <li key={e._id ?? i} className="relative">
            <span
              className={cn(
                'absolute -left-[26px] top-1 size-2.5 rounded-full ring-4 ring-surface',
                /fail/.test(e.action) ? 'bg-danger' : /refund/.test(e.action) ? 'bg-accent' : e.source === 'admin' ? 'bg-warning' : 'bg-success'
              )}
              aria-hidden
            />
            <p className="text-sm font-medium text-ink">{historyLabel(e.action)}</p>
            <p className="text-xs text-ink-muted">
              {formatDateTime(e.at)} · {e.actorId ? (names.get(e.actorId)?.name ?? `User ${e.actorId.slice(-6)}`) : e.source === 'webhook' ? 'Payment gateway' : 'System'}
            </p>
            {e.fromStatus || e.toStatus ? (
              <p className="mt-1 text-xs text-ink-muted">
                Order: {e.fromStatus ? orderStatusLabel(e.fromStatus as Order['orderStatus']) : '—'} → {e.toStatus ? orderStatusLabel(e.toStatus as Order['orderStatus']) : '—'}
              </p>
            ) : null}
            {e.toPaymentStatus ? (
              <p className="text-xs text-ink-muted">
                Payment: {e.fromPaymentStatus ? paymentStatusLabel(e.fromPaymentStatus as Order['paymentStatus']) : '—'} → {paymentStatusLabel(e.toPaymentStatus as Order['paymentStatus'])}
              </p>
            ) : null}
            {amount !== null ? <p className="text-xs text-ink-muted">Amount {formatMoney(amount, null)}</p> : null}
            {e.reason ? <p className="mt-1 text-sm text-ink-muted">“{e.reason}”</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

interface OrderDrawerProps {
  seed: Pick<Order, 'id'> & Partial<Order>;
  onClose: () => void;
  onOpen: (id: string) => void;
}

export function OrderDrawer({ seed, onClose, onOpen }: OrderDrawerProps) {
  const { user } = useAuth();
  const toast = useToast();
  const canReadUsers = hasPermissions(user, ['users:read']);
  const detail = useOrder(seed.id, seed.orderNumber ? (seed as Order) : undefined);
  const payments = useOrderPayments(seed.id);
  const refunds = useOrderRefunds(seed.id);
  const o = detail.data;
  const others = useStudentOrders(o?.studentId ?? null);
  const invoice = useDownloadInvoice();
  const [tab, setTab] = useState<Tab>('details');
  const [dialog, setDialog] = useState<'status' | 'refund' | null>(null);
  const refundInfo = refundableOf(payments.data ?? [], refunds.data?.refunds ?? []);
  const canRefund = Boolean(o && (o.paymentStatus === 'captured' || o.paymentStatus === 'partially_refunded') && refundInfo && refundInfo.available > 0);
  /** Refund statuses are set by settled refunds; a manual change would misstate where the money is. */
  const canChangeStatus = Boolean(o && o.orderStatus !== 'refunded' && o.orderStatus !== 'partially_refunded');
  const otherOrders = (others.data?.orders ?? []).filter((x) => x.id !== seed.id);

  function downloadInvoice() {
    if (!o) return;
    invoice.mutate(o, {
      onError: (e) => {
        const { code, message } = normalizeApiError(e);
        toast.error('Invoice unavailable', code === 'INVOICE_NOT_FOUND' ? 'An invoice is generated once the payment is captured.' : message);
      },
    });
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        placement="right"
        title={o?.orderNumber ?? 'Order'}
        description={o ? `${o.billing?.fullName || o.billing?.email || 'Learner'} · ${formatDateTime(o.createdAt)}` : undefined}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="Order sections" className="flex gap-1">
              {(
                [
                  ['details', 'Details'],
                  ['payments', 'Payments & refunds'],
                  ['history', 'History'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', tab === id ? 'bg-primary/10 text-primary' : 'text-ink-muted hover:bg-surface-2 hover:text-ink')}
                >
                  {label}
                </button>
              ))}
            </div>
            {o ? (
              <span className="flex items-center gap-1.5">
                <OrderStatusBadge status={o.orderStatus} />
                <PaymentStatusBadge status={o.paymentStatus} />
              </span>
            ) : null}
          </div>
        }
        footer={
          o ? (
            <>
              {canChangeStatus ? (
                <Button size="sm" variant="secondary" className="mr-auto" onClick={() => setDialog('status')}>
                  <SlidersHorizontal className="size-3.5" aria-hidden />
                  Change status
                </Button>
              ) : null}
              {canRefund ? (
                <Button size="sm" variant="danger" onClick={() => setDialog('refund')}>
                  <RotateCcw className="size-3.5" aria-hidden />
                  Refund
                </Button>
              ) : null}
              <Button size="sm" onClick={downloadInvoice} loading={invoice.isPending} disabled={!o.invoiceNumber && !o.invoiceFileName}>
                <Download className="size-3.5" aria-hidden />
                Invoice
              </Button>
            </>
          ) : undefined
        }
      >
        {detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        ) : !o ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : tab === 'history' ? (
          <HistoryTab orderId={o.id} canReadUsers={canReadUsers} />
        ) : tab === 'payments' ? (
          <div className="space-y-5">
            {refundInfo ? (
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line text-sm [&>div]:bg-surface [&>div]:px-3 [&>div]:py-2">
                <div>
                  <dt className="text-[11px] text-ink-subtle">Captured</dt>
                  <dd className="font-medium tabular-nums text-ink">{formatMoney(refundInfo.payment.amountPaise, refundInfo.payment.currency)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-ink-subtle">Refunded</dt>
                  <dd className="font-medium tabular-nums text-ink">{formatMoney(refundInfo.payment.refundedPaise, refundInfo.payment.currency)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-ink-subtle">Refundable</dt>
                  <dd className="font-semibold tabular-nums text-success">{formatMoney(refundInfo.available, refundInfo.payment.currency)}</dd>
                </div>
              </dl>
            ) : null}

            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Gateway transactions</h3>
              {payments.isError ? (
                <ErrorState error={payments.error} onRetry={() => payments.refetch()} compact />
              ) : payments.isPending ? (
                <Skeleton className="h-24 w-full" />
              ) : !payments.data?.length ? (
                <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-ink-subtle">No payment was started for this order.</p>
              ) : (
                <ul className="space-y-2">
                  {payments.data.map((p) => (
                    <li key={p.id} className="rounded-lg border border-line p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-ink">
                          {GATEWAY_LABEL[p.provider]} · {formatMoney(p.amountPaise, p.currency)}
                        </span>
                        <GatewayPaymentBadge status={p.paymentStatus} />
                      </div>
                      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                        <div className="flex justify-between gap-2">
                          <dt className="text-ink-subtle">Gateway order</dt>
                          <dd><Mono>{p.providerOrderId ?? '—'}</Mono></dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-ink-subtle">Payment id</dt>
                          <dd><Mono>{p.providerPaymentId ?? '—'}</Mono></dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-ink-subtle">Method</dt>
                          <dd className="text-ink">{p.paymentMethod ?? '—'}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-ink-subtle">Captured</dt>
                          <dd className="text-ink">{p.capturedAt ? formatDateTime(p.capturedAt) : '—'}</dd>
                        </div>
                      </dl>
                      <p className="mt-2 flex flex-wrap gap-3 text-[11px]">
                        <span className={cn('inline-flex items-center gap-1', p.signatureVerified ? 'text-success' : 'text-ink-subtle')}>
                          {p.signatureVerified ? <ShieldCheck className="size-3.5" aria-hidden /> : <ShieldOff className="size-3.5" aria-hidden />}
                          Checkout signature {p.signatureVerified ? 'verified' : 'not verified'}
                        </span>
                        <span className={cn('inline-flex items-center gap-1', p.webhookVerified ? 'text-success' : 'text-ink-subtle')}>
                          {p.webhookVerified ? <BadgeCheck className="size-3.5" aria-hidden /> : <ShieldOff className="size-3.5" aria-hidden />}
                          Webhook {p.webhookVerified ? 'confirmed' : 'not received'}
                        </span>
                      </p>
                      {p.failureDescription ? <p className="mt-1 text-xs text-danger">{p.failureCode ? `${p.failureCode}: ` : ''}{p.failureDescription}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Refunds</h3>
              {refunds.isError ? (
                <ErrorState error={refunds.error} onRetry={() => refunds.refetch()} compact />
              ) : refunds.isPending ? (
                <Skeleton className="h-16 w-full" />
              ) : !refunds.data?.refunds.length ? (
                <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-ink-subtle">No refunds on this order.</p>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {refunds.data.refunds.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium tabular-nums text-ink">{formatMoney(r.amountPaise, r.currency)}</p>
                        <p className="truncate text-xs text-ink-muted">{r.reason || 'No reason given'}</p>
                        <p className="text-[11px] text-ink-subtle">
                          {formatDateTime(r.createdAt)}
                          {r.providerRefundId ? ` · ${r.providerRefundId}` : ''}
                          {r.revokeEnrollment ? (r.enrollmentRevoked ? ' · enrollment revoked' : ' · revokes enrollment') : ''}
                        </p>
                      </div>
                      <RefundStatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-line bg-surface-2/50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Total</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-ink">{formatMoney(o.totalPaise, o.currency)}</p>
              {o.paymentCurrency && o.paymentAmountMinor != null && o.paymentCurrency !== o.currency ? (
                <p className="mt-1 text-xs text-ink-muted">
                  Charged {formatMoney(o.paymentAmountMinor, o.paymentCurrency)}
                  {o.fxSnapshot ? ` at ${o.fxSnapshot.rate} (${o.fxSnapshot.source})` : ''}
                </p>
              ) : null}
            </div>

            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Items</h3>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {o.items.map((it) => (
                  <li key={it.courseId} className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{it.courseName}</p>
                      <p className="text-[11px] text-ink-subtle">
                        {it.salePrice != null && it.salePrice < it.regularPrice ? (
                          <>
                            <span className="line-through">{formatMoney(Math.round(it.regularPrice * 100), it.currency)}</span> · sale price
                          </>
                        ) : (
                          'Regular price'
                        )}
                        {it.discountPaise ? ` · −${formatMoney(it.discountPaise, it.currency)} discount` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-ink">{formatMoney(it.itemTotalPaise, it.currency)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-2 space-y-1 px-3 text-sm">
                <div className="flex justify-between text-ink-muted">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">{formatMoney(o.subtotalPaise, o.currency)}</dd>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <dt>Discount{o.couponSnapshot?.code ? ` (${o.couponSnapshot.code})` : ''}</dt>
                  <dd className="tabular-nums">−{formatMoney(o.discountPaise, o.currency)}</dd>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <dt>Tax</dt>
                  <dd className="tabular-nums">{formatMoney(o.taxPaise, o.currency)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-1 font-semibold text-ink">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatMoney(o.totalPaise, o.currency)}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Customer</h3>
              <dl className="divide-y divide-line rounded-lg border border-line">
                <Row label="Name">{o.billing?.fullName || '—'}</Row>
                <Row label="Email">{o.billing?.email || '—'}</Row>
                {o.billing?.phone ? <Row label="Phone">{o.billing.phone}</Row> : null}
                {o.billing?.addressLine1 || o.billing?.city ? (
                  <Row label="Address">{[o.billing.addressLine1, o.billing.addressLine2, o.billing.city, o.billing.state, o.billing.postalCode].filter(Boolean).join(', ')}</Row>
                ) : null}
                <Row label="Country">{o.billing?.country || '—'}</Row>
                {o.billing?.gstin ? <Row label="GSTIN">{o.billing.gstin}</Row> : null}
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Payment</h3>
              <dl className="divide-y divide-line rounded-lg border border-line">
                <Row label="Gateway">{orderGatewayLabel(o)}</Row>
                <Row label="Payment status">
                  <PaymentStatusBadge status={o.paymentStatus} />
                </Row>
                <Row label="Gateway order">
                  <Mono>{o.gatewayOrderId ?? '—'}</Mono>
                </Row>
                <Row label="Payment id">
                  <Mono>{o.gatewayPaymentId ?? '—'}</Mono>
                </Row>
                <Row label="Fulfillment">{o.fulfillmentStatus === 'fulfilled' ? 'Enrollment granted' : o.fulfillmentStatus}</Row>
                <Row label="Invoice">{o.invoiceNumber ?? 'Generated after payment'}</Row>
                {o.completedAt ? <Row label="Completed">{formatDateTime(o.completedAt)}</Row> : null}
                {o.cancelledAt ? <Row label="Cancelled">{formatDateTime(o.cancelledAt)}</Row> : null}
              </dl>
            </section>

            <section>
              <h3 className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                Other orders by this learner
                {others.data ? <span className="font-normal normal-case tracking-normal">{others.data.pagination.total} {others.data.pagination.total === 1 ? 'order' : 'orders'} in total</span> : null}
              </h3>
              {others.isPending ? (
                <Skeleton className="h-12 w-full" />
              ) : others.isError ? (
                <ErrorState error={others.error} onRetry={() => others.refetch()} compact />
              ) : !otherOrders.length ? (
                <p className="text-xs text-ink-subtle">No other orders.</p>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {otherOrders.slice(0, 5).map((x) => (
                    <li key={x.id}>
                      <button type="button" onClick={() => onOpen(x.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-2/60">
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                            <FileText className="size-3.5 text-ink-subtle" aria-hidden />
                            {x.orderNumber}
                          </span>
                          <span className="block truncate text-[11px] text-ink-subtle">
                            {formatDate(x.createdAt)} · {x.items.map((i) => i.courseName).join(', ')}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs tabular-nums text-ink">{formatMoney(x.totalPaise, x.currency)}</span>
                          <OrderStatusBadge status={x.orderStatus} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Dialog>

      {dialog === 'status' && o ? <OrderStatusDialog order={o} onClose={() => setDialog(null)} /> : null}
      {dialog === 'refund' && o ? <RefundDialog order={o} payments={payments.data ?? []} refunds={refunds.data?.refunds ?? []} onClose={() => setDialog(null)} /> : null}
    </>
  );
}
