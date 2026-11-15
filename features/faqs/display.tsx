import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { FaqStatus } from '@/types/faqs';

export const FAQ_STATUS_LABEL: Record<FaqStatus, string> = {
  draft: 'Draft',
  published: 'Published',
};

const TONE: Record<FaqStatus, BadgeTone> = {
  draft: 'neutral',
  published: 'success',
};

export function FaqStatusBadge({ status }: { status: FaqStatus }) {
  return <Badge tone={TONE[status] ?? 'neutral'}>{FAQ_STATUS_LABEL[status] ?? status}</Badge>;
}

export const FAQ_STATUSES = Object.keys(FAQ_STATUS_LABEL) as FaqStatus[];
