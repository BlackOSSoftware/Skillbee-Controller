'use client';

import { Download, Eye, Receipt, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { ActionMenu } from '@/components/ui/menu';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { hasPermissions } from '@/lib/roles';
import { useToast } from '@/providers/toast-provider';
import { ORDER_STATUSES, PAYMENT_STATUSES, type Order, type OrderListParams, type OrderStatus, type PaymentStatus } from '@/types/commerce';
import { LearnerFilter, type LearnerOption } from '@/features/shared/learner-filter';
import { useCourseCatalog } from '@/features/shared/lookups';
import { formatMoney, orderGatewayLabel, orderStatusLabel, OrderStatusBadge, paymentStatusLabel, PaymentStatusBadge } from '../display';
import { orderListScope, useDownloadInvoice, useOrderList } from '../hooks';
import { OrderDrawer } from './order-drawer';

const PAGE_SIZES = [10, 20, 50];

export interface OrderPreset {
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
}

export function OrdersPanel({ preset }: { preset?: OrderPreset }) {
  const { user } = useAuth();
  const toast = useToast();
  const canReadUsers = hasPermissions(user, ['users:read']);
  const [search, setSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState<OrderStatus | ''>(preset?.orderStatus ?? '');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | ''>(preset?.paymentStatus ?? '');
  const [courseId, setCourseId] = useState('');
  const [learner, setLearner] = useState<LearnerOption | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [open, setOpen] = useState<(Pick<Order, 'id'> & Partial<Order>) | null>(null);
  const debounced = useDebouncedValue(search.trim(), 400);
  const catalog = useCourseCatalog();
  const invoice = useDownloadInvoice();

  const params: OrderListParams = {
    page,
    limit,
    search: debounced || undefined,
    orderStatus: orderStatus || undefined,
    paymentStatus: paymentStatus || undefined,
    courseId: courseId || undefined,
    studentId: learner?.id,
    // Inclusive day range in the viewer's timezone.
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
  };
  const list = useOrderList(params);
  const scope = orderListScope(params);
  const rows = list.data?.orders ?? [];
  const filtered = Boolean(debounced || orderStatus || paymentStatus || courseId || learner || from || to);
  const dateError = from && to && from > to ? 'Start date is after end date.' : null;
  const courseTitle = catalog.courses.find((c) => c.id === courseId)?.title;

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function clearAll() {
    setSearch('');
    setOrderStatus('');
    setPaymentStatus('');
    setCourseId('');
    setLearner(null);
    setFrom('');
    setTo('');
    setPage(1);
  }

  function downloadInvoice(o: Order) {
    invoice.mutate(o, {
      onError: (e) => {
        const { code, message } = normalizeApiError(e);
        toast.error('Invoice unavailable', code === 'INVOICE_NOT_FOUND' ? 'An invoice is generated once the payment is captured.' : message);
      },
    });
  }

  const actionsFor = (o: Order) => [
    { key: 'view', label: 'View order', icon: <Eye className="size-4" />, onSelect: () => setOpen(o) },
    { key: 'invoice', label: 'Download invoice', icon: <Download className="size-4" />, disabled: invoice.isPending || (!o.invoiceNumber && !o.invoiceFileName), onSelect: () => downloadInvoice(o) },
  ];

  return (
    <>
      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">
                {scope === 'course' ? `Course orders · ${courseTitle ?? 'selected course'}` : scope === 'student' ? `Learner orders · ${learner?.name}` : 'All orders'}
              </h2>
              <p className="text-xs text-ink-muted">Course purchases with payment, refund and fulfillment status.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
            <div className="relative min-w-0 lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input type="search" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} placeholder="Order number, learner name or email" className="pl-9" aria-label="Search orders" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Select value={orderStatus} onChange={(e) => resetPage(setOrderStatus)(e.target.value as OrderStatus | '')} className="sm:w-40" aria-label="Filter by order status">
                <option value="">Any status</option>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {orderStatusLabel(s)}
                  </option>
                ))}
              </Select>
              <Select value={paymentStatus} onChange={(e) => resetPage(setPaymentStatus)(e.target.value as PaymentStatus | '')} className="sm:w-40" aria-label="Filter by payment status">
                <option value="">Any payment</option>
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {paymentStatusLabel(s)}
                  </option>
                ))}
              </Select>
              <Select value={courseId} onChange={(e) => resetPage(setCourseId)(e.target.value)} className="col-span-2 min-w-0 sm:w-56" aria-label="Filter by course" disabled={catalog.query.isPending || catalog.query.isError}>
                <option value="">{catalog.query.isError ? 'Courses unavailable' : 'All courses'}</option>
                {catalog.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
              {canReadUsers ? (
                <div className="col-span-2">
                  <LearnerFilter value={learner} onChange={resetPage(setLearner)} />
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                From
                <Input type="date" value={from} max={to || undefined} onChange={(e) => resetPage(setFrom)(e.target.value)} className="w-40" aria-label="Orders from date" />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                To
                <Input type="date" value={to} min={from || undefined} onChange={(e) => resetPage(setTo)(e.target.value)} className="w-40" aria-label="Orders to date" />
              </label>
              {filtered ? (
                <Button variant="ghost" onClick={clearAll}>
                  <X className="size-4" aria-hidden />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
          {dateError ? <p className="text-xs text-danger">{dateError}</p> : null}
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isPending && !rows.length ? (
          <EmptyState
            icon={<Receipt className="size-5" aria-hidden />}
            title={filtered ? 'No orders match these filters' : 'No orders yet'}
            description={filtered ? 'Try another search, status, course, learner or date range.' : 'Orders appear here when learners check out.'}
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Order</th>
                    <th scope="col" className="px-3 py-2.5">Learner</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Courses</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Amount</th>
                    <th scope="col" className="px-3 py-2.5">Payment</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3.5 pl-5 pr-3">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="mt-1.5 h-3 w-20" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-4 w-36" />
                          </td>
                          <td className="hidden px-3 py-3.5 lg:table-cell">
                            <Skeleton className="h-4 w-44" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="ml-auto h-4 w-16" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-5 w-16" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-5 w-20" />
                          </td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((o) => (
                        <tr key={o.id} className="group transition-colors hover:bg-surface-2/50">
                          <td className="whitespace-nowrap py-3.5 pl-5 pr-3">
                            <button type="button" onClick={() => setOpen(o)} className="text-left">
                              <span className="block font-mono text-[13px] font-medium text-ink group-hover:text-primary">{o.orderNumber}</span>
                              <span className="block text-[11px] text-ink-subtle">{formatDate(o.createdAt)}</span>
                            </button>
                          </td>
                          <td className="max-w-0 px-3 py-3.5 lg:w-1/5">
                            <span className="block truncate text-ink">{o.billing?.fullName || '—'}</span>
                            <span className="block truncate text-xs text-ink-muted">{o.billing?.email}</span>
                          </td>
                          <td className="hidden max-w-0 px-3 py-3.5 lg:table-cell lg:w-1/4">
                            <span className="block truncate text-ink">{o.items[0]?.courseName ?? '—'}</span>
                            {o.items.length > 1 ? <span className="text-[11px] text-ink-subtle">+{o.items.length - 1} more</span> : null}
                          </td>
                          <td className="w-px whitespace-nowrap px-3 py-3.5 text-right font-medium tabular-nums text-ink">{formatMoney(o.totalPaise, o.currency)}</td>
                          <td className="w-px whitespace-nowrap px-3 py-3.5">
                            <PaymentStatusBadge status={o.paymentStatus} />
                            <span className="mt-0.5 block text-[11px] text-ink-subtle">{orderGatewayLabel(o)}</span>
                          </td>
                          <td className="w-px px-3 py-3.5">
                            <OrderStatusBadge status={o.orderStatus} />
                          </td>
                          <td className="w-px py-3.5 pl-3 pr-5 text-right">
                            <ActionMenu label={`Actions for ${o.orderNumber}`} items={actionsFor(o)} />
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
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-52" />
                    </li>
                  ))
                : rows.map((o) => (
                    <li key={o.id} className="flex items-start gap-2 p-4">
                      <button type="button" onClick={() => setOpen(o)} className="block min-w-0 flex-1 space-y-1.5 text-left">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[13px] font-medium text-ink">{o.orderNumber}</span>
                          <span className="text-sm font-medium tabular-nums text-ink">{formatMoney(o.totalPaise, o.currency)}</span>
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                          {o.billing?.fullName || o.billing?.email} · {o.items[0]?.courseName}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <OrderStatusBadge status={o.orderStatus} />
                          <PaymentStatusBadge status={o.paymentStatus} />
                          <span className="text-[11px] text-ink-subtle">{formatDate(o.createdAt)}</span>
                        </span>
                      </button>
                      <ActionMenu label={`Actions for ${o.orderNumber}`} items={actionsFor(o)} />
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

      {open ? <OrderDrawer key={open.id} seed={open} onClose={() => setOpen(null)} onOpen={(id) => setOpen({ id })} /> : null}
    </>
  );
}
