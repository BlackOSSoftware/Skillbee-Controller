import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope } from '@/types/api';
import type { GatewayList, GatewayStatus, GatewayTestResult } from '@/types/commerce';

export type GatewayProvider = 'razorpay' | 'paypal';

/**
 * Read-only: credentials, mode and enablement are managed in the backend environment.
 * Responses carry masked ids and `*Configured` flags, never secret values.
 */
export const gatewaysService = {
  async list(): Promise<GatewayList> {
    const res = await apiClient.get<ApiEnvelope<GatewayList>>('/admin/payment-gateways');
    return res.data.data;
  },

  async test(provider: GatewayProvider): Promise<GatewayTestResult> {
    const res = await apiClient.post<ApiEnvelope<GatewayTestResult>>(`/admin/payment-gateways/${provider}/test`);
    return res.data.data;
  },

  async status(provider: GatewayProvider): Promise<GatewayStatus> {
    const res = await apiClient.get<ApiEnvelope<GatewayStatus>>(`/admin/payment-gateways/${provider}/status`);
    return res.data.data;
  },
};
