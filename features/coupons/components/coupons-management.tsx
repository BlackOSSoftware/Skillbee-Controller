'use client';

import { Archive, CalendarX2, Eye, PauseCircle, Pause, Pencil, Play, Plus, Search, TicketCheck, TicketPercent, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ActionMenu } from '@/components/ui/menu';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/query-keys';
import { useToast } from '@/providers/toast-provider';
import type { Coupon, CouponDiscountType, CouponListParams } from '@/types/coupons';
import { formatDate } from '@/lib/format';
import { CouponStateBadge, discountLabel, formatMajor, usageLabel } from '../display';
import { useCoupon, useCouponList, useCouponStats, useUpdateCoupon } from '../hooks';
import { CouponDrawer, DeactivateCouponDialog } from './coupon-drawer';
import { CouponFormDialog } from './coupon-form-dialog';

type StateFilter = '' | 'active' | 'paused' | 'expired' | 'upcoming';

const STATE_FILTERS: Array<{ value: StateFilter; label: string }> = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Turned on' },
  { value: 'paused', label: 'Paused' },
  { value: 'upcoming', label: 'Starts later' },
  { value: 'expired', label: 'Expired' },
];

const STATE_PARAMS: Record<StateFilter, Partial<CouponListParams>> = {
  '': {},
  active: { isActive: true },
  paused: { isActive: false },
  expired: { expired: true },
  upcoming: { upcoming: true },
};

const PAGE_SIZES = [10, 20, 50];

function validity(c: Coupon) {
  if (!c.startDate && !c.expiryDate) return 'No end date';
  if (c.startDate && c.expiryDate) return `${formatDate(c.startDate)} – ${formatDate(c.expiryDate)}`;
  return c.expiryDate ? `Until ${formatDate(c.expiryDate)}` : `From ${formatDate(c.startDate)}`;
}

/** Edits always start from a fresh GET so field locks reflect the current redemption count. */
function EditCoupon({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useCoupon(id);
  if (detail.data && detail.isFetchedAfterMount) return <CouponFormDialog coupon={detail.data} onClose={onClose} />;
  return (
    <Dialog open onClose={onClose} size="sm" title="Edit coupon">
      {detail.isError ? <ErrorState error={detail.error} onRetry={() => detail.refetch()} /> : <Skeleton className="h-24 w-full" />}
    </Dialog>
  );
}

export function CouponsManagement() {
  const toast = useToast();
  const stats = useCouponStats();
  const [search, setSearch] = useState('');
  const [state, setState] = useState<StateFilter>('');
  const [discountType, setDiscountType] = useState<CouponDiscountType | ''>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [viewing, setViewing] = useState<Coupon | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);
  const update = useUpdateCoupon();

  const debounced = useDebouncedValue(search.trim(), 350);
  const params: CouponListParams = { page, limit, search: debounced || undefined, discountType: discountType || undefined, ...STATE_PARAMS[state] };
  const list = useCouponList(params);
  const rows = list.data?.coupons ?? [];
  const filtered = Boolean(debounced || state || discountType);

  const resetPage =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  function clearAll() {
    setSearch('');
    setState('');
    setDiscountType('');
    setPage(1);
  }

  function toggleActive(c: Coupon) {
    update.mutate(
      { id: c.id, input: { isActive: !c.isActive } },
      {
        onSuccess: (x) => toast.success(x.isActive ? 'Coupon resumed' : 'Coupon paused', x.isActive ? `${x.code} can be applied again.` : `${x.code} can no longer be applied.`),
        onError: (e) => toast.error('Could not update coupon', normalizeApiError(e).message),
      }
    );
  }

  const menu = (c: Coupon) => [
    { key: 'view', label: 'View details', icon: <Eye className="size-4" />, onSelect: () => setViewing(c) },
    { key: 'edit', label: 'Edit', icon: <Pencil className="size-4" />, onSelect: () => setEditing(c.id) },
    { key: 'toggle', label: c.isActive ? 'Pause' : 'Resume', icon: c.isActive ? <Pause className="size-4" /> : <Play className="size-4" />, disabled: update.isPending, onSelect: () => toggleActive(c) },
    { key: 'archive', label: 'Deactivate', icon: <Archive className="size-4" />, tone: 'danger' as const, onSelect: () => setArchiving(c) },
  ];

  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes, their rules and every redemption."
        actions={
          <>
            <RefreshButton queryKeys={[queryKeys.coupons.all]} />
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              New coupon
            </Button>
          </>
        }
      />

      <section aria-label="Coupon overview" className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Coupons" hint="Not deactivated" icon={TicketPercent} tone="purple" value={stats.all.value} isLoading={stats.all.isLoading} error={stats.all.error} active={!state} onClick={() => resetPage(setState)('')} />
        <KpiCard label="Turned on" hint="Switched on; dates and limits apply" icon={TicketCheck} tone="teal" value={stats.active.value} isLoading={stats.active.isLoading} error={stats.active.error} active={state === 'active'} onClick={() => resetPage(setState)('active')} />
        <KpiCard label="Paused" hint="Cannot be applied" icon={PauseCircle} tone="amber" value={stats.paused.value} isLoading={stats.paused.isLoading} error={stats.paused.error} active={state === 'paused'} onClick={() => resetPage(setState)('paused')} />
        <KpiCard label="Expired" hint="Past their end date" icon={CalendarX2} tone="coral" value={stats.expired.value} isLoading={stats.expired.isLoading} error={stats.expired.error} active={state === 'expired'} onClick={() => resetPage(setState)('expired')} />
      </section>

      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">All coupons</h2>
            <p className="text-xs text-ink-muted">Newest first. Deactivated coupons are hidden; their records are kept.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input type="search" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} placeholder="Code or description" className="pl-9" aria-label="Search coupons" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select value={state} onChange={(e) => resetPage(setState)(e.target.value as StateFilter)} className="sm:w-36" aria-label="Filter by status">
                {STATE_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
              <Select value={discountType} onChange={(e) => resetPage(setDiscountType)(e.target.value as CouponDiscountType | '')} className="sm:w-36" aria-label="Filter by discount type">
                <option value="">Any discount</option>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </Select>
            </div>
            {filtered ? (
              <Button variant="ghost" onClick={clearAll}>
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
            icon={<TicketPercent className="size-5" aria-hidden />}
            title={filtered ? 'No coupons match these filters' : 'No coupons yet'}
            description={filtered ? 'Try another code, status or discount type.' : 'Create a coupon to offer learners a discount at checkout.'}
            action={
              filtered ? undefined : (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="size-4" aria-hidden />
                  New coupon
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Code</th>
                    <th scope="col" className="px-3 py-2.5">Discount</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Applies to</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Redeemed</th>
                    <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">Validity</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3.5 pl-5 pr-3">
                            <Skeleton className="h-5 w-28" />
                            <Skeleton className="mt-1.5 h-3 w-40" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-4 w-24" />
                          </td>
                          <td className="hidden px-3 py-3.5 lg:table-cell">
                            <Skeleton className="h-4 w-24" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="ml-auto h-4 w-10" />
                          </td>
                          <td className="hidden px-3 py-3.5 xl:table-cell">
                            <Skeleton className="h-4 w-32" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-5 w-16" />
                          </td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((c) => (
                        <tr key={c.id} className="group transition-colors hover:bg-surface-2/50">
                          <td className="py-3.5 pl-5 pr-3">
                            <button type="button" onClick={() => setViewing(c)} className="block text-left">
                              <span className="inline-block whitespace-nowrap rounded-md border border-dashed border-field-border px-2 py-0.5 font-mono text-[13px] font-semibold tracking-wide text-ink group-hover:border-primary/50 group-hover:text-primary">{c.code}</span>
                              {c.description ? <span className="mt-1 block max-w-64 truncate text-xs text-ink-muted">{c.description}</span> : null}
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5 text-ink">
                            {discountLabel(c)}
                            {c.minimumOrderAmount ? <span className="block text-xs text-ink-subtle">Min order {formatMajor(c.minimumOrderAmount, c.currency)}</span> : null}
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-3.5 text-ink-muted lg:table-cell">
                            {c.applicability === 'all_courses' ? 'All courses' : `${c.applicableCourses.length} course${c.applicableCourses.length === 1 ? '' : 's'}`}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums">
                            <span className="font-medium text-ink">{usageLabel(c)}</span>
                            {c.reservedCount ? <span className="block text-[11px] text-info">{c.reservedCount} held</span> : null}
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted xl:table-cell">{validity(c)}</td>
                          <td className="w-px px-3 py-3.5">
                            <CouponStateBadge coupon={c} />
                          </td>
                          <td className="w-px py-3.5 pl-3 pr-5 text-right">
                            <ActionMenu label={`Actions for ${c.code}`} items={menu(c)} />
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
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="h-4 w-48" />
                    </li>
                  ))
                : rows.map((c) => (
                    <li key={c.id} className="flex items-start gap-2 p-4">
                      <button type="button" onClick={() => setViewing(c)} className="min-w-0 flex-1 space-y-1.5 text-left">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate rounded-md border border-dashed border-field-border px-2 py-0.5 font-mono text-[13px] font-semibold tracking-wide text-ink">{c.code}</span>
                          <CouponStateBadge coupon={c} />
                        </span>
                        <span className="block text-sm text-ink">{discountLabel(c)}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {usageLabel(c)} redeemed · {validity(c)}
                        </span>
                      </button>
                      <ActionMenu label={`Actions for ${c.code}`} items={menu(c)} />
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
          onPageSizeChange={(size) => {
            setLimit(size);
            setPage(1);
          }}
        />
      </Card>

      {creating ? <CouponFormDialog onClose={() => setCreating(false)} onSaved={(c) => setViewing(c)} /> : null}
      {editing ? <EditCoupon key={editing} id={editing} onClose={() => setEditing(null)} /> : null}
      {archiving ? <DeactivateCouponDialog coupon={archiving} onClose={() => setArchiving(null)} /> : null}
      {viewing ? <CouponDrawer key={viewing.id} seed={viewing} onClose={() => setViewing(null)} /> : null}
    </>
  );
}
