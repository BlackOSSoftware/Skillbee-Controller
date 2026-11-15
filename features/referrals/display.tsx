import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { ReferralStatus } from '@/types/referrals';

export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  pending: 'Pending',
  contacted: 'Contacted',
  converted: 'Converted',
  rejected: 'Rejected',
};

const STATUS_TONE: Record<ReferralStatus, BadgeTone> = {
  pending: 'warning',
  contacted: 'info',
  converted: 'success',
  rejected: 'danger',
};

export function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{REFERRAL_STATUS_LABEL[status] ?? status}</Badge>;
}

export const REFERRAL_STATUSES = Object.keys(REFERRAL_STATUS_LABEL) as ReferralStatus[];
