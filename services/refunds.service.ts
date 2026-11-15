import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type { CreateRefundInput, Refund, RefundListParams, RefundListResponse } from '@/types/commerce';

type RefundEnvelope = ApiEnvelope<{ refund: Refund }>;

export const refundsService = {
  /** Response: { success, data: { refunds }, pagination }; newest first. */
  async list(params: RefundListParams): Promise<RefundListResponse> {
    const res = await apiClient.get<ApiEnvelope<{ refunds: Refund[] }> & { pagination: Pagination }>('/admin/refunds', { params: compactParams(params) });
    return { refunds: res.data.data.refunds, pagination: res.data.pagination };
  },

  async get(id: string): Promise<Refund> {
    const res = await apiClient.get<RefundEnvelope>(`/admin/refunds/${id}`);
    return res.data.data.refund;
  },

  /**
   * Starts a gateway refund. The result is usually `initiated`; the gateway webhook later marks it
   * `processed` or `failed`, and only then are the order and payment balances updated.
   */
  async create(orderId: string, input: CreateRefundInput): Promise<Refund> {
    const res = await apiClient.post<RefundEnvelope>(`/admin/orders/${orderId}/refunds`, input, { timeout: 60_000 });
    return res.data.data.refund;
  },
};
