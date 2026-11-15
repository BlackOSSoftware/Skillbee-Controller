import type { Pagination } from './api';
import type { OrderStatus, PaymentStatus } from './commerce';

export const COUPON_DISCOUNT_TYPES = ['percentage', 'fixed'] as const;
export type CouponDiscountType = (typeof COUPON_DISCOUNT_TYPES)[number];

export const COUPON_APPLICABILITY = ['all_courses', 'selected_courses'] as const;
export type CouponApplicability = (typeof COUPON_APPLICABILITY)[number];

/** `Coupon.toSafeObject({ includeAdmin: true })`. Money fields are major units (₹, not paise). */
export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: CouponDiscountType;
  /** 0–100 for percentage; major units for fixed. */
  discountValue: number;
  currency: string;
  minimumOrderAmount: number;
  /** Cap for percentage discounts; null = no cap. */
  maximumDiscountAmount: number | null;
  /** Total redemptions allowed; null = unlimited. */
  usageLimit: number | null;
  perUserLimit: number;
  /** Paid (consumed) redemptions. */
  usedCount: number;
  /** Held by orders that are not paid yet. */
  reservedCount: number;
  startDate: string | null;
  expiryDate: string | null;
  applicability: CouponApplicability;
  applicableCourses: string[];
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Query for GET /admin/coupons (`couponListQuery`); `search` matches code and description. */
export interface CouponListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  expired?: boolean;
  upcoming?: boolean;
  discountType?: CouponDiscountType;
}

export interface CouponListResponse {
  coupons: Coupon[];
  pagination: Pagination;
}

/** Body for POST /admin/coupons (`createCouponBody`, strict). */
export interface CreateCouponInput {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  currency?: string;
  minimumOrderAmount?: number;
  maximumDiscountAmount?: number | null;
  usageLimit?: number | null;
  perUserLimit?: number | null;
  startDate?: string | null;
  expiryDate?: string | null;
  applicability?: CouponApplicability;
  applicableCourses?: string[];
  isActive?: boolean;
}

/**
 * Body for PATCH /admin/coupons/:id (`updateCouponBody`, strict). The backend rejects changes to
 * discountType/discountValue/currency once `usedCount > 0`, and to `code` once used or reserved.
 */
export type UpdateCouponInput = Partial<CreateCouponInput>;

/** DELETE /admin/coupons/:id → data. The coupon is deactivated and hidden from lists (not erased). */
export interface CouponDeactivateResult {
  id: string;
  deactivated: boolean;
}

export const COUPON_USAGE_STATUSES = ['reserved', 'consumed', 'released', 'failed'] as const;
export type CouponUsageStatus = (typeof COUPON_USAGE_STATUSES)[number];

/** Row of GET /admin/coupons/:id/usage. */
export interface CouponUsage {
  id: string;
  couponCode: string;
  discountAmountPaise: number;
  discountAmount: number;
  currency: string;
  status: CouponUsageStatus;
  appliedAt: string;
  student: { id: string; firstName: string; lastName: string; email: string } | null;
  order: { id: string; orderNumber?: string; orderStatus?: OrderStatus; paymentStatus?: PaymentStatus };
}

export interface CouponUsageParams {
  page?: number;
  limit?: number;
  status?: CouponUsageStatus;
}

export interface CouponUsageResponse {
  usages: CouponUsage[];
  pagination: Pagination;
}
