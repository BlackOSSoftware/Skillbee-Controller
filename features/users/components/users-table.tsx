'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, CircleCheck, CircleSlash, Eye, Pencil, Trash2, UserX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { ActionMenu, type MenuItem } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/cn';
import { formatDate, titleCase } from '@/lib/format';
import { displayName, ROLE_SLUGS } from '@/lib/roles';
import type { AdminUser } from '@/types/users';
import { userPolicy } from '../policy';
import { UserAvatar } from './user-avatar';
import { UserStatusBadge } from './user-status-badge';

export type SortKey = 'name' | 'email' | 'role' | 'status' | 'createdAt';
export interface SortState {
  key: SortKey;
  direction: 'asc' | 'desc';
}

export type UserAction = 'view' | 'edit' | 'activate' | 'deactivate' | 'suspend' | 'delete';

interface UsersTableProps {
  users: AdminUser[];
  loading: boolean;
  dimmed: boolean;
  sort: SortState;
  onSort: (key: SortKey) => void;
  onAction: (action: UserAction, user: AdminUser) => void;
}

function useRowActions(onAction: UsersTableProps['onAction']) {
  const { user: actor } = useAuth();
  return (u: AdminUser): MenuItem[] => {
    const items: MenuItem[] = [
      { key: 'view', label: 'View details', icon: <Eye className="size-4" />, onSelect: () => onAction('view', u) },
    ];
    if (userPolicy.canEdit(actor, u)) {
      items.push({ key: 'edit', label: 'Edit user', icon: <Pencil className="size-4" />, onSelect: () => onAction('edit', u) });
    }
    if (userPolicy.canChangeStatus(actor, u)) {
      if (u.status !== 'active')
        items.push({ key: 'activate', label: 'Activate', icon: <CircleCheck className="size-4" />, onSelect: () => onAction('activate', u) });
      if (u.status !== 'inactive')
        items.push({ key: 'deactivate', label: 'Deactivate', icon: <CircleSlash className="size-4" />, onSelect: () => onAction('deactivate', u) });
      if (u.status !== 'suspended')
        items.push({ key: 'suspend', label: 'Suspend', icon: <UserX className="size-4" />, tone: 'danger', onSelect: () => onAction('suspend', u) });
    }
    if (userPolicy.canDelete(actor, u)) {
      items.push({ key: 'delete', label: 'Delete user', icon: <Trash2 className="size-4" />, tone: 'danger', onSelect: () => onAction('delete', u) });
    }
    return items;
  };
}

function RoleBadge({ user }: { user: AdminUser }) {
  return (
    <Badge tone={user.role?.slug === ROLE_SLUGS.SUPER_ADMIN ? 'brand' : 'neutral'}>
      {user.role?.name || titleCase(user.role?.slug || 'No role')}
    </Badge>
  );
}

function SortHeader({ label, sortKey, sort, onSort, className }: { label: string; sortKey: SortKey; sort: SortState; onSort: (k: SortKey) => void; className?: string }) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th scope="col" className={cn('px-4 py-3', className)} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(sortKey)} className={cn('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink')}>
        {label}
        <Icon className="size-3" aria-hidden />
      </button>
    </th>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i}>
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          </td>
          {Array.from({ length: 5 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-4 w-24" />
            </td>
          ))}
          <td className="px-4 py-3" />
        </tr>
      ))}
    </>
  );
}

export function UsersTable({ users, loading, dimmed, sort, onSort, onAction }: UsersTableProps) {
  const rowActions = useRowActions(onAction);
  const { user: actor } = useAuth();

  const nameCell = (u: AdminUser): ReactNode => (
    <button type="button" onClick={() => onAction('view', u)} className="flex min-w-0 items-center gap-3 text-left">
      <UserAvatar user={u} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink hover:text-primary">{displayName(u)}</span>
        {u.id === actor?.id ? <span className="text-[11px] text-ink-subtle">You</span> : null}
      </span>
    </button>
  );

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-surface-2/60 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            <tr>
              <SortHeader label="User" sortKey="name" sort={sort} onSort={onSort} />
              <SortHeader label="Email" sortKey="email" sort={sort} onSort={onSort} />
              <th scope="col" className="px-4 py-3">Phone</th>
              <SortHeader label="Assigned role" sortKey="role" sort={sort} onSort={onSort} />
              <SortHeader label="Status" sortKey="status" sort={sort} onSort={onSort} />
              <SortHeader label="Registered" sortKey="createdAt" sort={sort} onSort={onSort} />
              <th scope="col" className="px-4 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className={cn('divide-y divide-line', dimmed && 'opacity-60')}>
            {loading ? (
              <SkeletonRows />
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-2/60">
                  <td className="max-w-56 px-4 py-3">{nameCell(u)}</td>
                  <td className="max-w-56 truncate px-4 py-3 text-ink-muted">{u.email}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{u.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <RoleBadge user={u} />
                  </td>
                  <td className="px-4 py-3">
                    <UserStatusBadge status={u.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-muted">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <ActionMenu label={`Actions for ${displayName(u)}`} items={rowActions(u)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className={cn('divide-y divide-line md:hidden', dimmed && 'opacity-60')}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </li>
            ))
          : users.map((u) => (
              <li key={u.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  {nameCell(u)}
                  <ActionMenu label={`Actions for ${displayName(u)}`} items={rowActions(u)} />
                </div>
                <p className="mt-2 truncate text-xs text-ink-muted">{u.email}</p>
                {u.phone ? <p className="text-xs text-ink-muted">{u.phone}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RoleBadge user={u} />
                  <UserStatusBadge status={u.status} />
                  <span className="text-[11px] text-ink-subtle">Joined {formatDate(u.createdAt)}</span>
                </div>
              </li>
            ))}
      </ul>
    </>
  );
}
