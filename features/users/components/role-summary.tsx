'use client';

import { KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { hasPermissions, ROLE_SLUGS } from '@/lib/roles';
import type { Role } from '@/types/users';
import { usePermissionsCatalog } from '../hooks';

const MAX_PER_MODULE = 4;

/** Role description and grouped permissions, shown before saving a user. */
export function RoleSummary({ role }: { role: Role | undefined }) {
  const { user } = useAuth();
  const canReadCatalog = hasPermissions(user, ['permissions:read']);
  const catalog = usePermissionsCatalog(canReadCatalog);

  const grouped = useMemo(() => {
    if (!role) return [];
    const names = new Map((catalog.data ?? []).map((p) => [p.code, p]));
    const groups = new Map<string, string[]>();
    for (const code of role.permissions) {
      const meta = names.get(code);
      const mod = meta?.module || code.split(/[.:]/)[0] || 'general';
      groups.set(mod, [...(groups.get(mod) ?? []), meta?.name ?? code]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [role, catalog.data]);

  if (!role) {
    return (
      <div className="rounded-xl border border-dashed border-line p-4 text-xs text-ink-muted">
        Select a role to see what this user will be able to do.
      </div>
    );
  }

  const isSuper = role.slug === ROLE_SLUGS.SUPER_ADMIN;
  // Any non-student role can sign in to the admin console.
  const consoleAccess = role.slug !== ROLE_SLUGS.STUDENT;

  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {isSuper ? <ShieldAlert className="size-[18px]" aria-hidden /> : <ShieldCheck className="size-[18px]" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">{role.name}</p>
            {role.isSystem ? <Badge tone="brand">System role</Badge> : null}
            {consoleAccess ? <Badge tone="accent">Admin console access</Badge> : null}
          </div>
          {role.description ? <p className="mt-0.5 text-xs text-ink-muted">{role.description}</p> : null}
        </div>
      </div>

      {isSuper ? (
        <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          Super Admin bypasses all permission checks and has full system access.
        </p>
      ) : (
        <div className="mt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink">
            <KeyRound className="size-3.5 text-ink-subtle" aria-hidden />
            {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
          </p>
          {canReadCatalog && catalog.isPending ? (
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ) : grouped.length ? (
            <div className="grid max-h-44 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {grouped.map(([mod, perms]) => (
                <div key={mod} className="rounded-lg border border-line bg-surface p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">{mod}</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
                    {perms.slice(0, MAX_PER_MODULE).map((p) => (
                      <li key={p} className="truncate">
                        {p}
                      </li>
                    ))}
                    {perms.length > MAX_PER_MODULE ? (
                      <li className="text-ink-subtle">+{perms.length - MAX_PER_MODULE} more</li>
                    ) : null}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-muted">This role has no explicit permissions.</p>
          )}
        </div>
      )}
    </div>
  );
}
