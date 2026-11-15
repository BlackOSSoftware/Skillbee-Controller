import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { CampaignStatus, SubscriberStatus } from '@/types/newsletter';

export const SUBSCRIBER_STATUS_LABEL: Record<SubscriberStatus, string> = {
  pending: 'Pending verification',
  subscribed: 'Subscribed',
  unsubscribed: 'Unsubscribed',
};

const SUB_TONE: Record<SubscriberStatus, BadgeTone> = {
  pending: 'warning',
  subscribed: 'success',
  unsubscribed: 'neutral',
};

export function SubscriberStatusBadge({ status }: { status: SubscriberStatus }) {
  return <Badge tone={SUB_TONE[status] ?? 'neutral'}>{SUBSCRIBER_STATUS_LABEL[status] ?? status}</Badge>;
}

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Draft',
  queued: 'Queued',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
};

const CAMP_TONE: Record<CampaignStatus, BadgeTone> = {
  draft: 'neutral',
  queued: 'info',
  sending: 'warning',
  sent: 'success',
  failed: 'danger',
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge tone={CAMP_TONE[status] ?? 'neutral'}>{CAMPAIGN_STATUS_LABEL[status] ?? status}</Badge>;
}

export const SUBSCRIBER_STATUSES = Object.keys(SUBSCRIBER_STATUS_LABEL) as SubscriberStatus[];
export const CAMPAIGN_STATUSES = Object.keys(CAMPAIGN_STATUS_LABEL) as CampaignStatus[];
