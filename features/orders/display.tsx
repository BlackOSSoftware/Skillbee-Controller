import { Ban, CircleCheck, CircleDashed, CircleDot, CircleX, Clock3, Loader, RotateCcw, Undo2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { GatewayPaymentStatus, OrderStatus, PaymentGatewayName, PaymentStatus, RefundStatus } from '@/types/commerce';

const pill = 'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset';
type Meta = { label: string; className: string; icon: typeof CircleCheck };

const tone = {
  success: 'bg-success/10 text-success ring-success/25',
  warning: 'bg-warning/10 text-warning ring-warning/25',
  danger: 'bg-danger/10 text-danger ring-danger/25',
  info: 'bg-info/10 text-info ring-info/25',
  neutral: 'bg-surface-2 text-ink-muted ring-line',
  accent: 'bg-accent/10 text-accent ring-accent/25',
};

const ORDER: Record<OrderStatus, Meta> = {
  pending: { label: 'Pending', className: tone.warning, icon: Clock3 },
  processing: { label: 'Processing', className: tone.info, icon: Loader },
  completed: { label: 'Completed', className: tone.success, icon: CircleCheck },
  cancelled: { label: 'Cancelled', className: tone.neutral, icon: Ban },
  failed: { label: 'Failed', className: tone.danger, icon: CircleX },
  refunded: { label: 'Refunded', className: tone.accent, icon: Undo2 },
  partially_refunded: { label: 'Partly refunded', className: tone.accent, icon: RotateCcw },
};

const PAYMENT: Record<PaymentStatus, Meta> = {
  pending: { label: 'Unpaid', className: tone.neutral, icon: CircleDashed },
  authorized: { label: 'Authorized', className: tone.info, icon: CircleDot },
  captured: { label: 'Paid', className: tone.success, icon: CircleCheck },
  failed: { label: 'Payment failed', className: tone.danger, icon: CircleX },
  partially_refunded: { label: 'Partly refunded', className: tone.accent, icon: RotateCcw },
  refunded: { label: 'Refunded', className: tone.accent, icon: Undo2 },
};

const GATEWAY_PAYMENT: Record<GatewayPaymentStatus, Meta> = {
  created: { label: 'Created', className: tone.neutral, icon: CircleDashed },
  authorized: PAYMENT.authorized,
  captured: { label: 'Captured', className: tone.success, icon: CircleCheck },
  failed: PAYMENT.failed,
  partially_refunded: PAYMENT.partially_refunded,
  refunded: PAYMENT.refunded,
};

const REFUND: Record<RefundStatus, Meta> = {
  initiated: { label: 'Processing', className: tone.warning, icon: Loader },
  processed: { label: 'Refunded', className: tone.success, icon: CircleCheck },
  failed: { label: 'Failed', className: tone.danger, icon: CircleX },
};

function Badge({ meta }: { meta: Meta }) {
  return (
    <span className={cn(pill, meta.className)}>
      <meta.icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  );
}

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => <Badge meta={ORDER[status] ?? { label: status, className: tone.neutral, icon: CircleDashed }} />;
export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => <Badge meta={PAYMENT[status] ?? { label: status, className: tone.neutral, icon: CircleDashed }} />;
export const GatewayPaymentBadge = ({ status }: { status: GatewayPaymentStatus }) => <Badge meta={GATEWAY_PAYMENT[status] ?? { label: status, className: tone.neutral, icon: CircleDashed }} />;
export const RefundStatusBadge = ({ status }: { status: RefundStatus }) => <Badge meta={REFUND[status] ?? { label: status, className: tone.neutral, icon: CircleDashed }} />;

export const orderStatusLabel = (s: OrderStatus) => ORDER[s]?.label ?? s;
export const paymentStatusLabel = (s: PaymentStatus) => PAYMENT[s]?.label ?? s;
export const refundStatusLabel = (s: RefundStatus) => REFUND[s]?.label ?? s;

export const GATEWAY_LABEL: Record<PaymentGatewayName, string> = { razorpay: 'Razorpay', paypal: 'PayPal', none: 'Not started' };

/** Free and 100%-coupon orders complete without a gateway. */
export const orderGatewayLabel = (o: { paymentGateway: PaymentGatewayName; totalPaise: number }) =>
  o.paymentGateway === 'none' && o.totalPaise === 0 ? 'No payment needed' : GATEWAY_LABEL[o.paymentGateway];

/** Amounts are integer minor units (paise / cents) of `currency`. */
export function formatMoney(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor == null) return '—';
  const code = (currency || 'INR').toUpperCase();
  try {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency: code, minimumFractionDigits: 2 }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${code}`;
  }
}

const HISTORY_ACTION: Record<string, string> = {
  order_created: 'Order created',
  razorpay_order_created: 'Razorpay payment started',
  paypal_order_created: 'PayPal payment started',
  payment_captured_order_completed: 'Payment captured · order completed',
  free_order_completed: 'Free order completed',
  webhook_payment_failed: 'Payment failed (gateway)',
  admin_status_change: 'Status changed by admin',
  refund_processed: 'Refund processed',
  fulfillment_failed: 'Enrollment failed',
  invoice_failed: 'Invoice generation failed',
};

export function historyLabel(action: string): string {
  return HISTORY_ACTION[action] ?? action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function shortId(value: string | null | undefined, size = 10): string {
  if (!value) return '—';
  return value.length > size + 4 ? `${value.slice(0, size)}…` : value;
}
