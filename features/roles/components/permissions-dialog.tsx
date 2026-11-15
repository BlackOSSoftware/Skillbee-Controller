'use client';

import { CircleCheck, CircleMinus, Crown, Eye, Lock, Search, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/cn';
import { normalizeApiError } from '@/lib/api-error';
import { titleCase } from '@/lib/format';
import { hasPermissions, ROLE_SLUGS } from '@/lib/roles';
import { useToast } from '@/providers/toast-provider';
import type { Permission, Role } from '@/types/users';
import { useAssignPermissions, usePermissionsCatalog } from '../hooks';
import { rolePolicy } from '../policy';
import { Coverage, RoleIcon } from './role-visuals';

interface PermissionsDialogProps {
  role: Role;
  onClose: () => void;
}

type FooterMode = 'idle' | 'confirm-save' | 'confirm-discard';
type ViewFilter = 'all' | 'granted';

const GROUP_GRID = 'grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]';

/** Mount with a `key` per role so the draft starts from the saved permissions. */
export function PermissionsDialog({ role, onClose }: PermissionsDialogProps) {
  const { user: actor } = useAuth();
  const toast = useToast();
  const canReadCatalog = hasPermissions(actor, ['permissions:read']);
  const catalogQuery = usePermissionsCatalog(canReadCatalog, { fresh: true });
  const assign = useAssignPermissions();
  // isPending only updates after re-render; this blocks a second save fired in the same tick
  const inFlight = useRef(false);

  const isSuper = role.slug === ROLE_SLUGS.SUPER_ADMIN;
  const lockReason = rolePolicy.permissionLockReason(actor, role);
  const readOnly = Boolean(lockReason);
  const [draft, setDraft] = useState<Set<string>>(() => new Set(role.permissions));
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewFilter>(readOnly && !isSuper ? 'granted' : 'all');
  const [footerMode, setFooterMode] = useState<FooterMode>('idle');

  // Only trust the catalog after the backend re-confirmed access for this open
  const verified = catalogQuery.isFetchedAfterMount && !catalogQuery.isError;
  const catalog = useMemo(() => (verified ? (catalogQuery.data ?? []) : []), [verified, catalogQuery.data]);

  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of catalog) {
      const mod = p.module || 'general';
      map.set(mod, [...(map.get(mod) ?? []), p]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  const assignableCodes = useMemo(
    () => (readOnly ? [] : catalog.filter((p) => rolePolicy.isModuleAssignable(role, p.module)).map((p) => p.code)),
    [catalog, readOnly, role]
  );

  const original = useMemo(() => new Set(role.permissions), [role.permissions]);
  const isGranted = (code: string) => isSuper || (readOnly ? original.has(code) : draft.has(code));

  const needle = query.trim().toLowerCase();
  const visibleGroups = groups
    .map(([mod, perms]) => {
      let list = needle ? perms.filter((p) => `${p.name} ${p.code} ${mod}`.toLowerCase().includes(needle)) : perms;
      if (view === 'granted') list = list.filter((p) => isGranted(p.code));
      return [mod, list] as const;
    })
    .filter(([, perms]) => perms.length > 0);

  const added = [...draft].filter((c) => !original.has(c));
  const removed = [...original].filter((c) => !draft.has(c));
  const dirty = !readOnly && added.length + removed.length > 0;
  const grantedTotal = isSuper ? catalog.length : readOnly ? original.size : draft.size;

  function toggle(codes: string[], on: boolean) {
    setFooterMode('idle');
    setDraft((prev) => {
      const next = new Set(prev);
      codes.forEach((c) => (on ? next.add(c) : next.delete(c)));
      return next;
    });
  }

  function requestClose() {
    if (assign.isPending) return;
    if (dirty) setFooterMode('confirm-discard');
    else onClose();
  }

  function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    assign.mutate(
      { id: role.id, permissions: [...draft] },
      {
        onSuccess: (updated) => {
          toast.success('Permissions updated', `${updated.name} now has ${updated.permissions.length} permission${updated.permissions.length === 1 ? '' : 's'}.`);
          onClose();
        },
        onError: (error) => {
          setFooterMode('idle');
          toast.error('Could not save permissions', normalizeApiError(error).message);
        },
        onSettled: () => {
          inFlight.current = false;
        },
      }
    );
  }

  const toolbar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter permissions"
          className="h-9 pl-9"
          aria-label="Filter permissions"
        />
      </div>
      {!isSuper ? (
        <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5" role="group" aria-label="Show permissions">
          {(['all', 'granted'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                view === v ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              )}
            >
              {v === 'all' ? 'All' : 'Granted only'}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
        <span className="mr-auto text-xs text-ink-muted sm:mr-2">
          <span className="font-semibold text-ink">{grantedTotal}</span> of {catalog.length} granted
        </span>
        {!readOnly ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => toggle(assignableCodes, true)} disabled={assign.isPending}>
              Select all
            </Button>
            <Button size="sm" variant="secondary" onClick={() => toggle(assignableCodes, false)} disabled={assign.isPending}>
              Deselect all
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );

  const editorReady = canReadCatalog && verified && catalog.length > 0;

  const footer = readOnly || !editorReady ? (
    <>
      {readOnly && editorReady ? (
        <p className="mr-auto flex items-center gap-1.5 self-center text-xs text-ink-muted">
          <Eye className="size-3.5" aria-hidden />
          View only
        </p>
      ) : null}
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    </>
  ) : footerMode === 'confirm-save' ? (
    <>
      <p className="mr-auto self-center text-sm text-ink">
        Apply <span className="font-semibold text-success">+{added.length}</span>{' '}
        <span className="font-semibold text-danger">−{removed.length}</span> to {role.name}?
      </p>
      <Button variant="secondary" onClick={() => setFooterMode('idle')} disabled={assign.isPending}>
        Back
      </Button>
      <Button onClick={save} loading={assign.isPending}>
        Confirm & save
      </Button>
    </>
  ) : footerMode === 'confirm-discard' ? (
    <>
      <p className="mr-auto self-center text-sm text-ink">Discard unsaved permission changes?</p>
      <Button variant="secondary" onClick={() => setFooterMode('idle')}>
        Keep editing
      </Button>
      <Button variant="danger-solid" onClick={onClose}>
        Discard & close
      </Button>
    </>
  ) : (
    <>
      <p className="mr-auto self-center text-xs text-ink-muted">
        {dirty ? (
          <>
            Unsaved: <span className="font-semibold text-success">+{added.length}</span>{' '}
            <span className="font-semibold text-danger">−{removed.length}</span>
          </>
        ) : (
          'No changes yet'
        )}
      </p>
      <Button variant="ghost" onClick={() => setDraft(new Set(role.permissions))} disabled={!dirty}>
        Reset
      </Button>
      <Button onClick={() => setFooterMode('confirm-save')} disabled={!dirty}>
        Save permissions
      </Button>
    </>
  );

  let content;
  if (!canReadCatalog) {
    content = (
      <EmptyState
        icon={<Lock className="size-5" aria-hidden />}
        title="You do not have permission to view permissions"
        description="Ask a Super Admin to grant “Read permissions” to your role."
      />
    );
  } else if (catalogQuery.isError) {
    content = <ErrorState error={catalogQuery.error} onRetry={() => catalogQuery.refetch()} />;
  } else if (!verified) {
    content = <LoadingState label="Loading permissions…" />;
  } else if (!catalog.length) {
    content = <EmptyState title="No permissions returned by the API" />;
  } else if (visibleGroups.length === 0) {
    content = (
      <EmptyState
        icon={<Search className="size-5" aria-hidden />}
        title={view === 'granted' && !needle ? 'This role has no permissions' : 'No permissions match your filter'}
        action={
          needle || view === 'granted' ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setQuery('');
                setView('all');
              }}
            >
              <X className="size-3.5" aria-hidden />
              Show all
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    content = (
      <div className={GROUP_GRID}>
        {visibleGroups.map(([mod, perms]) => {
          const assignable = !readOnly && rolePolicy.isModuleAssignable(role, mod);
          const allCodes = (groups.find(([m]) => m === mod)?.[1] ?? perms).map((p) => p.code);
          const visibleCodes = perms.map((p) => p.code);
          const grantedCount = allCodes.filter(isGranted).length;
          const visibleAll = visibleCodes.every(isGranted);
          const visibleSome = visibleCodes.some(isGranted);
          const teachingLocked = !readOnly && !assignable;
          return (
            <fieldset
              key={mod}
              className={cn('rounded-xl border border-line bg-surface-2/40 p-3.5', teachingLocked && 'opacity-60')}
              disabled={!assignable || assign.isPending}
            >
              <legend className="sr-only">{titleCase(mod)} permissions</legend>
              <div className="flex items-center gap-2.5">
                {assignable ? (
                  <input
                    type="checkbox"
                    className="size-4 rounded accent-primary"
                    checked={visibleAll}
                    ref={(el) => {
                      if (el) el.indeterminate = visibleSome && !visibleAll;
                    }}
                    onChange={(e) => toggle(visibleCodes, e.target.checked)}
                    aria-label={`Select all ${mod} permissions`}
                  />
                ) : null}
                <p className="flex-1 text-sm font-semibold text-ink">{titleCase(mod)}</p>
                <Badge tone={grantedCount === allCodes.length ? 'success' : grantedCount ? 'brand' : 'neutral'}>
                  {grantedCount}/{allCodes.length}
                </Badge>
              </div>
              <div className="mt-2.5">
                <Coverage value={grantedCount} max={allCodes.length} />
              </div>
              {teachingLocked ? <p className="mt-2 text-[11px] text-ink-subtle">Not a teaching permission group.</p> : null}
              <ul className="mt-2.5 space-y-0.5">
                {perms.map((p) => {
                  const granted = isGranted(p.code);
                  const changed = !readOnly && granted !== original.has(p.code);
                  if (!assignable) {
                    return (
                      <li key={p.code} className="flex items-center gap-2.5 rounded-md px-1.5 py-1 text-xs" title={p.code}>
                        {granted ? (
                          <CircleCheck className="size-4 shrink-0 text-success" aria-label="Granted" />
                        ) : (
                          <CircleMinus className="size-4 shrink-0 text-ink-subtle" aria-label="Not granted" />
                        )}
                        <span className={cn('flex-1 truncate', granted ? 'text-ink' : 'text-ink-subtle line-through decoration-line')}>{p.name}</span>
                      </li>
                    );
                  }
                  return (
                    <li key={p.code}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 text-xs hover:bg-surface" title={p.code}>
                        <input type="checkbox" className="size-3.5 rounded accent-primary" checked={granted} onChange={(e) => toggle([p.code], e.target.checked)} />
                        <span className={cn('flex-1 truncate', granted ? 'text-ink' : 'text-ink-muted')}>{p.name}</span>
                        {changed ? (
                          <span className={cn('text-[10px] font-semibold', granted ? 'text-success' : 'text-danger')}>{granted ? 'Added' : 'Removed'}</span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}
      </div>
    );
  }

  return (
    <Dialog
      open
      size="xl"
      onClose={requestClose}
      busy={assign.isPending}
      title={`${readOnly ? 'View' : 'Manage'} permissions · ${role.name}`}
      description={role.description || undefined}
      toolbar={editorReady ? toolbar : undefined}
      footer={footer}
    >
      {readOnly && editorReady ? (
        <div
          className={cn(
            'mb-4 flex items-center gap-3 rounded-xl border px-4 py-3',
            isSuper ? 'border-primary/25 bg-primary/5' : 'border-line bg-surface-2/60'
          )}
        >
          {isSuper ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Crown className="size-4" aria-hidden />
            </span>
          ) : (
            <RoleIcon role={role} size="sm" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{isSuper ? 'Full access' : 'Read-only view'}</p>
            <p className="text-xs text-ink-muted">{lockReason}</p>
          </div>
          <Badge tone={isSuper ? 'brand' : 'neutral'}>
            <Lock className="mr-1 size-3" aria-hidden />
            Protected
          </Badge>
        </div>
      ) : null}
      {content}
    </Dialog>
  );
}
