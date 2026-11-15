'use client';

import { Archive, Copy, ExternalLink, History, Pause, Pencil, Play, TicketPercent } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { hasPermissions } from '@/lib/roles';
import { useToast } from '@/providers/toast-provider';
import { COUPON_USAGE_STATUSES, type Coupon, type CouponUsageParams, type CouponUsageStatus } from '@/types/coupons';
import { formatDateTime } from '@/features/assignments/display';
import { OrderStatusBadge, formatMoney } from '@/features/orders/display';
import { OrderDrawer } from '@/features/orders/components/order-drawer';
import { useCourseCatalog, useUserNames } from '@/features/shared/lookups';
import { CouponStateBadge, couponState, couponStateHint, discountLabel, formatMajor, usageLabel, usageStatusLabel, UsageStatusBadge } from '../display';
import { useCoupon, useCouponUsage, useDeactivateCoupon, useUpdateCoupon } from '../hooks';
import { CouponFormDialog } from './coupon-form-dialog';

type Tab = 'overview' | 'usage';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function UsageTab({ coupon }: { coupon: Coupon }) {
  const [status, setStatus] = useState<CouponUsageStatus | ''>('');
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<string | null>(null);
  const params: CouponUsageParams = { page, limit: 10, status: status || undefined };
  const usage = useCouponUsage(coupon.id, params, true);
  const rows = usage.data?.usages ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          Held uses belong to unpaid orders and are released if the order is cancelled or fails.
        </p>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as CouponUsageStatus | '');
            setPage(1);
          }}
          className="h-9 w-36 shrink-0"
          aria-label="Filter usage by status"
        >
          <option value="">All uses</option>
          {COUPON_USAGE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {usageStatusLabel(s)}
            </option>
          ))}
        </Select>
      </div>
      {usage.isError ? (
        <ErrorState error={usage.error} onRetry={() => usage.refetch()} />
      ) : usage.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !rows.length ? (
        <EmptyState icon={<History className="size-5" aria-hidden />} title={status ? 'No uses with this status' : 'Not used yet'} description="Each checkout that applies this coupon appears here." />
      ) : (
        <ul className={cn('divide-y divide-line rounded-lg border border-line', usage.isPlaceholderData && 'opacity-60')}>
          {rows.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{u.student ? `${u.student.firstName} ${u.student.lastName}`.trim() || u.student.email : 'Deleted learner'}</p>
                <p className="truncate text-xs text-ink-muted">
                  {u.student?.email ?? '—'} · {formatDateTime(u.appliedAt)}
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums text-ink">−{formatMoney(u.discountAmountPaise, u.currency)}</span>
              <UsageStatusBadge status={u.status} />
              <button
                type="button"
                onClick={() => setOrder(u.order.id)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-mono text-xs text-primary hover:bg-primary/10"
                aria-label={`Open order ${u.order.orderNumber ?? u.order.id}`}
              >
                {u.order.orderNumber ?? `Order ${u.order.id.slice(-6)}`}
                <ExternalLink className="size-3" aria-hidden />
              </button>
              {u.order.orderStatus ? <OrderStatusBadge status={u.order.orderStatus} /> : null}
            </li>
          ))}
        </ul>
      )}
      <Pagination meta={usage.data?.pagination} onPageChange={setPage} disabled={usage.isFetching} />
      {order ? <OrderDrawer key={order} seed={{ id: order }} onClose={() => setOrder(null)} onOpen={setOrder} /> : null}
    </div>
  );
}

export function CouponDrawer({ seed, onClose }: { seed: Coupon; onClose: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const detail = useCoupon(seed.id, seed);
  const c = detail.data ?? seed;
  const { courses } = useCourseCatalog();
  const names = useUserNames([c.createdBy, c.updatedBy], hasPermissions(user, ['users:read']));
  const update = useUpdateCoupon();
  const [tab, setTab] = useState<Tab>('overview');
  const [dialog, setDialog] = useState<'edit' | 'archive' | null>(null);
  const state = couponState(c);
  const titleOf = new Map(courses.map((x) => [x.id, x.title]));
  const remaining = c.usageLimit != null ? Math.max(0, c.usageLimit - c.usedCount - c.reservedCount) : null;

  function toggleActive() {
    update.mutate(
      { id: c.id, input: { isActive: !c.isActive } },
      {
        onSuccess: (x) => toast.success(x.isActive ? 'Coupon resumed' : 'Coupon paused', x.isActive ? `${x.code} can be applied again.` : `${x.code} can no longer be applied.`),
        onError: (e) => toast.error('Could not update coupon', normalizeApiError(e).message),
      }
    );
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        placement="right"
        size="lg"
        title={c.code}
        description={c.description || discountLabel(c)}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="Coupon sections" className="flex gap-1">
              {(
                [
                  ['overview', 'Overview'],
                  ['usage', `Usage history`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn('rounded-md px-2.5 py-1.5 text-sm transition-colors', tab === id ? 'bg-primary/10 font-medium text-primary' : 'text-ink-muted hover:bg-surface-2 hover:text-ink')}
                >
                  {label}
                </button>
              ))}
            </div>
            <CouponStateBadge coupon={c} />
          </div>
        }
        footer={
          <>
            <Button size="sm" variant="ghost" className="mr-auto text-danger hover:bg-danger/10" onClick={() => setDialog('archive')}>
              <Archive className="size-3.5" aria-hidden />
              Deactivate
            </Button>
            <Button size="sm" variant="secondary" onClick={toggleActive} loading={update.isPending}>
              {c.isActive ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
              {c.isActive ? 'Pause' : 'Resume'}
            </Button>
            <Button size="sm" onClick={() => setDialog('edit')}>
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Button>
          </>
        }
      >
        {detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
        ) : tab === 'usage' ? (
          <UsageTab coupon={c} />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-xl border border-line bg-surface-2/50 p-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <TicketPercent className="size-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-semibold tracking-tight text-ink">{discountLabel(c)}</p>
                <p className="text-xs text-ink-muted">{couponStateHint(state)}</p>
              </div>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(c.code).then(() => toast.success('Code copied', c.code))}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-field-border px-2.5 py-1.5 font-mono text-sm font-semibold tracking-wide text-ink hover:border-primary hover:text-primary"
                aria-label={`Copy code ${c.code}`}
              >
                {c.code}
                <Copy className="size-3.5" aria-hidden />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                ['Redeemed', String(c.usedCount)],
                ['Held', String(c.reservedCount)],
                ['Remaining', remaining == null ? 'Unlimited' : String(remaining)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-line px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{k}</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{v}</p>
                </div>
              ))}
            </div>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Rules</h3>
              <dl className="divide-y divide-line rounded-lg border border-line">
                <Row label="Discount">{c.discountType === 'percentage' ? `${c.discountValue}%` : formatMajor(c.discountValue, c.currency)}</Row>
                {c.discountType === 'percentage' ? <Row label="Maximum discount">{c.maximumDiscountAmount != null ? formatMajor(c.maximumDiscountAmount, c.currency) : 'No cap'}</Row> : null}
                <Row label="Minimum order">{c.minimumOrderAmount ? formatMajor(c.minimumOrderAmount, c.currency) : 'None'}</Row>
                <Row label="Applies to">
                  {c.applicability === 'all_courses' ? (
                    'All courses'
                  ) : (
                    <ul className="space-y-0.5">
                      {c.applicableCourses.map((id) => (
                        <li key={id} className="truncate">
                          {titleOf.get(id) ?? `Course ${id.slice(-6)}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </Row>
                <Row label="Total redemptions">{c.usageLimit != null ? `${usageLabel(c)} used` : `Unlimited · ${c.usedCount} used`}</Row>
                <Row label="Uses per learner">{c.perUserLimit}</Row>
                <Row label="Starts">{c.startDate ? formatDateTime(c.startDate) : 'Immediately'}</Row>
                <Row label="Expires">{c.expiryDate ? formatDateTime(c.expiryDate) : 'Never'}</Row>
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Record</h3>
              <dl className="divide-y divide-line rounded-lg border border-line">
                <Row label="Status">{c.isActive ? 'On' : 'Paused by an admin'}</Row>
                <Row label="Created">
                  {formatDateTime(c.createdAt)}
                  {c.createdBy && names.get(c.createdBy) ? ` · ${names.get(c.createdBy)?.name}` : ''}
                </Row>
                <Row label="Last updated">
                  {formatDateTime(c.updatedAt)}
                  {c.updatedBy && names.get(c.updatedBy) ? ` · ${names.get(c.updatedBy)?.name}` : ''}
                </Row>
              </dl>
            </section>
            {detail.isFetching && !detail.isPending ? <p className="text-[11px] text-ink-subtle">Refreshing…</p> : null}
          </div>
        )}
      </Dialog>

      {dialog === 'edit' ? <CouponFormDialog coupon={c} onClose={() => setDialog(null)} /> : null}
      {dialog === 'archive' ? <DeactivateCouponDialog coupon={c} onClose={() => setDialog(null)} onDone={onClose} /> : null}
    </>
  );
}

/** DELETE /admin/coupons/:id: soft-deactivation; the record and its usage history stay in the database. */
export function DeactivateCouponDialog({ coupon, onClose, onDone }: { coupon: Coupon; onClose: () => void; onDone?: () => void }) {
  const toast = useToast();
  const deactivate = useDeactivateCoupon();

  function confirm() {
    deactivate.mutate(coupon.id, {
      onSuccess: () => {
        toast.success('Coupon deactivated', `${coupon.code} was removed from the list. Its orders and usage records are kept.`);
        onClose();
        onDone?.();
      },
      onError: (e) => {
        toast.error('Could not deactivate coupon', normalizeApiError(e).message);
        onClose();
      },
    });
  }

  return (
    <ConfirmDialog
      open
      title={`Deactivate ${coupon.code}?`}
      tone="danger"
      confirmLabel="Deactivate coupon"
      loading={deactivate.isPending}
      onCancel={onClose}
      onConfirm={confirm}
      description={
        <div className="space-y-2">
          <p>The coupon stops working at checkout and is removed from this list. Nothing is erased: orders that used it keep their discount, invoices and usage records.</p>
          <p>This cannot be undone from the console. To stop it temporarily, use Pause instead.</p>
          {coupon.reservedCount > 0 ? (
            <p className="text-warning">
              {coupon.reservedCount} unpaid order{coupon.reservedCount === 1 ? ' is' : 's are'} holding this coupon; they keep their discount if they are paid.
            </p>
          ) : null}
        </div>
      }
    />
  );
}
