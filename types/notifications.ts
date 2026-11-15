import type { Pagination } from './api';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  category?: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  // Admin list fields (present on /admin/notifications responses)
  recipientId?: string;
  recipientRole?: string;
  data?: Record<string, unknown>;
  createdBy?: string | null;
  deliveryStatus?: string;
  campaignId?: string | null;
  updatedAt?: string;
}

/** Campaign summary returned by GET /admin/notifications/campaigns. */
export interface NotificationCampaign {
  campaignId: string;
  title: string;
  message: string;
  type: string;
  category?: string;
  createdBy: string | null;
  createdAt: string;
  recipientCount: number;
  delivery: {
    sent: number;
    failed: number;
    skipped: number;
    partial: number;
    pending: number;
  };
  readCount: number;
}

/** Campaign detail returned by GET /admin/notifications/campaigns/:campaignId. */
export interface NotificationCampaignDetail extends NotificationCampaign {
  recipients: AppNotification[];
}

/** Query accepted by GET /admin/notifications (backend listQuery). */
export interface AdminNotificationListParams {
  page: number;
  limit: number;
  isRead?: boolean;
  type?: string;
  recipientId?: string;
}

export type NotificationRecipientType =
  | 'all_students'
  | 'selected_students'
  | 'selected_course_students'
  | 'selected_users';

export type NotificationDeliveryChannel = 'in_app' | 'push' | 'both';

/** Body for POST /admin/notifications (backend adminNotificationBody). */
export interface CreateAdminNotificationInput {
  title: string;
  message: string;
  recipientType: NotificationRecipientType;
  recipientIds?: string[];
  courseId?: string;
  deliveryChannel?: NotificationDeliveryChannel;
  type?: 'custom' | 'course_announcement';
  category?: string;
}

/** Response data of POST /admin/notifications. */
export interface CreateAdminNotificationResult {
  created: number;
  duplicates: number;
  batchId: string;
  recipientCount: number;
}

export interface AdminNotificationListResponse {
  data: AppNotification[];
  pagination: Pagination;
}
