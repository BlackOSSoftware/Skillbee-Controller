import type { Pagination } from './api';

/** Backend `ORDER_STATUSES` / `PAYMENT_STATUSES` (models/Order.js). */
export const ORDER_STATUSES = ['pending', 'processing', 'completed', 'cancelled', 'failed', 'refunded', 'partially_refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['pending', 'authorized', 'captured', 'failed', 'partially_refunded', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentGatewayName = 'razorpay' | 'paypal' | 'none';
export type FulfillmentStatus = 'pending' | 'fulfilled' | 'partial' | 'failed';

export interface OrderItem {
  courseId: string;
  courseName: string;
  courseSlug: string;
  courseThumbnail: { secureUrl?: string } | null;
  regularPrice: number;
  salePrice: number | null;
  finalPrice: number;
  finalPricePaise: number;
  currency: string;
  discountPaise: number;
  taxPaise: number;
  itemTotalPaise: number;
}

export interface Billing {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  gstin: string;
}

/** `Order.toSafeObject({ includeAdmin: true })`. */
export interface Order {
  id: string;
  orderNumber: string;
  invoiceNumber: string | null;
  studentId: string;
  items: OrderItem[];
  billing: Partial<Billing> | null;
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  totalAmount: number;
  currency: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentGateway: PaymentGatewayName;
  paymentCurrency: string | null;
  paymentAmountMinor: number | null;
  fxSnapshot: { fromCurrency: string; toCurrency: string; rate: string; source: string; originalAmountMinor: number; convertedAmountMinor: number; convertedAt: string } | null;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  couponSnapshot: { code?: string; discountType?: string; discountValue?: number } | null;
  fulfillmentStatus: FulfillmentStatus;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on admin payloads; never displayed (server storage path). */
  invoiceStorageKey?: string | null;
  invoiceFileName?: string | null;
  notes?: string;
}

/** Query accepted by GET /admin/orders and the course/student variants (`orderListQuery`). */
export interface OrderListParams {
  page: number;
  limit: number;
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  studentId?: string;
  courseId?: string;
  orderNumber?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface OrderListResponse {
  orders: Order[];
  pagination: Pagination;
}

export interface OrderHistoryEntry {
  _id?: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  fromPaymentStatus: string | null;
  toPaymentStatus: string | null;
  actorId: string | null;
  source: string;
  reason: string | null;
  meta: Record<string, unknown> | null;
  at: string;
}

/** GET /admin/orders/:id/history → data. */
export interface OrderHistory {
  orderId: string;
  orderNumber: string;
  history: OrderHistoryEntry[];
}

/** Body for PATCH /admin/orders/:id/status (`orderStatusBody`). The backend refuses `completed`. */
export interface OrderStatusInput {
  status: OrderStatus;
  reason?: string;
}

/** Backend `GATEWAY_PAYMENT_STATUSES`; `Payment.toSafeObject()`. Amounts are minor units of `currency`. */
export type GatewayPaymentStatus = 'created' | 'authorized' | 'captured' | 'failed' | 'refunded' | 'partially_refunded';

export interface Payment {
  id: string;
  orderId: string;
  studentId: string;
  provider: PaymentGatewayName;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amountPaise: number;
  amountMinor: number;
  amount: number;
  currency: string;
  checkoutUrl: string | null;
  paymentStatus: GatewayPaymentStatus;
  paymentMethod: string | null;
  signatureVerified: boolean;
  webhookVerified: boolean;
  failureCode: string | null;
  failureDescription: string | null;
  capturedAt: string | null;
  failedAt: string | null;
  refundedPaise: number;
  createdAt: string;
  updatedAt: string;
}

/** Backend `REFUND_STATUSES`; `Refund.toSafeObject()`. */
export const REFUND_STATUSES = ['initiated', 'processed', 'failed'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export interface Refund {
  id: string;
  orderId: string;
  paymentId: string;
  studentId: string;
  amountPaise: number;
  amount: number;
  currency: string;
  status: RefundStatus;
  providerRefundId: string | null;
  reason: string;
  revokeEnrollment: boolean;
  enrollmentRevoked: boolean;
  processedAt: string | null;
  createdAt: string;
}

/** Filters read by `listRefunds` (no validator; only these are applied). */
export interface RefundListParams {
  page: number;
  limit: number;
  orderId?: string;
  status?: RefundStatus;
}

export interface RefundListResponse {
  refunds: Refund[];
  pagination: Pagination;
}

/** Body for POST /admin/orders/:id/refunds (`refundBody`). Omitting `amountPaise` refunds the full balance. */
export interface CreateRefundInput {
  amountPaise?: number;
  reason?: string;
  revokeEnrollment?: boolean;
  idempotencyKey?: string;
}

/* ----------------------------- Gateways ----------------------------- */

export type GatewaySource = 'environment' | 'database' | 'none';

interface GatewayBase {
  envEnabled: boolean;
  isEnabled: boolean;
  mode: string;
  secretKeyConfigured: boolean;
  currency: string;
  allowedCountries: string[];
  encryptionReady: boolean;
  source: GatewaySource;
  updatedAt: string | null;
}

/** Secrets are never returned; ids are masked (`abcd…wxyz`). */
export interface RazorpayGatewayInfo extends GatewayBase {
  provider: 'razorpay';
  keyId: string | null;
  webhookSecretConfigured: boolean;
}

export interface PayPalGatewayInfo extends GatewayBase {
  provider: 'paypal';
  clientId: string | null;
  webhookIdConfigured: boolean;
}

/** GET /admin/payment-gateways → data. */
export interface GatewayList {
  defaultGateway: string;
  gateways: Array<RazorpayGatewayInfo | PayPalGatewayInfo>;
}

/** POST /admin/payment-gateways/:provider/test → data. Failures are reported in the body (`ok: false`). */
export interface GatewayTestResult {
  ok: boolean;
  mode?: string;
  keyIdMasked?: string;
  clientIdMasked?: string;
  message: string;
  code?: string;
}

/** GET /admin/payment-gateways/:provider/status → data. */
export interface GatewayStatus {
  provider: 'razorpay' | 'paypal';
  isEnabled: boolean;
  mode: string;
  ready: boolean;
  webhookConfigured: boolean;
  source: GatewaySource;
  encryptionReady: boolean;
}
