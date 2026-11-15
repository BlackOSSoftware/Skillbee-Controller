import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type {
  Coupon,
  CouponDeactivateResult,
  CouponListParams,
  CouponListResponse,
  CouponUsage,
  CouponUsageParams,
  CouponUsageResponse,
  CreateCouponInput,
  UpdateCouponInput,
} from '@/types/coupons';

type CouponEnvelope = ApiEnvelope<{ coupon: Coupon }>;

export const couponsService = {
  /** Response: { success, data: { coupons }, pagination }; newest first, archived coupons excluded. */
  async list(params: CouponListParams): Promise<CouponListResponse> {
    const res = await apiClient.get<ApiEnvelope<{ coupons: Coupon[] }> & { pagination: Pagination }>('/admin/coupons', { params: compactParams(params) });
    return { coupons: res.data.data.coupons, pagination: res.data.pagination };
  },

  async get(id: string): Promise<Coupon> {
    const res = await apiClient.get<CouponEnvelope>(`/admin/coupons/${id}`);
    return res.data.data.coupon;
  },

  async create(input: CreateCouponInput): Promise<Coupon> {
    const res = await apiClient.post<CouponEnvelope>('/admin/coupons', input);
    return res.data.data.coupon;
  },

  async update(id: string, input: UpdateCouponInput): Promise<Coupon> {
    const res = await apiClient.patch<CouponEnvelope>(`/admin/coupons/${id}`, input);
    return res.data.data.coupon;
  },

  /** Soft-deactivates: the coupon stops applying and leaves the list; orders and usage rows are kept. */
  async deactivate(id: string): Promise<CouponDeactivateResult> {
    const res = await apiClient.delete<ApiEnvelope<CouponDeactivateResult>>(`/admin/coupons/${id}`);
    return res.data.data;
  },

  async usage(id: string, params: CouponUsageParams): Promise<CouponUsageResponse> {
    const res = await apiClient.get<ApiEnvelope<{ usages: CouponUsage[] }> & { pagination: Pagination }>(`/admin/coupons/${id}/usage`, { params: compactParams(params) });
    return { usages: res.data.data.usages, pagination: res.data.pagination };
  },
};
