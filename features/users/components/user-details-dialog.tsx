'use client';

import { BadgeCheck, CircleDashed, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { formatDate, formatRelative, titleCase } from '@/lib/format';
import { displayName, ROLE_SLUGS } from '@/lib/roles';
import type { AdminUser } from '@/types/users';
import { useUserDetail } from '../hooks';
import { userPolicy } from '../policy';
import { UserAvatar } from './user-avatar';
import { UserStatusBadge } from './user-status-badge';

interface UserDetailsDialogProps {
  userId: string | null;
  onClose: () => void;
  onEdit: (user: AdminUser) => void;
}

function Verified({ ok }: { ok: boolean | undefined }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-success">
      <BadgeCheck className="size-3.5" aria-hidden /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-ink-subtle">
      <CircleDashed className="size-3.5" aria-hidden /> Not verified
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-2.5 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="col-span-2 min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

export function UserDetailsDialog({ userId, onClose, onEdit }: UserDetailsDialogProps) {
  const { user: actor } = useAuth();
  const detail = useUserDetail(userId);
  const user = detail.data;

  return (
    <Dialog
      open={Boolean(userId)}
      onClose={onClose}
      size="md"
      title="User details"
      description="Live record from /admin/users/:id"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {user && userPolicy.canEdit(actor, user) ? (
            <Button onClick={() => onEdit(user)}>
              <Pencil className="size-4" aria-hidden />
              Edit user
            </Button>
          ) : null}
        </>
      }
    >
      {detail.isPending ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      ) : user ? (
        <>
          <div className="flex items-center gap-4">
            <UserAvatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink">{displayName(user)}</p>
              <p className="truncate text-sm text-ink-muted">{user.email}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <UserStatusBadge status={user.status} />
                <Badge tone={user.role?.slug === ROLE_SLUGS.SUPER_ADMIN ? 'brand' : 'neutral'}>
                  {user.role?.name || titleCase(user.role?.slug || 'No role')}
                </Badge>
              </div>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-line border-t border-line">
            <Row label="Phone">{user.phone || '—'}</Row>
            <Row label="Email">
              <Verified ok={user.emailVerified} />
            </Row>
            <Row label="Phone verification">
              <Verified ok={user.phoneVerified} />
            </Row>
            <Row label="Permissions">
              {user.role?.slug === ROLE_SLUGS.SUPER_ADMIN
                ? 'Full access (bypasses permission checks)'
                : `${user.role?.permissions?.length ?? 0} via ${user.role?.name ?? 'role'}`}
            </Row>
            <Row label="Last login">
              {user.lastLogin ? `${formatDate(user.lastLogin)} (${formatRelative(user.lastLogin)})` : 'Never'}
            </Row>
            <Row label="Registered">{formatDate(user.createdAt)}</Row>
            <Row label="Last updated">{formatDate(user.updatedAt)}</Row>
            <Row label="User ID">
              <code className="font-mono text-xs text-ink-muted">{user.id}</code>
            </Row>
          </dl>
        </>
      ) : null}
    </Dialog>
  );
}
