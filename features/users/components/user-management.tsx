'use client';

import { Plus, Search, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Select } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { normalizeApiError } from '@/lib/api-error';
import { titleCase } from '@/lib/format';
import { displayName, hasPermissions } from '@/lib/roles';
import { useToast } from '@/providers/toast-provider';
import type { UserStatus } from '@/types/auth';
import type { AdminUser } from '@/types/users';
import { useRolesList, useSoftDeleteUser, useUpdateUserStatus, useUsersList } from '../hooks';
import { userPolicy } from '../policy';
import { UserDetailsDialog } from './user-details-dialog';
import { UserFormDialog } from './user-form-dialog';
import { USER_STATUSES } from './user-status-badge';
import { UserStats } from './user-stats';
import { UsersTable, type SortKey, type SortState, type UserAction } from './users-table';

const PAGE_SIZES = [10, 20, 50];

type ConfirmableAction = 'deactivate' | 'suspend' | 'delete';

type DialogState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; user: AdminUser }
  | { type: 'view'; userId: string }
  | { type: 'confirm'; action: ConfirmableAction; user: AdminUser };

const CONFIRM_COPY: Record<ConfirmableAction, { title: string; label: string; body: string }> = {
  deactivate: {
    title: 'Deactivate user?',
    label: 'Deactivate',
    body: 'The account becomes inactive and is signed out of all sessions. You can reactivate it later.',
  },
  suspend: {
    title: 'Suspend user?',
    label: 'Suspend',
    body: 'The account is suspended and signed out of all sessions until an admin activates it again.',
  },
  delete: {
    title: 'Delete user?',
    label: 'Delete user',
    body: 'This soft-deletes the account: it is marked inactive, signed out, and removed from user lists. There is no restore action in the console.',
  },
};

function compareUsers(a: AdminUser, b: AdminUser, key: SortKey): number {
  switch (key) {
    case 'name':
      return displayName(a).localeCompare(displayName(b));
    case 'email':
      return a.email.localeCompare(b.email);
    case 'role':
      return (a.role?.name ?? '').localeCompare(b.role?.name ?? '');
    case 'status':
      return a.status.localeCompare(b.status);
    case 'createdAt':
      return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
  }
}

export function UserManagement() {
  const { user: actor } = useAuth();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [sort, setSort] = useState<SortState>({ key: 'createdAt', direction: 'desc' });
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const debouncedSearch = useDebouncedValue(search.trim());

  const canReadRoles = hasPermissions(actor, ['roles:read']);
  const roles = useRolesList(canReadRoles);
  const users = useUsersList({
    page,
    limit,
    search: debouncedSearch || undefined,
    role: role || undefined,
    status: status || undefined,
  });
  const updateStatus = useUpdateUserStatus();
  const softDelete = useSoftDeleteUser();
  // isPending only updates after re-render; this blocks a duplicate action fired in the same tick
  const actionInFlight = useRef(false);

  const rows = useMemo(() => {
    const list = [...(users.data?.users ?? [])];
    list.sort((a, b) => compareUsers(a, b, sort.key) * (sort.direction === 'asc' ? 1 : -1));
    return list;
  }, [users.data, sort]);

  const filtersActive = Boolean(search || role || status);
  const closeDialog = () => setDialog({ type: 'none' });

  function changeStatus(user: AdminUser, next: UserStatus, onDone?: () => void) {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    updateStatus.mutate(
      { id: user.id, status: next },
      {
        onSuccess: (updated) => {
          toast.success(`User ${next === 'active' ? 'activated' : next === 'inactive' ? 'deactivated' : 'suspended'}`, displayName(updated));
          onDone?.();
        },
        onError: (error) => toast.error('Status change failed', normalizeApiError(error).message),
        onSettled: () => {
          actionInFlight.current = false;
        },
      }
    );
  }

  function handleAction(action: UserAction, user: AdminUser) {
    if (action === 'view') setDialog({ type: 'view', userId: user.id });
    else if (action === 'edit') setDialog({ type: 'edit', user });
    else if (action === 'activate') changeStatus(user, 'active');
    else setDialog({ type: 'confirm', action, user });
  }

  function confirmAction() {
    if (dialog.type !== 'confirm') return;
    const { action, user } = dialog;
    if (action === 'delete') {
      if (actionInFlight.current) return;
      actionInFlight.current = true;
      softDelete.mutate(user.id, {
        onSuccess: () => {
          toast.success('User deleted', displayName(user));
          if (rows.length === 1 && page > 1) setPage((p) => p - 1);
          closeDialog();
        },
        onError: (error) => toast.error('Delete failed', normalizeApiError(error).message),
        onSettled: () => {
          actionInFlight.current = false;
        },
      });
      return;
    }
    changeStatus(user, action === 'deactivate' ? 'inactive' : 'suspended', closeDialog);
  }

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: key === 'createdAt' ? 'desc' : 'asc' }));
  }

  const confirmCopy = dialog.type === 'confirm' ? CONFIRM_COPY[dialog.action] : null;

  return (
    <>
      <PageHeader
        title="User Management"
        description="Create, review and control access for every SkillBee account."
        actions={
          userPolicy.canCreate(actor) ? (
            <Button onClick={() => setDialog({ type: 'create' })}>
              <Plus className="size-4" aria-hidden />
              Create user
            </Button>
          ) : null
        }
      />

      <UserStats
        activeStatus={status}
        onSelect={(next) => {
          setStatus(next);
          setPage(1);
        }}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, email or phone"
              className="pl-9"
              aria-label="Search users"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            {canReadRoles ? (
              <Select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setPage(1);
                }}
                className="sm:w-44"
                aria-label="Filter by role"
                disabled={roles.isPending}
              >
                <option value="">All roles</option>
                {(roles.data ?? []).map((r) => (
                  <option key={r.id} value={r.slug}>
                    {r.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as UserStatus | '');
                setPage(1);
              }}
              className="sm:w-40"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {USER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
            {filtersActive ? (
              <Button
                variant="ghost"
                className="col-span-2 sm:col-span-1"
                onClick={() => {
                  setSearch('');
                  setRole('');
                  setStatus('');
                  setPage(1);
                }}
              >
                <X className="size-4" aria-hidden />
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        {users.isError ? (
          <ErrorState error={users.error} onRetry={() => users.refetch()} />
        ) : !users.isPending && rows.length === 0 ? (
          <EmptyState
            title={filtersActive ? 'No users match these filters' : 'No users yet'}
            description={filtersActive ? 'Try a different search, role or status.' : 'Create the first user to get started.'}
          />
        ) : (
          <UsersTable
            users={rows}
            loading={users.isPending}
            dimmed={users.isPlaceholderData}
            sort={sort}
            onSort={toggleSort}
            onAction={handleAction}
          />
        )}

        {rows.length > 1 ? (
          <p className="border-t border-line px-5 pt-3 text-[11px] text-ink-subtle">
            Column sorting reorders the current page; the API returns newest accounts first.
          </p>
        ) : null}
        <Pagination
          meta={users.data?.pagination}
          onPageChange={setPage}
          disabled={users.isFetching}
          pageSizeOptions={PAGE_SIZES}
          onPageSizeChange={(size) => {
            setLimit(size);
            setPage(1);
          }}
        />
      </Card>

      {dialog.type === 'create' ? <UserFormDialog key="create" open mode="create" onClose={closeDialog} /> : null}
      {dialog.type === 'edit' ? <UserFormDialog key={`edit-${dialog.user.id}`} open mode="edit" user={dialog.user} onClose={closeDialog} /> : null}
      <UserDetailsDialog
        userId={dialog.type === 'view' ? dialog.userId : null}
        onClose={closeDialog}
        onEdit={(u) => setDialog({ type: 'edit', user: u })}
      />
      <ConfirmDialog
        open={dialog.type === 'confirm'}
        title={confirmCopy?.title ?? ''}
        confirmLabel={confirmCopy?.label ?? 'Confirm'}
        loading={updateStatus.isPending || softDelete.isPending}
        onCancel={closeDialog}
        onConfirm={confirmAction}
        description={
          dialog.type === 'confirm' ? (
            <>
              <p>
                <span className="font-semibold text-ink">{displayName(dialog.user)}</span> ({dialog.user.email})
              </p>
              <p className="mt-2">{confirmCopy?.body}</p>
            </>
          ) : null
        }
      />
    </>
  );
}
