import type { Paginated } from './instructors';

export type SubscriberStatus = 'pending' | 'subscribed' | 'unsubscribed';
export type CampaignStatus = 'draft' | 'queued' | 'sending' | 'sent' | 'failed';

/** NewsletterSubscriber.toSafeObject() */
export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: SubscriberStatus;
  subscribedAt: string | null;
  unsubscribedAt: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export type SubscribersResponse = Paginated<NewsletterSubscriber>;

/** GET /admin/newsletter/subscribers query (listQuery). */
export interface SubscriberListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: SubscriberStatus;
}

/** NewsletterCampaign.toSafeObject() */
export interface NewsletterCampaign {
  id: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  status: CampaignStatus;
  createdBy: string | null;
  stats: {
    queued: number;
    sent: number;
    failed: number;
    skippedUnsubscribed: number;
  };
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CampaignsResponse = Paginated<NewsletterCampaign>;

/** GET /admin/newsletter/campaigns — backend only supports page/limit. */
export interface CampaignListParams {
  page?: number;
  limit?: number;
}

/** POST /admin/newsletter/campaigns body (campaignBody). */
export interface CreateCampaignInput {
  subject: string;
  htmlBody: string;
  textBody: string;
}
