'use client';

import { ArrowUpDown, CircleCheck, CircleSlash, FolderTree, Layers, Newspaper, Pencil, Plus, Search, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Select } from '@/components/ui/input';
import { ActionMenu, type MenuItem } from '@/components/ui/menu';
import { KpiCard, type KpiTone } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { useToast } from '@/providers/toast-provider';
import type { CategoryStatus, CourseCategory } from '@/types/categories';
import { useCourseCategories, usePublishedBlogCategories, useReorderCategories, useUpdateCategory } from '../hooks';
import { BlogCategoryFormDialog, CategoryFormDialog } from './category-form-dialog';
import { CategoryReorderList } from './category-reorder-list';

const PAGE_SIZES = [10, 20, 50];

type Tab = 'course' | 'blog';
type DialogState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; category: CourseCategory }
  | { type: 'deactivate'; category: CourseCategory }
  | { type: 'blog-create' };

function CategoryAvatar({ category }: { category: CourseCategory }) {
  if (category.image?.secureUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary image
    return <img src={category.image.secureUrl} alt="" className="size-9 shrink-0 rounded-lg border border-line object-cover" loading="lazy" />;
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary" aria-hidden>
      {category.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: CategoryStatus }) {
  return <Badge tone={status === 'active' ? 'success' : 'neutral'}>{status === 'active' ? 'Active' : 'Inactive'}</Badge>;
}

function CourseCategoriesPanel({ onCreate, onEdit, onDeactivate }: { onCreate: () => void; onEdit: (c: CourseCategory) => void; onDeactivate: (c: CourseCategory) => void }) {
  const toast = useToast();
  const categories = useCourseCategories();
  const update = useUpdateCategory();
  const reorder = useReorderCategories();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CategoryStatus | ''>('');
  const [parent, setParent] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [draft, setDraft] = useState<CourseCategory[] | null>(null);
  const inFlight = useRef(false);

  const all = categories.data ?? [];
  const byId = new Map(all.map((c) => [c.id, c]));
  const parentName = (id: string | null) => (id ? (byId.get(id)?.name ?? 'Unknown parent') : null);
  const childCount = (id: string) => all.filter((c) => c.parentCategoryId === id).length;
  const parents = all.filter((c) => all.some((x) => x.parentCategoryId === c.id));

  const term = search.trim().toLowerCase();
  const filtered = all.filter(
    (c) =>
      (!status || c.status === status) &&
      (!parent || (parent === 'root' ? !c.parentCategoryId : c.parentCategoryId === parent)) &&
      (!term || c.name.toLowerCase().includes(term) || c.slug.includes(term))
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * limit, currentPage * limit);
  const filtersActive = Boolean(search || status || parent);

  const stats = [
    { label: 'Total categories', value: all.length, icon: FolderTree, tone: 'purple' as KpiTone },
    { label: 'Active', value: all.filter((c) => c.status === 'active').length, icon: CircleCheck, tone: 'teal' as KpiTone },
    { label: 'Inactive', value: all.filter((c) => c.status === 'inactive').length, icon: CircleSlash, tone: 'coral' as KpiTone },
    { label: 'Subcategories', value: all.filter((c) => c.parentCategoryId).length, icon: Layers, tone: 'sky' as KpiTone },
  ];

  function activate(category: CourseCategory) {
    if (inFlight.current) return;
    inFlight.current = true;
    update.mutate(
      { id: category.id, input: { status: 'active' } },
      {
        onSuccess: (c) => toast.success('Category activated', c.name),
        onError: (error) => toast.error('Could not activate category', normalizeApiError(error).message),
        onSettled: () => {
          inFlight.current = false;
        },
      }
    );
  }

  function saveOrder() {
    if (!draft || reorder.isPending) return;
    const items = draft.map((c, index) => ({ id: c.id, sortOrder: index })).filter((item) => byId.get(item.id)?.sortOrder !== item.sortOrder);
    if (!items.length) {
      setDraft(null);
      toast.notify({ tone: 'info', title: 'Order unchanged' });
      return;
    }
    reorder.mutate(items, {
      onSuccess: () => {
        toast.success('Category order saved', `${items.length} categor${items.length === 1 ? 'y' : 'ies'} updated.`);
        setDraft(null);
      },
      onError: (error) => toast.error('Could not save order', normalizeApiError(error).message),
    });
  }

  function menuItems(c: CourseCategory): MenuItem[] {
    return [
      { key: 'edit', label: 'Edit category', icon: <Pencil className="size-4" />, onSelect: () => onEdit(c) },
      c.status === 'active'
        ? { key: 'deactivate', label: 'Deactivate', icon: <CircleSlash className="size-4" />, tone: 'danger', onSelect: () => onDeactivate(c) }
        : { key: 'activate', label: 'Activate', icon: <CircleCheck className="size-4" />, onSelect: () => activate(c) },
    ];
  }

  return (
    <>
      <section aria-label="Category totals" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon, tone }) => (
          <KpiCard key={label} label={label} icon={icon} tone={tone} value={value} isLoading={categories.isPending} error={categories.error} />
        ))}
      </section>

      <Card className="min-w-0">
        {draft ? (
          <>
            <div className="flex flex-col gap-3 border-b border-line bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div>
                <p className="text-sm font-semibold text-ink">Reorder categories</p>
                <p className="text-xs text-ink-muted">Drag rows or use the arrows. The order applies to the public catalogue and filters.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setDraft(null)} disabled={reorder.isPending}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveOrder} loading={reorder.isPending}>
                  Save order
                </Button>
              </div>
            </div>
            <CategoryReorderList items={draft} onChange={setDraft} parentName={parentName} disabled={reorder.isPending} />
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name or slug"
                  className="pl-9"
                  aria-label="Search categories"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as CategoryStatus | '');
                    setPage(1);
                  }}
                  className="sm:w-36"
                  aria-label="Filter by status"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
                <Select
                  value={parent}
                  onChange={(e) => {
                    setParent(e.target.value);
                    setPage(1);
                  }}
                  className="sm:w-44"
                  aria-label="Filter by parent"
                >
                  <option value="">All levels</option>
                  <option value="root">Top level only</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      In {p.name}
                    </option>
                  ))}
                </Select>
                {filtersActive ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearch('');
                      setStatus('');
                      setParent('');
                      setPage(1);
                    }}
                  >
                    <X className="size-4" aria-hidden />
                    Clear
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => setDraft(all)} disabled={all.length < 2 || categories.isFetching} className={cn(!filtersActive && 'col-span-2 sm:col-span-1')}>
                  <ArrowUpDown className="size-4" aria-hidden />
                  Reorder
                </Button>
              </div>
            </div>

            {categories.isError ? (
              <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
            ) : !categories.isPending && rows.length === 0 ? (
              <EmptyState
                icon={<FolderTree className="size-5" aria-hidden />}
                title={filtersActive ? 'No categories match these filters' : 'No course categories yet'}
                description={filtersActive ? 'Try a different search, status or parent.' : 'Create a category to start organising courses.'}
                action={
                  filtersActive ? undefined : (
                    <Button size="sm" onClick={onCreate}>
                      <Plus className="size-4" aria-hidden />
                      New category
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="relative hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-surface-2/60 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                      <tr>
                        <th scope="col" className="w-14 px-4 py-3">#</th>
                        <th scope="col" className="px-4 py-3">Category</th>
                        <th scope="col" className="px-4 py-3">Parent</th>
                        <th scope="col" className="px-4 py-3">Status</th>
                        <th scope="col" className="hidden px-4 py-3 lg:table-cell">Updated</th>
                        <th scope="col" className="px-4 py-3 text-right">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {categories.isPending
                        ? Array.from({ length: 6 }).map((_, i) => (
                            <tr key={i}>
                              <td className="px-4 py-3">
                                <Skeleton className="h-4 w-6" />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <Skeleton className="size-9 rounded-lg" />
                                  <Skeleton className="h-4 w-36" />
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Skeleton className="h-4 w-20" />
                              </td>
                              <td className="px-4 py-3">
                                <Skeleton className="h-4 w-14" />
                              </td>
                              <td className="hidden px-4 py-3 lg:table-cell">
                                <Skeleton className="h-4 w-20" />
                              </td>
                              <td className="px-4 py-3" />
                            </tr>
                          ))
                        : rows.map((c) => {
                            const children = childCount(c.id);
                            return (
                              <tr key={c.id} className="hover:bg-surface-2/50">
                                <td className="px-4 py-3 text-xs font-semibold text-ink-subtle">{c.sortOrder}</td>
                                <td className="max-w-80 px-4 py-3">
                                  <button type="button" onClick={() => onEdit(c)} className="flex min-w-0 items-center gap-3 text-left">
                                    <CategoryAvatar category={c} />
                                    <span className="min-w-0">
                                      <span className="block truncate font-semibold text-ink hover:text-primary">{c.name}</span>
                                      <span className="block truncate text-xs text-ink-muted">
                                        /{c.slug}
                                        {children ? ` · ${children} subcategor${children === 1 ? 'y' : 'ies'}` : ''}
                                      </span>
                                    </span>
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-ink-muted">{parentName(c.parentCategoryId) ?? <span className="text-ink-subtle">Top level</span>}</td>
                                <td className="px-4 py-3">
                                  <StatusBadge status={c.status} />
                                </td>
                                <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-ink-muted lg:table-cell">{formatDate(c.updatedAt)}</td>
                                <td className="px-4 py-3 text-right">
                                  <ActionMenu label={`Actions for ${c.name}`} items={menuItems(c)} />
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>

                <ul className="divide-y divide-line md:hidden">
                  {categories.isPending
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <li key={i} className="flex items-center gap-3 p-4">
                          <Skeleton className="size-9 rounded-lg" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </li>
                      ))
                    : rows.map((c) => (
                        <li key={c.id} className="space-y-2 p-3 sm:p-4">
                          <div className="flex items-start gap-3">
                            <button type="button" onClick={() => onEdit(c)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                              <CategoryAvatar category={c} />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-ink">{c.name}</span>
                                <span className="block truncate text-xs text-ink-muted">/{c.slug}</span>
                              </span>
                            </button>
                            <ActionMenu label={`Actions for ${c.name}`} items={menuItems(c)} />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={c.status} />
                            <span className="text-xs text-ink-muted">{parentName(c.parentCategoryId) ? `In ${parentName(c.parentCategoryId)}` : 'Top level'}</span>
                            <span className="ml-auto text-[11px] text-ink-subtle">Order {c.sortOrder}</span>
                          </div>
                        </li>
                      ))}
                </ul>
              </>
            )}

            <Pagination
              meta={categories.isPending || categories.error ? undefined : { page: currentPage, limit, total: filtered.length, totalPages }}
              onPageChange={setPage}
              pageSizeOptions={PAGE_SIZES}
              onPageSizeChange={(size) => {
                setLimit(size);
                setPage(1);
              }}
            />
          </>
        )}
      </Card>
    </>
  );
}

function BlogCategoriesPanel({ onCreate }: { onCreate: () => void }) {
  const blog = usePublishedBlogCategories();
  const list = blog.data ?? [];
  return (
    <Card className="min-w-0">
      <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div>
          <p className="text-sm font-semibold text-ink">Blog categories</p>
          <p className="text-xs text-ink-muted">Published categories only. The backend has no admin list endpoint for blog categories, so drafts are not shown.</p>
        </div>
        <Button size="sm" onClick={onCreate}>
          <Plus className="size-4" aria-hidden />
          New blog category
        </Button>
      </div>
      {blog.isPending ? (
        <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : blog.isError ? (
        <ErrorState error={blog.error} onRetry={() => blog.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={<Newspaper className="size-5" aria-hidden />} title="No published blog categories" description="Create a category to organise blog posts." />
      ) : (
        <ul className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
          {list.map((b) => (
            <li key={b.id} className="min-w-0 rounded-xl border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-semibold text-ink">{b.name}</p>
                <Badge tone="success">Published</Badge>
              </div>
              <p className="truncate text-xs text-ink-muted">/{b.slug}</p>
              {b.description ? <p className="mt-1.5 line-clamp-2 text-xs text-ink-muted">{b.description}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CategoryManagement() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('course');
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });
  const categories = useCourseCategories();
  const update = useUpdateCategory();
  const inFlight = useRef(false);
  const close = () => setDialog({ type: 'none' });

  function confirmDeactivate() {
    if (dialog.type !== 'deactivate' || inFlight.current) return;
    inFlight.current = true;
    update.mutate(
      { id: dialog.category.id, input: { status: 'inactive' } },
      {
        onSuccess: (c) => {
          toast.success('Category deactivated', c.name);
          close();
        },
        onError: (error) => toast.error('Could not deactivate category', normalizeApiError(error).message),
        onSettled: () => {
          inFlight.current = false;
        },
      }
    );
  }

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise courses and blog posts. Course category order is used across the catalogue."
        actions={
          <>
            <RefreshButton queryKeys={[queryKeys.categories.all]} />
            <Button size="sm" onClick={() => setDialog(tab === 'course' ? { type: 'create' } : { type: 'blog-create' })}>
              <Plus className="size-4" aria-hidden />
              {tab === 'course' ? 'New category' : 'New blog category'}
            </Button>
          </>
        }
      />

      <div role="tablist" aria-label="Category type" className="mb-5 inline-flex rounded-xl border border-line bg-surface p-1 shadow-card">
        {(
          [
            { key: 'course', label: 'Course categories', icon: FolderTree },
            { key: 'blog', label: 'Blog categories', icon: Newspaper },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm', tab === key ? 'bg-primary text-primary-fg shadow-sm' : 'text-ink-muted hover:text-ink')}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === 'course' ? (
        <CourseCategoriesPanel onCreate={() => setDialog({ type: 'create' })} onEdit={(category) => setDialog({ type: 'edit', category })} onDeactivate={(category) => setDialog({ type: 'deactivate', category })} />
      ) : (
        <BlogCategoriesPanel onCreate={() => setDialog({ type: 'blog-create' })} />
      )}

      {dialog.type === 'create' ? <CategoryFormDialog key="create" mode="create" all={categories.data ?? []} onClose={close} /> : null}
      {dialog.type === 'edit' ? <CategoryFormDialog key={dialog.category.id} mode="edit" category={dialog.category} all={categories.data ?? []} onClose={close} /> : null}
      {dialog.type === 'blog-create' ? <BlogCategoryFormDialog onClose={close} /> : null}
      <ConfirmDialog
        open={dialog.type === 'deactivate'}
        title="Deactivate category?"
        confirmLabel="Deactivate"
        loading={update.isPending}
        onCancel={close}
        onConfirm={confirmDeactivate}
        description={
          dialog.type === 'deactivate' ? (
            <>
              <p>
                <span className="font-semibold text-ink">{dialog.category.name}</span>
              </p>
              <p className="mt-2">Inactive categories are hidden from the public catalogue. Courses keep the category and you can reactivate it later.</p>
            </>
          ) : null
        }
      />
    </>
  );
}
