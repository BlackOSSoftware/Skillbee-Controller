'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { Order, OrderStatus } from '@/types/commerce';
import { orderStatusLabel, OrderStatusBadge } from '../display';
import { useUpdateOrderStatus } from '../hooks';

/**
 * Statuses an admin may set. `completed` comes only from a verified payment capture (the backend
 * refuses it), and refund statuses are written by the refund flow.
 */
const MANUAL_STATUSES: OrderStatus[] = ['pending', 'processing', 'cancelled', 'failed'];

const CONSEQUENCE: Partial<Record<OrderStatus, string>> = {
  cancelled: 'Any reserved coupon use is released. Payments already captured are not refunded automatically.',
  failed: 'Any reserved coupon use is marked failed.',
  processing: 'Use this while a payment or manual review is in progress.',
  pending: 'Returns the order to awaiting payment.',
};

export function OrderStatusDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const toast = useToast();
  const update = useUpdateOrderStatus();
  const options = MANUAL_STATUSES.filter((s) => s !== order.orderStatus);
  const [status, setStatus] = useState<OrderStatus>(options[0]);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const tooLong = reason.trim().length > 2000;
  const paid = order.paymentStatus === 'captured' || order.paymentStatus === 'partially_refunded';

  function submit() {
    update.mutate(
      { id: order.id, input: { status, ...(reason.trim() ? { reason: reason.trim() } : {}) } },
      {
        onSuccess: (o) => {
          toast.success('Order status updated', `${o.orderNumber} is now ${orderStatusLabel(o.orderStatus).toLowerCase()}.`);
          onClose();
        },
        onError: (e) => {
          toast.error('Could not update status', normalizeApiError(e).message);
          setConfirming(false);
        },
      }
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={update.isPending}
      size="sm"
      title={confirming ? 'Confirm status change' : 'Change order status'}
      description={order.orderNumber}
      footer={
        confirming ? (
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={update.isPending}>
              Back
            </Button>
            <Button variant={status === 'cancelled' || status === 'failed' ? 'danger-solid' : 'primary'} onClick={submit} loading={update.isPending}>
              Set to {orderStatusLabel(status)}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => setConfirming(true)} disabled={tooLong || !options.length}>
              Continue
            </Button>
          </>
        )
      }
    >
      {confirming ? (
        <div className="space-y-3 text-sm">
          <p className="flex flex-wrap items-center gap-2 text-ink">
            <OrderStatusBadge status={order.orderStatus} />
            <span className="text-ink-subtle">→</span>
            <OrderStatusBadge status={status} />
          </p>
          {CONSEQUENCE[status] ? <p className="text-ink-muted">{CONSEQUENCE[status]}</p> : null}
          {paid && (status === 'cancelled' || status === 'failed') ? (
            <p className="rounded-lg border border-warning/30 bg-warning/[0.06] px-3 py-2 text-xs text-ink-muted">
              This order has a captured payment. To return money, issue a refund instead; changing the status alone does not refund the learner.
            </p>
          ) : null}
          {reason.trim() ? <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted">“{reason.trim()}”</p> : null}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            Current status <OrderStatusBadge status={order.orderStatus} />
          </p>
          <Field id="os-status" label="New status" required>
            <Select id="os-status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
              {options.map((s) => (
                <option key={s} value={s}>
                  {orderStatusLabel(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="os-reason" label="Reason" hint="Optional · recorded in the order history" error={tooLong ? '2,000 characters or less.' : undefined}>
            <Textarea id="os-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby="os-reason-msg" />
          </Field>
          <p className="flex gap-2 rounded-lg border border-info/25 bg-info/[0.06] px-3 py-2 text-xs leading-relaxed text-ink-muted">
            <Info className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden />
            Orders become Completed automatically once the payment gateway confirms the payment. Refunded statuses are set by refunds.
          </p>
        </div>
      )}
    </Dialog>
  );
}
