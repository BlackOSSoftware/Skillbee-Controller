'use client';

import { Archive, Eye, Newspaper, Pencil, Search, Send, Star, Trash2, X } from 'lucide-react';
import { useState } from 'react';
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
import type { Blog, BlogListParams, BlogStatus } from '@/types/blogs';
import { BLOG_STATUS_LABEL, BLOG_STATUSES, BlogStatusBadge } from '../display';
import { BLOG_STATUSES as STAT_KEYS, useBlogCategories, useBlogList, useBlogPreview, useBlogStats, type BlogStatKey } from '../hooks';
import { BlogDeleteDialog, BlogSeoDialog, BlogStatusDialog, CategoryCreateDialog } from './blog-actions';
import { BlogEditorDialog } from './blog-editor';

const PAGE_SIZES = [10, 20, 50];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
] as const;

const STAT_CARD: Record<BlogStatKey, { label: string; hint: string; icon: typeof Newspaper; tone: KpiTone }> = {
  all: { label: 'Total blogs', hint: 'Excludes deleted', icon: Newspaper, tone: 'purple' },
  draft: { label: 'Drafts', hint: 'Not public', icon: Pencil, tone: 'amber' },
  published: { label: 'Published', hint: 'Live on site', icon: Send, tone: 'teal' },
  archived: { label: 'Archived', hint: 'Hidden', icon: Archive, tone: 'slate' },
};

export function BlogsManagement() {
  const toast = useToast();
  const preview = useBlogPreview();
  const stats = useBlogStats();
  const categories = useBlogCategories();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BlogStatus | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Blog | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ blog: Blog; target: BlogStatus } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Blog | null>(null);
  const [seoTarget, setSeoTarget] = useState<Blog | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const debounced = useDebouncedValue(search.trim(), 350);
  const params: BlogListParams = {
    page,
    limit,
    search: debounced || undefined,
    status: status || undefined,
    categoryId: categoryId || undefined,
    isFeatured: featuredOnly || undefined,
    sort,
  };
  const list = useBlogList(params);
  const rows = list.data?.data ?? [];
  const filtered = Boolean(debounced || status || categoryId || featuredOnly || sort !== 'newest');

  function applyStat(key: BlogStatKey) {
    setStatus(key === 'all' ? '' : key);
    setPage(1);
  }
  const statActive = (key: BlogStatKey) => (key === 'all' ? !status : status === key);

  function clearAll() {
    setSearch('');
    setStatus('');
    setCategoryId('');
    setFeaturedOnly(false);
    setSort('newest');
    setPage(1);
  }

  const categoryName = (id: string) => categories.data?.find((c) => c.id === id)?.name ?? 'Category';

  function openPreview(b: Blog) {
    preview.mutate(b.id, {
      onSuccess: (data) => {
        window.open(data.url, '_blank', 'noopener,noreferrer');
        toast.success('Preview opened', `Link expires ${new Date(data.expiresAt).toLocaleTimeString()}.`);
      },
      onError: (e) => toast.error('Could not create preview', normalizeApiError(e).message),
    });
  }

  const menu = (b: Blog): MenuItem[] => [
    { key: 'edit', label: 'Edit blog', icon: <Pencil className="size-4" />, onSelect: () => { setEditing(b); setEditorOpen(true); } },
    { key: 'preview', label: 'Preview post', icon: <Eye className="size-4" />, onSelect: () => openPreview(b) },
    { key: 'seo', label: 'SEO settings…', icon: <Search className="size-4" />, onSelect: () => setSeoTarget(b) },
    ...BLOG_STATUSES.filter((s) => s !== b.status).map((s) => ({
      key: `status-${s}`,
      label: s === 'published' ? 'Publish…' : s === 'archived' ? 'Archive…' : 'Move to draft…',
      icon: s === 'published' ? <Send className="size-4" /> : <Archive className="size-4" />,
      onSelect: () => setStatusDialog({ blog: b, target: s }),
    })),
    { key: 'delete', label: 'Delete blog…', icon: <Trash2 className="size-4" />, tone: 'danger', onSelect: () => setDeleteTarget(b) },
  ];

  return (
    <>
      <PageHeader
        title="Blog Management"
        description="Create, publish and optimize blog posts."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setCategoryOpen(true)}>
              New category
            </Button>
            <Button onClick={() => { setEditing(null); setEditorOpen(true); }}>
              <Pencil className="size-4" aria-hidden />
              New blog
            </Button>
            <RefreshButton queryKeys={[queryKeys.blogs.all]} />
          </div>
        }
      />

      <section aria-label="Blog overview" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{filtered ? 'Filtered blogs' : 'All blogs'}</h2>
            <p className="text-xs text-ink-muted">Search matches title, excerpt and tags.</p>
          </div>
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1 xl:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search blogs" className="pl-9" aria-label="Search blogs" />
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
              <Select value={status} onChange={(e) => { setStatus(e.target.value as BlogStatus | ''); setPage(1); }} aria-label="Filter by status">
                <option value="">Any status</option>
                {BLOG_STATUSES.map((s) => (
                  <option key={s} value={s}>{BLOG_STATUS_LABEL[s]}</option>
                ))}
              </Select>
              <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} aria-label="Filter by category">
                <option value="">Any category</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Select value={sort} onChange={(e) => { setSort(e.target.value as 'newest' | 'oldest'); setPage(1); }} aria-label="Sort blogs">
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
              <label className="col-span-2 flex items-center gap-2 text-xs text-ink-muted md:col-span-1 xl:col-span-2">
                <input
                  type="checkbox"
                  checked={featuredOnly}
                  onChange={(e) => { setFeaturedOnly(e.target.checked); setPage(1); }}
                  className="size-3.5 accent-primary"
                />
                Featured only
              </label>
            </div>
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
            icon={<Newspaper className="size-5" aria-hidden />}
            title={filtered ? 'No blogs match these filters' : 'No blogs yet'}
            description={filtered ? 'Try another search, status or category.' : 'Write your first blog post to engage learners.'}
            action={
              filtered ? (
                <Button size="sm" variant="secondary" onClick={clearAll}>Clear filters</Button>
              ) : (
                <Button size="sm" onClick={() => { setEditing(null); setEditorOpen(true); }}>New blog</Button>
              )
            }
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Post</th>
                    <th scope="col" className="hidden px-3 py-2.5 md:table-cell">Categories</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Published</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Updated</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3.5 pl-5 pr-3">
                            <div className="flex items-center gap-3">
                              <Skeleton className="h-10 w-16 rounded-md" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-3.5 w-56" />
                                <Skeleton className="h-3 w-40" />
                              </div>
                            </div>
                          </td>
                          <td className="hidden px-3 py-3.5 md:table-cell"><Skeleton className="h-3.5 w-24" /></td>
                          <td className="px-3 py-3.5"><Skeleton className="h-5 w-20" /></td>
                          <td className="hidden px-3 py-3.5 lg:table-cell"><Skeleton className="h-3.5 w-24" /></td>
                          <td className="hidden px-3 py-3.5 lg:table-cell"><Skeleton className="h-3.5 w-24" /></td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((b) => (
                        <tr key={b.id} className="group align-top transition-colors hover:bg-surface-2/50">
                          <td className="py-3.5 pl-5 pr-3">
                            <div className="flex items-center gap-3">
                              {b.featuredImage?.secureUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL
                                <img src={b.featuredImage.secureUrl} alt="" className="h-10 w-16 shrink-0 rounded-md object-cover" loading="lazy" />
                              ) : (
                                <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-subtle">
                                  <Newspaper className="size-4" aria-hidden />
                                </span>
                              )}
                              <button type="button" onClick={() => { setEditing(b); setEditorOpen(true); }} className="block min-w-0 text-left">
                                <span className="flex items-center gap-1.5 font-medium text-ink group-hover:text-primary">
                                  {b.isFeatured ? <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Featured" /> : null}
                                  <span className="line-clamp-1">{b.title}</span>
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-ink-muted">
                                  /{b.slug} · {b.readingTime} min read · {b.viewsCount} views
                                </span>
                              </button>
                            </div>
                          </td>
                          <td className="hidden w-px max-w-40 px-3 py-3.5 md:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {b.categoryIds.length ? (
                                b.categoryIds.slice(0, 2).map((id) => (
                                  <span key={id} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-muted ring-1 ring-inset ring-line">
                                    {categoryName(id)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-ink-subtle">—</span>
                              )}
                              {b.categoryIds.length > 2 ? <span className="text-[11px] text-ink-subtle">+{b.categoryIds.length - 2}</span> : null}
                            </div>
                          </td>
                          <td className="w-px px-3 py-3.5"><BlogStatusBadge status={b.status} /></td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted lg:table-cell" title={b.publishedAt ? formatDate(b.publishedAt) : undefined}>
                            {b.publishedAt ? formatDate(b.publishedAt) : '—'}
                            {b.publishedAt ? <span className="block text-[11px] text-ink-subtle">{formatRelative(b.publishedAt)}</span> : null}
                          </td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted lg:table-cell" title={formatDate(b.updatedAt)}>
                            {formatDate(b.updatedAt)}
                            <span className="block text-[11px] text-ink-subtle">{formatRelative(b.updatedAt)}</span>
                          </td>
                          <td className="w-px py-3 pl-3 pr-5 text-right">
                            <ActionMenu label={`Actions for blog ${b.title}`} items={menu(b)} />
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
                : rows.map((b) => (
                    <li key={b.id} className="flex items-start gap-3 p-4">
                      {b.featuredImage?.secureUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL
                        <img src={b.featuredImage.secureUrl} alt="" className="h-10 w-16 shrink-0 rounded-md object-cover" loading="lazy" />
                      ) : (
                        <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-subtle">
                          <Newspaper className="size-4" aria-hidden />
                        </span>
                      )}
                      <button type="button" onClick={() => { setEditing(b); setEditorOpen(true); }} className="min-w-0 flex-1 space-y-1 text-left">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink">{b.title}</span>
                          <BlogStatusBadge status={b.status} />
                        </span>
                        <span className="block truncate text-xs text-ink-muted">/{b.slug}</span>
                        <span className="block text-[11px] text-ink-subtle">
                          {b.publishedAt ? `published ${formatDate(b.publishedAt)}` : 'not published'} · {b.viewsCount} views
                        </span>
                      </button>
                      <ActionMenu label={`Actions for blog ${b.title}`} items={menu(b)} />
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

      <BlogEditorDialog
        key={editing?.id ?? 'new'}
        open={editorOpen}
        blog={editing}
        onClose={() => setEditorOpen(false)}
        onDone={() => setPage(1)}
      />
      {statusDialog ? (
        <BlogStatusDialog blog={statusDialog.blog} target={statusDialog.target} onClose={() => setStatusDialog(null)} />
      ) : null}
      {deleteTarget ? <BlogDeleteDialog blog={deleteTarget} onClose={() => setDeleteTarget(null)} /> : null}
      {seoTarget ? <BlogSeoDialog key={seoTarget.id} blog={seoTarget} onClose={() => setSeoTarget(null)} /> : null}
      <CategoryCreateDialog open={categoryOpen} onClose={() => setCategoryOpen(false)} />
    </>
  );
}
