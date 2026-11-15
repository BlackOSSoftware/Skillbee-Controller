import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope } from '@/types/api';
import type { Referral, ReferralListParams, ReferralsResponse, UpdateReferralStatusInput } from '@/types/referrals';

export const referralsService = {
  /** GET /admin/referrals — response is { success, data, pagination } (pagination top-level). */
  async list(params: ReferralListParams): Promise<ReferralsResponse> {
    const res = await apiClient.get<ReferralsResponse>('/admin/referrals', { params: compactParams(params) });
    return { data: res.data.data, pagination: res.data.pagination };
  },

  /** GET /admin/referrals/:id — includes private adminNotes (admin-only endpoint). */
  async get(id: string): Promise<Referral> {
    const res = await apiClient.get<ApiEnvelope<Referral>>(`/admin/referrals/${id}`);
    return res.data.data;
  },

  /** PATCH /admin/referrals/:id/status */
  async updateStatus(id: string, input: UpdateReferralStatusInput): Promise<Referral> {
    const res = await apiClient.patch<ApiEnvelope<Referral>>(`/admin/referrals/${id}/status`, input);
    return res.data.data;
  },

  /** DELETE /admin/referrals/:id — soft delete. */
  async remove(id: string): Promise<Referral> {
    const res = await apiClient.delete<ApiEnvelope<Referral>>(`/admin/referrals/${id}`);
    return res.data.data;
  },
};
