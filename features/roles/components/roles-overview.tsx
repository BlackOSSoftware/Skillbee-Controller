'use client';

import { Layers, Lock, Pencil, Plus, ShieldCheck, Shapes, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { formatNumber } from '@/lib/format';
import { hasPermissions, ROLE_SLUGS } from '@/lib/roles';
import { useToast } from '@/providers/toast-provider';
import type { Role } from '@/types/users';
import { useDeleteRole, usePermissionsCatalog, useRoleUserCount, useRolesList } from '../hooks';
import { rolePolicy } from '../policy';
import { PermissionsDialog } from './permissions-dialog';
import { RoleFormDialog } from './role-form-dialog';
import { Coverage, RoleIcon } from './role-visuals';

/** System roles first in their natural hierarchy, then custom roles by name. */
const SYSTEM_ORDER: string[] = [ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.ADMIN, ROLE_SLUGS.INSTRUCTOR, ROLE_SLUGS.STUDENT];

function sortRoles(roles: Role[]): Role[] {
  return [...roles].sort((a, b) => {
    const ia = SYSTEM_ORDER.indexOf(a.slug);
    const ib = SYSTEM_ORDER.indexOf(b.slug);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.name.localeCompare(b.name);
  });
}

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
      <span className="flex size-9 items-center justify-center rounded-lg bg-surface-2 text-ink-muted">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{label}</p>
        <p className="text-lg font-semibold leading-tight text-ink">{value}</p>
      </div>
    </div>
  );
}

function UsersCell({ role, enabled }: { role: Role; enabled: boolean }) {
  const count = useRoleUserCount(role.id, enabled);
  if (!enabled || count.isError) return <span className="text-ink-subtle">—</span>;
  if (count.isPending) return <Skeleton className="h-4 w-8" />;
  return <span className="font-semibold text-ink">{formatNumber(count.data)}</span>;
}

/** Student never holds admin permissions, so it shows a label instead of a count. */
function PermissionsCell({ role, catalogSize }: { role: Role; catalogSize: number | undefined }) {
  if (role.slug === ROLE_SLUGS.SUPER_ADMIN) {
    return (
      <div className="w-36">
        <p className="text-sm font-semibold text-ink">All permissions</p>
        <div className="mt-1.5">
          <Coverage value={1} max={1} full />
        </div>
      </div>
    );
  }
  if (role.slug === ROLE_SLUGS.STUDENT) {
    return role.permissions.length ? (
      <Badge tone="danger">{role.permissions.length} unexpected</Badge>
    ) : (
      <Badge tone="neutral">No admin access</Badge>
    );
  }
  return (
    <div className="w-36">
      <p className="text-sm font-semibold text-ink">
        {role.permissions.length}
        {catalogSize ? <span className="font-normal text-ink-subtle"> / {catalogSize}</span> : null}
      </p>
      <div className="mt-1.5">
        <Coverage value={role.permissions.length} max={catalogSize} />
      </div>
    </div>
  );
}

function StatusBadges({ role }: { role: Role }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge tone={role.isSystem ? 'brand' : 'accent'}>{role.isSystem ? 'System' : 'Custom'}</Badge>
      <Badge tone={role.isActive ? 'success' : 'danger'}>{role.isActive ? 'Active' : 'Inactive'}</Badge>
    </div>
  );
}

interface RowActionsProps {
  role: Role;
  canCountUsers: boolean;
  onManage?: () => void;
  manageLabel: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

function RowActions({ role, canCountUsers, onManage, manageLabel, onEdit, onDelete }: RowActionsProps) {
  const count = useRoleUserCount(role.id, canCountUsers && Boolean(onDelete));
  const deleteBlocked = canCountUsers && (count.data ?? 0) > 0 ? `Assigned to ${count.data} user${count.data === 1 ? '' : 's'}; reassign them first.` : null;
  return (
    <div className="flex items-center justify-end gap-1.5">
      {onManage ? (
        <Button size="sm" variant="secondary" onClick={onManage}>
          <SlidersHorizontal className="size-3.5" aria-hidden />
          {manageLabel}
        </Button>
      ) : null}
      {onEdit ? (
        <Button size="sm" variant="ghost" className="size-8 px-0" onClick={onEdit} aria-label={`Edit ${role.name}`} title="Edit role">
          <Pencil className="size-3.5" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          size="sm"
          variant="ghost"
          className="size-8 px-0 text-danger hover:bg-danger/10 hover:text-danger"
          onClick={onDelete}
          disabled={Boolean(deleteBlocked)}
          aria-label={`Delete ${role.name}`}
          title={deleteBlocked ?? 'Delete role'}
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <div className="divide-y divide-line">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="size-9 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="hidden h-4 w-24 md:block" />
            <Skeleton className="h-8 w-36" />
          </div>
        ))}
      </div>
    </Card>
  );
}

type DialogState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; role: Role }
  | { type: 'delete'; role: Role }
  | { type: 'permissions'; roleId: string };

export function RolesOverview() {
  const { user: actor } = useAuth();
  const toast = useToast();
  const roles = useRolesList();
  const canReadCatalog = hasPermissions(actor, ['permissions:read']);
  const canCountUsers = hasPermissions(actor, ['users:read']);
  const catalog = usePermissionsCatalog(canReadCatalog);
  const deleteRole = useDeleteRole();
  const deleting = useRef(false);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });

  const list = useMemo(() => sortRoles(roles.data ?? []), [roles.data]);
  const catalogSize = catalog.data?.length;
  const moduleCount = useMemo(() => new Set((catalog.data ?? []).map((p) => p.module)).size, [catalog.data]);
  const customCount = list.filter((r) => !r.isSystem).length;
  const permissionsRole = dialog.type === 'permissions' ? list.find((r) => r.id === dialog.roleId) : undefined;
  const close = () => setDialog({ type: 'none' });

  /** Student has no permission management; locked roles open read-only. */
  /** Needs permissions:read (the modal lists the catalog); Student has no permission management. */
  function manageProps(r: Role) {
    if (r.slug === ROLE_SLUGS.STUDENT || !canReadCatalog) return { onManage: undefined, manageLabel: '' };
    return {
      onManage: () => setDialog({ type: 'permissions', roleId: r.id }),
      manageLabel: rolePolicy.permissionLockReason(actor, r) ? 'View permissions' : 'Manage permissions',
    };
  }

  function confirmDelete() {
    if (dialog.type !== 'delete' || deleting.current) return;
    const { role } = dialog;
    deleting.current = true;
    deleteRole.mutate(role.id, {
      onSuccess: () => {
        toast.success('Role deleted', role.name);
        close();
      },
      onError: (error) => {
        const { code, message } = normalizeApiError(error);
        toast.error('Could not delete role', code === 'ROLE_IN_USE' ? 'This role is still assigned to users. Reassign them first.' : message);
      },
      onSettled: () => {
        deleting.current = false;
      },
    });
  }

  const header = (
    <PageHeader
      title="Role & Permissions"
      description="Define who can do what across SkillBee. Every permission is enforced by the backend on each request."
      actions={
        rolePolicy.canCreate(actor) ? (
          <Button onClick={() => setDialog({ type: 'create' })}>
            <Plus className="size-4" aria-hidden />
            Create role
          </Button>
        ) : null
      }
    />
  );

  let body: ReactNode;
  if (roles.isPending) {
    body = <TableSkeleton />;
  } else if (roles.isError) {
    body = (
      <Card>
        <ErrorState error={roles.error} onRetry={() => roles.refetch()} />
      </Card>
    );
  } else if (!list.length) {
    body = (
      <Card>
        <EmptyState title="No roles defined" />
      </Card>
    );
  } else {
    body = (
      <Card>
        {/* Desktop / tablet table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface-2/60 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              <tr>
                <th scope="col" className="px-5 py-3">Role</th>
                <th scope="col" className="hidden px-4 py-3 xl:table-cell">Description</th>
                <th scope="col" className="px-4 py-3">Users</th>
                <th scope="col" className="px-4 py-3">Permissions</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-5 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-surface-2/50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <RoleIcon role={r} size="sm" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 whitespace-nowrap font-semibold text-ink">
                          {r.name}
                          {r.isSystem ? <Lock className="size-3 text-ink-subtle" aria-label="Protected system role" /> : null}
                        </p>
                        <code className="font-mono text-[11px] text-ink-subtle">{r.slug}</code>
                      </div>
                    </div>
                  </td>
                  <td className="hidden max-w-64 px-4 py-3.5 xl:table-cell">
                    <p className="line-clamp-2 text-xs text-ink-muted">{r.description || '—'}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <UsersCell role={r} enabled={canCountUsers} />
                  </td>
                  <td className="px-4 py-3.5">
                    <PermissionsCell role={r} catalogSize={catalogSize} />
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadges role={r} />
                  </td>
                  <td className="px-5 py-3.5">
                    <RowActions
                      role={r}
                      canCountUsers={canCountUsers}
                      {...manageProps(r)}
                      onEdit={rolePolicy.canEditDetails(actor, r) ? () => setDialog({ type: 'edit', role: r }) : undefined}
                      onDelete={rolePolicy.canDelete(actor, r) ? () => setDialog({ type: 'delete', role: r }) : undefined}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <ul className="divide-y divide-line md:hidden">
          {list.map((r) => (
            <li key={r.id} className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <RoleIcon role={r} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 whitespace-nowrap font-semibold text-ink">
                    {r.name}
                    {r.isSystem ? <Lock className="size-3 text-ink-subtle" aria-label="Protected system role" /> : null}
                  </p>
                  <p className="line-clamp-2 text-xs text-ink-muted">{r.description || r.slug}</p>
                </div>
                <StatusBadges role={r} />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
                <span>
                  Users: <UsersCell role={r} enabled={canCountUsers} />
                </span>
                <PermissionsCell role={r} catalogSize={catalogSize} />
              </div>
              <RowActions
                role={r}
                canCountUsers={canCountUsers}
                {...manageProps(r)}
                onEdit={rolePolicy.canEditDetails(actor, r) ? () => setDialog({ type: 'edit', role: r }) : undefined}
                onDelete={rolePolicy.canDelete(actor, r) ? () => setDialog({ type: 'delete', role: r }) : undefined}
              />
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  return (
    <>
      {header}

      <section aria-label="Role summary" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<ShieldCheck className="size-4" />} label="Total roles" value={roles.isPending ? <Skeleton className="mt-1 h-5 w-8" /> : formatNumber(list.length)} />
        <StatTile icon={<Lock className="size-4" />} label="Protected" value={roles.isPending ? <Skeleton className="mt-1 h-5 w-8" /> : formatNumber(list.length - customCount)} />
        <StatTile icon={<Shapes className="size-4" />} label="Custom" value={roles.isPending ? <Skeleton className="mt-1 h-5 w-8" /> : formatNumber(customCount)} />
        <StatTile
          icon={<Layers className="size-4" />}
          label="Permissions"
          value={
            !canReadCatalog ? (
              '—'
            ) : catalog.isPending ? (
              <Skeleton className="mt-1 h-5 w-14" />
            ) : (
              <>
                {formatNumber(catalogSize)}
                <span className="ml-1 text-xs font-normal text-ink-subtle">in {moduleCount} modules</span>
              </>
            )
          }
        />
      </section>

      {body}

      {permissionsRole ? <PermissionsDialog key={`${permissionsRole.id}-${permissionsRole.updatedAt}`} role={permissionsRole} onClose={close} /> : null}
      {dialog.type === 'create' ? <RoleFormDialog key="create" mode="create" onClose={close} onSaved={(r) => setDialog({ type: 'permissions', roleId: r.id })} /> : null}
      {dialog.type === 'edit' ? <RoleFormDialog key={`edit-${dialog.role.id}`} mode="edit" role={dialog.role} onClose={close} onSaved={close} /> : null}
      <ConfirmDialog
        open={dialog.type === 'delete'}
        title="Delete role?"
        confirmLabel="Delete role"
        loading={deleteRole.isPending}
        onCancel={close}
        onConfirm={confirmDelete}
        description={
          dialog.type === 'delete' ? (
            <p>
              <span className="font-semibold text-ink">{dialog.role.name}</span> will be permanently removed. The backend rejects this if any user still has the role.
            </p>
          ) : null
        }
      />
    </>
  );
}
