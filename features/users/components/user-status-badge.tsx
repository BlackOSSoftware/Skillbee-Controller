import { Badge, type BadgeTone } from '@/components/ui/badge';
import { titleCase } from '@/lib/format';
import type { UserStatus } from '@/types/auth';

export const USER_STATUSES: UserStatus[] = ['active', 'inactive', 'suspended'];

const statusTone: Record<UserStatus, BadgeTone> = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'danger',
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <Badge tone={statusTone[status] ?? 'neutral'}>{titleCase(status)}</Badge>;
}
