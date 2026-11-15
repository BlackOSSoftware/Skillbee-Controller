import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type {
  AdminNotificationListParams,
  AdminNotificationListResponse,
  AppNotification,
  CreateAdminNotificationInput,
  CreateAdminNotificationResult,
  NotificationCampaign,
  NotificationCampaignDetail,
} from '@/types/notifications';

interface MyNotificationsResponse {
  data: AppNotification[];
  pagination: Pagination;
}

export const notificationsService = {
  /** In-app notifications for the signed-in user (backend path is shared by all roles). */
  async listMine(limit: number): Promise<MyNotificationsResponse> {
    const res = await apiClient.get<MyNotificationsResponse>('/student/notifications', {
      params: { page: 1, limit },
    });
    return res.data;
  },

  async markRead(id: string): Promise<void> {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await apiClient.patch('/notifications/read-all');
  },

  /** Admin: GET /admin/notifications — response is { success, data, pagination }. */
  async listAdmin(params: AdminNotificationListParams): Promise<AdminNotificationListResponse> {
    const res = await apiClient.get<ApiEnvelope<AppNotification[]> & { pagination: Pagination }>('/admin/notifications', {
      params: compactParams(params),
    });
    return { data: res.data.data, pagination: res.data.pagination };
  },

  /** Admin: POST /admin/notifications — creates per-recipient in-app/push notifications. */
  async createAdmin(input: CreateAdminNotificationInput): Promise<CreateAdminNotificationResult> {
    const res = await apiClient.post<ApiEnvelope<CreateAdminNotificationResult>>('/admin/notifications', input);
    return res.data.data;
  },

  /** Admin: GET /admin/notifications/campaigns — grouped campaign list. */
  async listCampaigns(params: AdminNotificationListParams): Promise<{ data: NotificationCampaign[]; pagination: Pagination }> {
    const res = await apiClient.get<ApiEnvelope<NotificationCampaign[]> & { pagination: Pagination }>('/admin/notifications/campaigns', {
      params: compactParams(params),
    });
    return { data: res.data.data, pagination: res.data.pagination };
  },

  /** Admin: GET /admin/notifications/campaigns/:campaignId — campaign detail with recipients. */
  async getCampaign(campaignId: string): Promise<NotificationCampaignDetail> {
    const res = await apiClient.get<ApiEnvelope<NotificationCampaignDetail>>(
      `/admin/notifications/campaigns/${encodeURIComponent(campaignId)}`
    );
    return res.data.data;
  },
};
