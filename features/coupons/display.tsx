import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { Coupon, CouponUsageStatus } from '@/types/coupons';

export type CouponState = 'active' | 'paused' | 'scheduled' | 'expired' | 'exhausted';

/** What a learner would experience right now; mirrors the backend's redemption checks. */
export function couponState(c: Coupon, now = Date.now()): CouponState {
  if (!c.isActive) return 'paused';
  if (c.expiryDate && new Date(c.expiryDate).getTime() < now) return 'expired';
  if (c.startDate && new Date(c.startDate).getTime() > now) return 'scheduled';
  if (c.usageLimit != null && c.usedCount + c.reservedCount >= c.usageLimit) return 'exhausted';
  return 'active';
}

const STATE: Record<CouponState, { label: string; tone: BadgeTone; hint: string }> = {
  active: { label: 'Active', tone: 'success', hint: 'Learners can apply it at checkout.' },
  paused: { label: 'Paused', tone: 'neutral', hint: 'Turned off by an admin; it cannot be applied.' },
  scheduled: { label: 'Scheduled', tone: 'info', hint: 'Becomes usable on its start date.' },
  expired: { label: 'Expired', tone: 'warning', hint: 'Past its expiry date.' },
  exhausted: { label: 'Limit reached', tone: 'danger', hint: 'All redemptions are used or held by unpaid orders.' },
};

export function couponStateHint(state: CouponState) {
  return STATE[state].hint;
}

export function CouponStateBadge({ coupon }: { coupon: Coupon }) {
  const s = STATE[couponState(coupon)];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** Coupon money fields are major units (₹ 499, not paise). */
export function formatMajor(amount: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function discountLabel(c: Pick<Coupon, 'discountType' | 'discountValue' | 'currency' | 'maximumDiscountAmount'>) {
  if (c.discountType === 'percentage') {
    const cap = c.maximumDiscountAmount != null ? ` · up to ${formatMajor(c.maximumDiscountAmount, c.currency)}` : '';
    return `${c.discountValue}% off${cap}`;
  }
  return `${formatMajor(c.discountValue, c.currency)} off`;
}

export function usageLabel(c: Pick<Coupon, 'usedCount' | 'usageLimit'>) {
  return c.usageLimit != null ? `${c.usedCount} / ${c.usageLimit}` : `${c.usedCount}`;
}

const USAGE: Record<CouponUsageStatus, { label: string; tone: BadgeTone }> = {
  consumed: { label: 'Redeemed', tone: 'success' },
  reserved: { label: 'Held', tone: 'info' },
  released: { label: 'Released', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
};

export function usageStatusLabel(s: CouponUsageStatus) {
  return USAGE[s].label;
}

export function UsageStatusBadge({ status }: { status: CouponUsageStatus }) {
  return <Badge tone={USAGE[status].tone}>{USAGE[status].label}</Badge>;
}
