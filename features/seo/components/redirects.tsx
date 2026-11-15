'use client';

import { ArrowRight, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/cn';
import { formatDate, formatRelative } from '@/lib/format';
import { normalizeApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { useToast } from '@/providers/toast-provider';
import type { CreateRedirectInput, RedirectListParams, RedirectType, SeoRedirect, UpdateRedirectInput } from '@/types/seo';
import { useCreateRedirect, useDeleteRedirect, useRedirectList, useUpdateRedirect } from '../hooks';

const PAGE_SIZES = [10, 20, 50];

function normalizeLocal(path: string): string {
  let p = path.trim();
  if (!p) return p;
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname + new URL(p).search;
  } catch {
    /* keep as typed */
  }
  if (!p.startsWith('/')) p = `/${p}`;
  return p.replace(/\/+/g, '/');
}

interface RedirectFormState {
  sourcePath: string;
  destinationPath: string;
  redirectType: RedirectType;
  isActive: boolean;
  allowExternal: boolean;
}

function toForm(r?: SeoRedirect | null): RedirectFormState {
  return {
    sourcePath: r?.sourcePath ?? '',
    destinationPath: r?.destinationPath ?? '',
    redirectType: r?.redirectType ?? 301,
    isActive: r?.isActive ?? true,
    allowExternal: r?.allowExternal ?? false,
  };
}

export function RedirectManager() {
  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState<'' | 'true' | 'false'>('');
  const [type, setType] = useState<'' | '301' | '302'>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SeoRedirect | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SeoRedirect | null>(null);

  const debounced = useDebouncedValue(search.trim(), 350);
  const params: RedirectListParams = {
    page,
    limit,
    search: debounced || undefined,
    isActive: isActive === '' ? undefined : isActive === 'true',
    redirectType: type === '' ? undefined : (Number(type) as RedirectType),
  };
  const list = useRedirectList(params);
  const rows = list.data?.data ?? [];
  const filtered = Boolean(debounced || isActive || type);

  function clearAll() {
    setSearch('');
    setIsActive('');
    setType('');
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="Redirect Management"
        description="Manage 301/302 redirects for moved or renamed pages."
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="size-4" aria-hidden />
              New redirect
            </Button>
            <RefreshButton queryKeys={[queryKeys.seo.redirects.lists()]} />
          </div>
        }
      />

      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{filtered ? 'Filtered redirects' : 'All redirects'}</h2>
            <p className="text-xs text-ink-muted">Search matches source or destination path.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search paths" className="pl-9" aria-label="Search redirects" />
            </div>
            <Select value={isActive} onChange={(e) => { setIsActive(e.target.value as typeof isActive); setPage(1); }} aria-label="Filter by status" className="sm:w-36">
              <option value="">Any status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
            <Select value={type} onChange={(e) => { setType(e.target.value as typeof type); setPage(1); }} aria-label="Filter by type" className="sm:w-32">
              <option value="">Any type</option>
              <option value="301">301</option>
              <option value="302">302</option>
            </Select>
            {filtered ? (
              <Button variant="ghost" onClick={clearAll} className="shrink-0">
                <X className="size-4" aria-hidden /> Clear
              </Button>
            ) : null}
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isPending && !rows.length ? (
          <EmptyState
            icon={<ArrowRight className="size-5" aria-hidden />}
            title={filtered ? 'No redirects match these filters' : 'No redirects yet'}
            description={filtered ? 'Try another search or filter.' : 'Create a redirect to preserve links after moving content.'}
            action={filtered ? <Button size="sm" variant="secondary" onClick={clearAll}>Clear filters</Button> : <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>New redirect</Button>}
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Source</th>
                    <th scope="col" className="px-3 py-2.5" aria-hidden>→</th>
                    <th scope="col" className="px-3 py-2.5">Destination</th>
                    <th scope="col" className="px-3 py-2.5">Type</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Hits</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Created</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3.5 pl-5 pr-3"><Skeleton className="h-3.5 w-48" /></td>
                          <td className="px-3 py-3.5" />
                          <td className="px-3 py-3.5"><Skeleton className="h-3.5 w-48" /></td>
                          <td className="px-3 py-3.5"><Skeleton className="h-5 w-12" /></td>
                          <td className="px-3 py-3.5"><Skeleton className="h-5 w-16" /></td>
                          <td className="hidden px-3 py-3.5 lg:table-cell"><Skeleton className="h-3.5 w-10" /></td>
                          <td className="hidden px-3 py-3.5 lg:table-cell"><Skeleton className="h-3.5 w-24" /></td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((r) => (
                        <tr key={r.id} className="group align-top transition-colors hover:bg-surface-2/50">
                          <td className="max-w-56 py-3.5 pl-5 pr-3">
                            <span className="block break-all font-mono text-xs text-ink">{r.sourcePath}</span>
                          </td>
                          <td className="w-px px-3 py-3.5 text-ink-subtle"><ArrowRight className="size-3.5" aria-hidden /></td>
                          <td className="max-w-56 py-3.5 pl-3 pr-3">
                            <span className="block break-all font-mono text-xs text-ink-muted">{r.destinationPath}</span>
                            {r.allowExternal ? <span className="mt-0.5 block text-[10px] text-ink-subtle">external allowed</span> : null}
                          </td>
                          <td className="w-px px-3 py-3.5"><Badge tone={r.redirectType === 301 ? 'info' : 'warning'}>{r.redirectType}</Badge></td>
                          <td className="w-px px-3 py-3.5">
                            <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
                          </td>
                          <td className="hidden w-px px-3 py-3.5 text-xs tabular-nums text-ink-muted lg:table-cell" title={r.lastAccessedAt ? `Last hit ${formatDate(r.lastAccessedAt)}` : 'Never hit'}>
                            {r.hitCount.toLocaleString('en-IN')}
                          </td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted lg:table-cell" title={formatDate(r.createdAt)}>
                            {formatDate(r.createdAt)}
                            <span className="block text-[11px] text-ink-subtle">{formatRelative(r.createdAt)}</span>
                          </td>
                          <td className="w-px py-3 pl-3 pr-5 text-right">
                            <div className="flex justify-end gap-1">
                              <button type="button" onClick={() => { setEditing(r); setFormOpen(true); }} aria-label={`Edit redirect ${r.sourcePath}`} className="rounded-md p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink">
                                <Pencil className="size-4" aria-hidden />
                              </button>
                              <button type="button" onClick={() => setDeleteTarget(r)} aria-label={`Delete redirect ${r.sourcePath}`} className="rounded-md p-1.5 text-ink-muted hover:bg-surface-2 hover:text-danger">
                                <Trash2 className="size-4" aria-hidden />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            <ul className={cn('divide-y divide-line md:hidden', list.isPlaceholderData && 'opacity-60')}>
              {list.isPending
                ? Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="space-y-2 p-4">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </li>
                  ))
                : rows.map((r) => (
                    <li key={r.id} className="space-y-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={r.redirectType === 301 ? 'info' : 'warning'}>{r.redirectType}</Badge>
                        <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
                        <span className="text-[11px] text-ink-subtle">{r.hitCount} hits</span>
                      </div>
                      <p className="break-all font-mono text-xs text-ink">{r.sourcePath}</p>
                      <p className="flex items-center gap-1 break-all font-mono text-xs text-ink-muted">
                        <ArrowRight className="size-3 shrink-0" aria-hidden /> {r.destinationPath}
                      </p>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="secondary" onClick={() => { setEditing(r); setFormOpen(true); }}>
                          <Pencil className="size-3.5" aria-hidden /> Edit
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setDeleteTarget(r)}>
                          <Trash2 className="size-3.5" aria-hidden /> Delete
                        </Button>
                      </div>
                    </li>
                  ))}
            </ul>
          </>
        )}
        <Pagination
          meta={list.data?.pagination}
          onPageChange={setPage}
          disabled={list.isFetching}
          pageSizeOptions={PAGE_SIZES}
          onPageSizeChange={(size) => { setLimit(size); setPage(1); }}
        />
      </Card>

      <RedirectFormDialog
        key={editing?.id ?? 'new'}
        open={formOpen}
        redirect={editing}
        onClose={() => setFormOpen(false)}
      />
      {deleteTarget ? <RedirectDeleteDialog redirect={deleteTarget} onClose={() => setDeleteTarget(null)} /> : null}
    </>
  );
}

// ---------------- Create / Edit ----------------

function RedirectFormDialog({ open, redirect, onClose }: { open: boolean; redirect: SeoRedirect | null; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateRedirect();
  const update = useUpdateRedirect();
  const [v, setV] = useState<RedirectFormState>(() => toForm(redirect));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [confirming, setConfirming] = useState(false);
  const pending = create.isPending || update.isPending;
  const isEdit = Boolean(redirect);

  const warnings = useMemo(() => {
    const list: string[] = [];
    const src = normalizeLocal(v.sourcePath);
    const dst = normalizeLocal(v.destinationPath);
    if (src && dst && src === dst) list.push('Source and destination are identical — this redirect goes nowhere.');
    if (dst.startsWith(src) && src !== dst && dst.length > src.length) {
      list.push('Destination starts with the source path — check for accidental loops.');
    }
    if (/^https?:\/\//i.test(v.destinationPath.trim()) && !v.allowExternal) {
      list.push('External destination requires "Allow external" to be enabled.');
    }
    return list;
  }, [v.sourcePath, v.destinationPath, v.allowExternal]);

  function set<K extends keyof RedirectFormState>(key: K, value: RedirectFormState[K]) {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    const src = normalizeLocal(v.sourcePath);
    const dst = v.destinationPath.trim();
    if (!src || !src.startsWith('/')) next.sourcePath = 'Source must be a path starting with /.';
    if (!dst) next.destinationPath = 'Destination is required.';
    else if (!dst.startsWith('/') && !/^https?:\/\//i.test(dst)) next.destinationPath = 'Destination must be a path (/…) or http(s) URL.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || pending) return;
    setConfirming(true);
  }

  function confirm() {
    if (pending) return;
    const payload: CreateRedirectInput = {
      sourcePath: normalizeLocal(v.sourcePath),
      destinationPath: v.destinationPath.trim(),
      redirectType: v.redirectType,
      isActive: v.isActive,
      allowExternal: v.allowExternal,
    };
    const onErr = (err: unknown) => {
      setConfirming(false);
      toast.error(isEdit ? 'Could not update redirect' : 'Could not create redirect', normalizeApiError(err).message);
    };
    if (isEdit && redirect) {
      const input: UpdateRedirectInput = payload;
      update.mutate({ id: redirect.id, input }, {
        onSuccess: () => {
          toast.success('Redirect updated');
          setConfirming(false);
          onClose();
        },
        onError: onErr,
      });
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          toast.success('Redirect created', `${payload.sourcePath} → ${payload.destinationPath}`);
          setConfirming(false);
          onClose();
        },
        onError: onErr,
      });
    }
  }

  function handleClose() {
    if (pending) return;
    onClose();
  }

  return (
    <>
      <Dialog
        open={open && !confirming}
        onClose={handleClose}
        title={isEdit ? 'Edit redirect' : 'New redirect'}
        description={isEdit ? `Created ${formatDate(redirect!.createdAt)} · ${redirect!.hitCount} hits` : '301 is permanent (SEO-safe), 302 is temporary.'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={handleClose} disabled={pending} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2 disabled:opacity-60">
              Cancel
            </button>
            <button type="submit" form="redirect-form" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create redirect'}
            </button>
          </div>
        }
      >
        <form id="redirect-form" onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
            <Field id="redir-source" label="Source path" error={errors.sourcePath} hint="The old URL path, e.g. /courses/old-slug">
              <Input id="redir-source" value={v.sourcePath} onChange={(e) => set('sourcePath', e.target.value)} placeholder="/old-path" className="font-mono text-[13px]" />
            </Field>
            <ArrowRight className="mt-5 hidden size-4 text-ink-subtle sm:block" aria-hidden />
            <Field id="redir-dest" label="Destination" error={errors.destinationPath} hint="Internal path or full http(s) URL">
              <Input id="redir-dest" value={v.destinationPath} onChange={(e) => set('destinationPath', e.target.value)} placeholder="/new-path or https://…" className="font-mono text-[13px]" />
            </Field>
          </div>

          {warnings.length ? (
            <ul className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              {warnings.map((w) => <li key={w}>⚠ {w}</li>)}
            </ul>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="redir-type" label="Redirect type">
              <Select id="redir-type" value={String(v.redirectType)} onChange={(e) => set('redirectType', Number(e.target.value) as RedirectType)}>
                <option value="301">301 — Permanent</option>
                <option value="302">302 — Temporary</option>
              </Select>
            </Field>
            <div className="flex flex-col justify-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={v.isActive} onChange={(e) => set('isActive', e.target.checked)} className="size-4 rounded border-line text-primary focus:ring-primary" />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={v.allowExternal} onChange={(e) => set('allowExternal', e.target.checked)} className="size-4 rounded border-line text-primary focus:ring-primary" />
                Allow external destination
              </label>
            </div>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={confirming}
        onClose={() => !pending && setConfirming(false)}
        title={isEdit ? 'Save redirect changes?' : 'Create this redirect?'}
        description="The backend validates loops, duplicates and destination safety."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-2 disabled:opacity-60">
              Go back
            </button>
            <button type="button" onClick={confirm} disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create redirect'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 font-mono text-xs">
            <span className="break-all text-ink">{normalizeLocal(v.sourcePath)}</span>
            <ArrowRight className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
            <span className="break-all text-ink-muted">{v.destinationPath}</span>
          </div>
          <p className="text-xs text-ink-muted">
            {v.redirectType === 301 ? '301 permanent — search engines transfer ranking signals to the destination.' : '302 temporary — no ranking transfer; use for short-term moves.'}
            {!v.isActive ? ' This redirect will be saved as inactive.' : ''}
          </p>
        </div>
      </Dialog>
    </>
  );
}

// ---------------- Delete ----------------

function RedirectDeleteDialog({ redirect, onClose }: { redirect: SeoRedirect; onClose: () => void }) {
  const toast = useToast();
  const remove = useDeleteRedirect();

  function confirm() {
    remove.mutate(redirect.id, {
      onSuccess: () => {
        toast.success('Redirect deleted', 'The redirect was deactivated and removed from the list.');
        onClose();
      },
      onError: (e) => toast.error('Could not delete redirect', normalizeApiError(e).message),
    });
  }

  return (
    <ConfirmDialog
      open
      title="Delete this redirect?"
      tone="danger"
      confirmLabel="Delete redirect"
      loading={remove.isPending}
      onCancel={onClose}
      onConfirm={confirm}
      description={
        <div className="space-y-3">
          <div className="break-all rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 font-mono text-xs">
            <span className="text-ink">{redirect.sourcePath}</span>
            <span className="mx-1.5 text-ink-subtle">→</span>
            <span className="text-ink-muted">{redirect.destinationPath}</span>
          </div>
          <p>
            This is a <span className="font-medium text-ink">soft delete</span>: the redirect is deactivated and hidden from
            the list. The old URL will stop redirecting — visitors and crawlers will hit a 404 unless another rule matches.
          </p>
        </div>
      }
    />
  );
}
