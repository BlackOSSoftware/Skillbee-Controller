'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { formatRelative, titleCase } from '@/lib/format';
import { displayName, initialsOf } from '@/lib/roles';
import { useRecentUsers } from '../hooks';

export function RecentUsersCard() {
  const query = useRecentUsers(6);
  const users = query.data?.users ?? [];

  return (
    <Card>
      <CardHeader
        title="Recent registrations"
        description="Newest accounts from /admin/users"
        action={
          <Link href="/users" className="text-xs font-medium text-primary hover:text-primary-hover">
            View all
          </Link>
        }
      />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : users.length === 0 ? (
        <EmptyState title="No users yet" />
      ) : (
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-ink-muted">
                {initialsOf(u)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{displayName(u)}</span>
                <span className="block truncate text-xs text-ink-muted">{u.email}</span>
              </span>
              <Badge tone="neutral">{u.role?.name || titleCase(u.role?.slug || 'unknown')}</Badge>
              <span className="hidden w-20 text-right text-xs text-ink-subtle sm:block">{formatRelative(u.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
