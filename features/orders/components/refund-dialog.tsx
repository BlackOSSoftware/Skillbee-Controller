'use client';

import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { useToast } from '@/providers/toast-provider';
import type { Order, Payment, Refund } from '@/types/commerce';
import { Toggle } from '@/features/courses/components/form-controls';
import { formatMoney, GATEWAY_LABEL } from '../display';
import { useCreateRefund } from '../hooks';

/** The refundable payment and what can still be refunded on it. */
export function refundableOf(payments: Payment[], refunds: Refund[]) {
  const payment = payments.find((p) => p.paymentStatus === 'captured' || p.paymentStatus === 'partially_refunded') ?? null;
  if (!payment) return null;
  const refundable = Math.max(0, payment.amountPaise - (payment.refundedPaise || 0));
  // Initiated refunds are not yet subtracted by the backend; holding them back avoids over-refunding.
  const pending = refunds.filter((r) => r.paymentId === payment.id && r.status === 'initiated').reduce((s, r) => s + r.amountPaise, 0);
  return { payment, refundable, pending, available: Math.max(0, refundable - pending) };
}

function toMinor(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  return Math.round(Number(value) * 100);
}

interface RefundDialogProps {
  order: Order;
  payments: Payment[];
  refunds: Refund[];
  onClose: () => void;
}

export function RefundDialog({ order, payments, refunds, onClose }: RefundDialogProps) {
  const toast = useToast();
  const create = useCreateRefund();
  const info = refundableOf(payments, refunds);
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [revoke, setRevoke] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** One key per dialog so a double submit cannot create two refunds. */
  const [idempotencyKey] = useState(() => `admin-refund:${order.id}:${crypto.randomUUID()}`);

  if (!info) {
    return (
      <Dialog open onClose={onClose} size="sm" title="Refund unavailable" description={order.orderNumber} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
        <p className="text-sm text-ink-muted">There is no captured payment on this order, so nothing can be refunded.</p>
      </Dialog>
    );
  }

  const currency = info.payment.currency;
  const partialMinor = toMinor(amount);
  const amountMinor = mode === 'full' ? info.available : partialMinor;
  const amountError =
    mode === 'partial' && amount.trim()
      ? partialMinor === null
        ? 'Enter an amount with up to two decimals.'
        : partialMinor <= 0
          ? 'Enter more than zero.'
          : partialMinor > info.available
            ? `At most ${formatMoney(info.available, currency)} can be refunded.`
            : null
      : null;
  const reasonTooLong = reason.trim().length > 2000;
  const valid = Boolean(amountMinor && amountMinor > 0 && amountMinor <= info.available) && !amountError && !reasonTooLong;

  function submit() {
    if (!valid || !amountMinor) return;
    create.mutate(
      { orderId: order.id, input: { amountPaise: amountMinor, ...(reason.trim() ? { reason: reason.trim() } : {}), revokeEnrollment: revoke, idempotencyKey } },
      {
        onSuccess: (r) => {
          if (r.status === 'processed') toast.success('Refund processed', `${formatMoney(r.amountPaise, r.currency)} returned to the learner.`);
          else if (r.status === 'failed') toast.error('Refund failed', 'The gateway rejected the refund.');
          else toast.success('Refund initiated', `${formatMoney(r.amountPaise, r.currency)} is being processed by ${GATEWAY_LABEL[info!.payment.provider]}. The final status arrives from the gateway.`);
          onClose();
        },
        onError: (e) => {
          toast.error('Could not start refund', normalizeApiError(e).message);
          setConfirming(false);
        },
      }
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={create.isPending}
      size="sm"
      title={confirming ? 'Confirm refund' : 'Refund payment'}
      description={`${order.orderNumber} · ${GATEWAY_LABEL[info.payment.provider]}`}
      footer={
        confirming ? (
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={create.isPending}>
              Back
            </Button>
            <Button variant="danger-solid" onClick={submit} loading={create.isPending}>
              Refund {formatMoney(amountMinor, currency)}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => setConfirming(true)} disabled={!valid || info.available <= 0}>
              Review refund
            </Button>
          </>
        )
      }
    >
      {confirming ? (
        <div className="space-y-3 text-sm">
          <dl className="divide-y divide-line rounded-lg border border-line">
            {[
              ['Amount', formatMoney(amountMinor, currency)],
              ['Type', mode === 'full' ? 'Full remaining balance' : 'Partial refund'],
              ['Gateway', `${GATEWAY_LABEL[info.payment.provider]} · ${info.payment.providerPaymentId ?? '—'}`],
              ['Enrollment', revoke ? 'Revoked when the refund completes' : 'Kept'],
              ['Reason', reason.trim() || '—'],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 px-3 py-2">
                <dt className="text-xs text-ink-subtle">{k}</dt>
                <dd className="min-w-0 break-words text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="flex gap-2 text-xs text-ink-muted">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
            Money is returned through the payment gateway and cannot be undone here. The refund shows as Processing until the gateway confirms it.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line text-sm [&>div]:bg-surface [&>div]:px-3 [&>div]:py-2">
            <div>
              <dt className="text-[11px] text-ink-subtle">Paid</dt>
              <dd className="font-medium tabular-nums text-ink">{formatMoney(info.payment.amountPaise, currency)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-ink-subtle">Refunded</dt>
              <dd className="font-medium tabular-nums text-ink">{formatMoney(info.payment.refundedPaise, currency)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-ink-subtle">Available</dt>
              <dd className="font-semibold tabular-nums text-success">{formatMoney(info.available, currency)}</dd>
            </div>
          </dl>
          {info.pending > 0 ? <p className="text-xs text-warning">{formatMoney(info.pending, currency)} is already being refunded and is held back until the gateway confirms it.</p> : null}

          {info.available > 0 ? (
            <>
              <div role="radiogroup" aria-label="Refund type" className="grid grid-cols-2 gap-2">
                {(['full', 'partial'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => setMode(m)}
                    className={cn('rounded-lg border px-3 py-2 text-left text-sm transition-colors', mode === m ? 'border-primary bg-primary/[0.06] text-ink' : 'border-line text-ink-muted hover:border-field-border-hover')}
                  >
                    <span className="block font-medium">{m === 'full' ? 'Full refund' : 'Partial refund'}</span>
                    <span className="block text-[11px] text-ink-subtle">{m === 'full' ? formatMoney(info.available, currency) : 'Choose an amount'}</span>
                  </button>
                ))}
              </div>
              {mode === 'partial' ? (
                <Field id="rf-amount" label={`Amount (${currency})`} required error={amountError ?? undefined} hint={`Up to ${formatMoney(info.available, currency)}`}>
                  <Input id="rf-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-invalid={Boolean(amountError)} aria-describedby="rf-amount-msg" />
                </Field>
              ) : null}
              <Field id="rf-reason" label="Reason" hint="Optional · stored with the refund and sent to the gateway as a note" error={reasonTooLong ? '2,000 characters or less.' : undefined}>
                <Textarea id="rf-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby="rf-reason-msg" />
              </Field>
              <div className="rounded-lg border border-line px-3 py-2">
                <Toggle id="rf-revoke" label="Revoke course access" description="Revokes the learner’s enrollment once the refund is processed" checked={revoke} onChange={setRevoke} />
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Nothing is left to refund on this payment.</p>
          )}
        </div>
      )}
    </Dialog>
  );
}
