import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { BlogStatus } from '@/types/blogs';

export const BLOG_STATUS_LABEL: Record<BlogStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

const TONE: Record<BlogStatus, BadgeTone> = {
  draft: 'neutral',
  published: 'success',
  archived: 'warning',
};

export function BlogStatusBadge({ status }: { status: BlogStatus }) {
  return <Badge tone={TONE[status] ?? 'neutral'}>{BLOG_STATUS_LABEL[status] ?? status}</Badge>;
}

export const BLOG_STATUSES = Object.keys(BLOG_STATUS_LABEL) as BlogStatus[];
