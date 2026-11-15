'use client';

import { ArrowDown, ArrowUp, CircleHelp, Pencil, Save, Star, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { KpiCard, type KpiTone } from '@/components/ui/kpi-card';
import { ActionMenu, type MenuItem } from '@/components/ui/menu';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/cn';
import { formatDate, formatRelative } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import { faqsService } from '@/services/faqs.service';
import type { Faq, FaqListParams, FaqStatus } from '@/types/faqs';
import { FAQ_STATUS_LABEL, FAQ_STATUSES, FaqStatusBadge } from '../display';
import { FAQ_STATUSES as STAT_KEYS, useFaqList, useFaqStats, useReorderFaqs, type FaqStatKey } from '../hooks';
import { useFaqCategories } from '../hooks-categories';
import { FaqFormDialog, FaqStatusDialog } from './faq-form-dialog';
import { FaqDeleteDialog as DeleteDialog } from './faq-actions';

const PAGE_SIZES = [10, 20, 50];

const STAT_CARD: Record<FaqStatKey, { label: string; hint: string; icon: typeof CircleHelp; tone: KpiTone }> = {
  all: { label: 'Total FAQs', hint: 'Excludes deleted', icon: CircleHelp, tone: 'purple' },
  draft: { label: 'Drafts', hint: 'Not public', icon: Pencil, tone: 'amber' },
  published: { label: 'Published', hint: 'Live on site', icon: Star, tone: 'teal' },
};

/** Strip HTML tags for a compact preview. */
function answerPreview(html: string, max = 90): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function FaqsManagement() {
  const stats = useFaqStats();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FaqStatus | ''>('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [reorderMode, setReorderMode] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ faq: Faq; target: FaqStatus } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Faq | null>(null);

  const categories = useFaqCategories();
  const debounced = useDebouncedValue(search.trim(), 350);
  const params: FaqListParams = {
    page,
    limit,
    search: debounced || undefined,
    status: status || undefined,
    category: category || undefined,
  };
  const list = useFaqList(params);
  const rows = list.data?.data ?? [];
  const filtered = Boolean(debounced || status || category);

  function applyStat(key: FaqStatKey) {
    setStatus(key === 'all' ? '' : key);
    setPage(1);
  }
  const statActive = (key: FaqStatKey) => (key === 'all' ? !status : status === key);

  function clearAll() {
    setSearch('');
    setStatus('');
    setCategory('');
    setPage(1);
  }

  const menu = (f: Faq): MenuItem[] => [
    { key: 'edit', label: 'Edit FAQ', icon: <Pencil className="size-4" />, onSelect: () => { setEditing(f); setFormOpen(true); } },
    ...FAQ_STATUSES.filter((s) => s !== f.status).map((s) => ({
      key: `status-${s}`,
      label: s === 'published' ? 'Publish…' : 'Unpublish…',
      icon: <Star className="size-4" />,
      onSelect: () => setStatusDialog({ faq: f, target: s }),
    })),
    { key: 'delete', label: 'Delete FAQ…', icon: <Trash2 className="size-4" />, tone: 'danger', onSelect: () => setDeleteTarget(f) },
  ];

  return (
    <>
      <PageHeader
        title="FAQs"
        description="Manage website and course FAQs."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setReorderMode(true)} disabled={reorderMode}>
              Reorder
            </Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Pencil className="size-4" aria-hidden />
              New FAQ
            </Button>
            <RefreshButton queryKeys={[queryKeys.faqs.all]} />
          </div>
        }
      />

      <section aria-label="FAQ overview" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STAT_KEYS.map((key) => {
          const meta = STAT_CARD[key];
          const Icon = meta.icon;
          return (
            <KpiCard
              key={key}
              label={meta.label}
              hint={meta.hint}
              icon={Icon}
              tone={meta.tone}
              value={stats[key].value}
              isLoading={stats[key].isLoading}
              error={stats[key].error}
              active={statActive(key)}
              onClick={() => applyStat(key)}
            />
          );
        })}
      </section>

      {reorderMode ? (
        <ReorderPanel onClose={() => setReorderMode(false)} />
      ) : (
        <Card className="min-w-0">
          <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">{filtered ? 'Filtered FAQs' : 'All FAQs'}</h2>
              <p className="text-xs text-ink-muted">Ordered by display order, then newest first.</p>
            </div>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1 lg:max-w-xs">
                <CircleHelp className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
                <Input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search questions or answers" className="pl-9" aria-label="Search FAQs" />
              </div>
              <Select value={status} onChange={(e) => { setStatus(e.target.value as FaqStatus | ''); setPage(1); }} aria-label="Filter by status" className="lg:w-40">
                <option value="">Any status</option>
                {FAQ_STATUSES.map((s) => (
                  <option key={s} value={s}>{FAQ_STATUS_LABEL[s]}</option>
                ))}
              </Select>
              <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Filter by category" className="lg:w-44">
                <option value="">Any category</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              {filtered ? (
                <Button variant="ghost" onClick={clearAll} className="shrink-0">
                  <X className="size-4" aria-hidden />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : !list.isPending && !rows.length ? (
            <EmptyState
              icon={<CircleHelp className="size-5" aria-hidden />}
              title={filtered ? 'No FAQs match these filters' : 'No FAQs yet'}
              description={filtered ? 'Try another search, status or category.' : 'Create your first FAQ to help learners.'}
              action={
                filtered ? (
                  <Button size="sm" variant="secondary" onClick={clearAll}>Clear filters</Button>
                ) : (
                  <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>New FAQ</Button>
                )
              }
            />
          ) : (
            <>
              <div className="relative hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    <tr>
                      <th scope="col" className="py-2.5 pl-5 pr-3 w-10">Order</th>
                      <th scope="col" className="px-3 py-2.5">Question</th>
                      <th scope="col" className="hidden px-3 py-2.5 md:table-cell">Category</th>
                      <th scope="col" className="px-3 py-2.5">Status</th>
                      <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Updated</th>
                      <th scope="col" className="py-2.5 pl-3 pr-5"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                    {list.isPending
                      ? Array.from({ length: 6 }).map((_, i) => (
                          <tr key={i}>
                            <td className="py-3.5 pl-5 pr-3"><Skeleton className="h-3.5 w-6" /></td>
                            <td className="px-3 py-3.5"><Skeleton className="h-3.5 w-72" /><Skeleton className="mt-1.5 h-3 w-96" /></td>
                            <td className="hidden px-3 py-3.5 md:table-cell"><Skeleton className="h-3.5 w-20" /></td>
                            <td className="px-3 py-3.5"><Skeleton className="h-5 w-20" /></td>
                            <td className="hidden px-3 py-3.5 lg:table-cell"><Skeleton className="h-3.5 w-24" /></td>
                            <td className="py-3.5 pl-3 pr-5" />
                          </tr>
                        ))
                      : rows.map((f) => (
                          <tr key={f.id} className="group align-top transition-colors hover:bg-surface-2/50">
                            <td className="py-3.5 pl-5 pr-3 text-xs tabular-nums text-ink-subtle">{f.displayOrder}</td>
                            <td className="w-full min-w-48 max-w-0 px-3 py-3.5">
                              <button type="button" onClick={() => { setEditing(f); setFormOpen(true); }} className="block text-left">
                                <span className="flex items-center gap-1.5 font-medium text-ink group-hover:text-primary">
                                  {f.isFeatured ? <Star className="size-3.5 fill-amber-400 text-amber-400" aria-label="Featured" /> : null}
                                  <span className="line-clamp-1">{f.question}</span>
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-ink-muted">{answerPreview(f.answer)}</span>
                              </button>
                            </td>
                            <td className="hidden w-px px-3 py-3.5 text-xs text-ink-muted md:table-cell">{f.category || 'general'}</td>
                            <td className="w-px px-3 py-3.5"><FaqStatusBadge status={f.status} /></td>
                            <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted lg:table-cell" title={formatDate(f.updatedAt)}>
                              {formatDate(f.updatedAt)}
                              <span className="block text-[11px] text-ink-subtle">{formatRelative(f.updatedAt)}</span>
                            </td>
                            <td className="w-px py-3 pl-3 pr-5 text-right">
                              <ActionMenu label={`Actions for FAQ: ${f.question}`} items={menu(f)} />
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
                  : rows.map((f) => (
                      <li key={f.id} className="flex items-start gap-3 p-4">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <CircleHelp className="size-4" aria-hidden />
                        </span>
                        <button type="button" onClick={() => { setEditing(f); setFormOpen(true); }} className="min-w-0 flex-1 space-y-1 text-left">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-ink">{f.question}</span>
                            <FaqStatusBadge status={f.status} />
                          </span>
                          <span className="block truncate text-xs text-ink-muted">{answerPreview(f.answer, 70)}</span>
                          <span className="block text-[11px] text-ink-subtle">
                            {f.category || 'general'} · order {f.displayOrder} · {formatDate(f.updatedAt)}
                          </span>
                        </button>
                        <ActionMenu label={`Actions for FAQ: ${f.question}`} items={menu(f)} />
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
      )}

      <FaqFormDialog
        key={editing?.id ?? 'new'}
        open={formOpen}
        faq={editing}
        onClose={() => setFormOpen(false)}
        onDone={() => setPage(1)}
      />
      {statusDialog ? (
        <FaqStatusDialog faq={statusDialog.faq} target={statusDialog.target} onClose={() => setStatusDialog(null)} />
      ) : null}
      {deleteTarget ? <DeleteDialog faq={deleteTarget} onClose={() => setDeleteTarget(null)} /> : null}
    </>
  );
}

// ---------------- Reorder ----------------

/** Loads the full FAQ set (backend reorder needs every orderedId), moves items, saves once. */
function ReorderPanel({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const reorder = useReorderFaqs();
  const [items, setItems] = useState<Pick<Faq, 'id' | 'question' | 'status' | 'displayOrder'>[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loadTick, setLoadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const first = await faqsService.list({ page: 1, limit: 100 });
        const allRows = [...first.data];
        const totalPages = first.pagination.totalPages;
        for (let p = 2; p <= Math.min(totalPages, 5); p += 1) {
          const res = await faqsService.list({ page: p, limit: 100 });
          allRows.push(...res.data);
        }
        if (!cancelled) {
          setItems(allRows.slice(0, 500).map((f) => ({ id: f.id, question: f.question, status: f.status, displayOrder: f.displayOrder })));
        }
      } catch (e) {
        if (!cancelled) setLoadError(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTick]);

  function move(index: number, dir: -1 | 1) {
    setItems((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  function save() {
    if (!items || reorder.isPending) return;
    reorder.mutate(
      items.map((f) => f.id),
      {
        onSuccess: (res) => {
          toast.success('Order saved', `${res.updated} FAQs reordered.`);
          onClose();
        },
        onError: (e) => toast.error('Could not save order', normalizeApiError(e).message),
      }
    );
  }

  return (
    <Card className="min-w-0">
      <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">Reorder FAQs</h2>
          <p className="text-xs text-ink-muted">Move FAQs up or down — the new order is saved for the whole list, not just this page.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={onClose} disabled={reorder.isPending}>
            <X className="size-4" aria-hidden />
            Cancel
          </Button>
          <Button onClick={save} disabled={!items || reorder.isPending}>
            <Save className="size-4" aria-hidden />
            {reorder.isPending ? 'Saving…' : 'Save order'}
          </Button>
        </div>
      </div>

      {loadError ? (
        <ErrorState error={loadError} onRetry={() => { setLoadError(null); setItems(null); setLoadTick((t) => t + 1); }} />
      ) : !items ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !items.length ? (
        <EmptyState icon={<CircleHelp className="size-5" aria-hidden />} title="No FAQs to reorder" description="Create FAQs first." />
      ) : (
        <ol className="divide-y divide-line">
          {items.map((f, i) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-8 shrink-0 text-xs tabular-nums text-ink-subtle">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink" title={f.question}>
                {f.question}
              </span>
              <FaqStatusBadge status={f.status} />
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move "${f.question}" up`}
                  className="rounded-md p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                >
                  <ArrowUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  aria-label={`Move "${f.question}" down`}
                  className="rounded-md p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                >
                  <ArrowDown className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
