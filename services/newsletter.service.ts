import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope } from '@/types/api';
import type {
  CampaignListParams,
  CampaignsResponse,
  CreateCampaignInput,
  NewsletterCampaign,
  NewsletterSubscriber,
  SubscriberListParams,
  SubscriberStatus,
  SubscribersResponse,
} from '@/types/newsletter';

export const newsletterService = {
  // ---- Subscribers ----
  async listSubscribers(params: SubscriberListParams): Promise<SubscribersResponse> {
    const res = await apiClient.get<SubscribersResponse>('/admin/newsletter/subscribers', {
      params: compactParams(params),
    });
    return { data: res.data.data, pagination: res.data.pagination };
  },

  async getSubscriber(id: string): Promise<NewsletterSubscriber> {
    const res = await apiClient.get<ApiEnvelope<NewsletterSubscriber>>(`/admin/newsletter/subscribers/${id}`);
    return res.data.data;
  },

  async setSubscriberStatus(id: string, status: SubscriberStatus): Promise<NewsletterSubscriber> {
    const res = await apiClient.patch<ApiEnvelope<NewsletterSubscriber>>(`/admin/newsletter/subscribers/${id}/status`, { status });
    return res.data.data;
  },

  async deleteSubscriber(id: string): Promise<NewsletterSubscriber> {
    const res = await apiClient.delete<ApiEnvelope<NewsletterSubscriber>>(`/admin/newsletter/subscribers/${id}`);
    return res.data.data;
  },

  // ---- Campaigns ----
  async listCampaigns(params: CampaignListParams): Promise<CampaignsResponse> {
    const res = await apiClient.get<CampaignsResponse>('/admin/newsletter/campaigns', {
      params: compactParams(params),
    });
    return { data: res.data.data, pagination: res.data.pagination };
  },

  /** Queues a campaign to all verified (subscribed) subscribers — use with care. */
  async createCampaign(input: CreateCampaignInput): Promise<NewsletterCampaign> {
    const res = await apiClient.post<ApiEnvelope<NewsletterCampaign>>('/admin/newsletter/campaigns', input);
    return res.data.data;
  },

  async getCampaign(id: string): Promise<NewsletterCampaign> {
    const res = await apiClient.get<ApiEnvelope<NewsletterCampaign>>(`/admin/newsletter/campaigns/${id}`);
    return res.data.data;
  },
};
