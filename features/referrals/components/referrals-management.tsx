'use client';

import { Eye, Share2, Trash2, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ActionMenu, type MenuItem } from '@/components/ui/menu';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/cn';
import { formatDate, formatRelative } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { Referral, ReferralListParams, ReferralStatus } from '@/types/referrals';
import { REFERRAL_STATUS_LABEL, REFERRAL_STATUSES, ReferralStatusBadge } from '../display';
import { REFERRAL_STATUSES as STAT_KEYS, useReferralList, useReferralStats, type ReferralStatKey } from '../hooks';
import { ReferralDeleteDialog, ReferralStatusDialog } from './referral-actions';
import { ReferralDrawer } from './referral-drawer';

const PAGE_SIZES = [10, 20, 50];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
] as const;

const STAT_CARD: Record<ReferralStatKey, { label: string; hint: string; icon: typeof Share2; tone: 'purple' | 'sky' | 'amber' | 'teal' | 'coral' }> = {
  all: { label: 'Total referrals', hint: 'Excludes deleted', icon: Share2, tone: 'purple' },
  pending: { label: 'Pending', hint: 'Awaiting contact', icon: UserPlus, tone: 'sky' },
  contacted: { label: 'Contacted', hint: 'In progress', icon: Share2, tone: 'amber' },
  converted: { label: 'Converted', hint: 'Signed up', icon: UserPlus, tone: 'teal' },
  rejected: { label: 'Rejected', hint: 'Declined', icon: Trash2, tone: 'coral' },
};

export function ReferralsManagement() {
  const stats = useReferralStats();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ReferralStatus | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [viewing, setViewing] = useState<Referral | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ referral: Referral; target: ReferralStatus } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Referral | null>(null);

  const debounced = useDebouncedValue(search.trim(), 350);
  const params: ReferralListParams = {
    page,
    limit,
    search: debounced || undefined,
    status: status || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    sort,
  };
  const list = useReferralList(params);
  const rows = list.data?.data ?? [];
  const filtered = Boolean(debounced || status || startDate || endDate || sort !== 'newest');

  const resetPage =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  function applyStat(key: ReferralStatKey) {
    setStatus(key === 'all' ? '' : key);
    setPage(1);
  }

  const statActive = (key: ReferralStatKey) => (key === 'all' ? !status : status === key);

  function clearAll() {
    setSearch('');
    setStatus('');
    setStartDate('');
    setEndDate('');
    setSort('newest');
    setPage(1);
  }

  const menu = (r: Referral): MenuItem[] => [
    { key: 'view', label: 'View referral', icon: <Eye className="size-4" />, onSelect: () => setViewing(r) },
    ...REFERRAL_STATUSES.filter((s) => s !== r.status).map((s) => ({
      key: `status-${s}`,
      label: `Mark as ${REFERRAL_STATUS_LABEL[s]}…`,
      icon: <Share2 className="size-4" />,
      onSelect: () => setStatusDialog({ referral: r, target: s }),
    })),
    { key: 'delete', label: 'Delete referral…', icon: <Trash2 className="size-4" />, tone: 'danger', onSelect: () => setDeleteTarget(r) },
  ];

  return (
    <>
      <PageHeader
        title="Referrals"
        description="Manage and review refer-your-friend submissions."
        actions={<RefreshButton queryKeys={[queryKeys.referrals.all]} />}
      />

      <section aria-label="Referral overview" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
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
            <h2 className="text-sm font-semibold text-ink">{filtered ? 'Filtered referrals' : 'All referrals'}</h2>
            <p className="text-xs text-ink-muted">Search matches referrer or friend name, email or phone.</p>
          </div>
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <div className="flex min-w-0 gap-2 xl:w-72 xl:shrink-0">
              <div className="relative min-w-0 flex-1">
                <Share2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
                <Input type="search" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} placeholder="Search referrals" className="pl-9" aria-label="Search referrals" />
              </div>
              {filtered ? (
                <span className="shrink-0 xl:hidden">
                  <Button variant="ghost" onClick={clearAll}>
                    <X className="size-4" aria-hidden />
                    Clear
                  </Button>
                </span>
              ) : null}
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              <Select value={status} onChange={(e) => resetPage(setStatus)(e.target.value as ReferralStatus | '')} aria-label="Filter by status">
                <option value="">Any status</option>
                {REFERRAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {REFERRAL_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
              <Input type="date" value={startDate} onChange={(e) => resetPage(setStartDate)(e.target.value)} aria-label="From date" title="From date" />
              <Input type="date" value={endDate} onChange={(e) => resetPage(setEndDate)(e.target.value)} aria-label="To date" title="To date" />
              <Select value={sort} onChange={(e) => resetPage(setSort)(e.target.value as 'newest' | 'oldest')} aria-label="Sort referrals">
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <div className="hidden xl:col-span-2 xl:block" />
            </div>
            {filtered ? (
              <span className="hidden shrink-0 xl:block">
                <Button variant="ghost" onClick={clearAll}>
                  <X className="size-4" aria-hidden />
                  Clear
                </Button>
              </span>
            ) : null}
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isPending && !rows.length ? (
          <EmptyState
            icon={<Share2 className="size-5" aria-hidden />}
            title={filtered ? 'No referrals match these filters' : 'No referrals yet'}
            description={filtered ? 'Try another search, status or date filter.' : 'Refer-your-friend submissions will appear here.'}
            action={
              filtered ? (
                <Button size="sm" variant="secondary" onClick={clearAll}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Referrer</th>
                    <th scope="col" className="px-3 py-2.5">Referred friend</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Submitted</th>
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
                            <Skeleton className="h-3.5 w-32" />
                            <Skeleton className="mt-1.5 h-3 w-44" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-3.5 w-28" />
                            <Skeleton className="mt-1.5 h-3 w-32" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-5 w-20" />
                          </td>
                          <td className="hidden px-3 py-3.5 lg:table-cell">
                            <Skeleton className="h-3.5 w-20" />
                          </td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((r) => (
                        <tr key={r.id} className="group align-top transition-colors hover:bg-surface-2/50">
                          <td className="py-3.5 pl-5 pr-3">
                            <button type="button" onClick={() => setViewing(r)} className="block text-left">
                              <span className="block font-medium text-ink group-hover:text-primary">{r.referrerName}</span>
                              <span className="mt-0.5 block text-xs text-ink-muted">{r.referrerEmail}</span>
                              <span className="block text-[11px] text-ink-subtle">{r.referrerPhone}</span>
                            </button>
                          </td>
                          <td className="w-full min-w-48 max-w-0 px-3 py-3.5">
                            <button type="button" onClick={() => setViewing(r)} className="block w-full text-left">
                              <span className="block truncate text-ink">{r.friendName}</span>
                              <span className="mt-0.5 block text-xs text-ink-muted">{r.friendPhone}</span>
                              {r.message ? <span className="mt-0.5 block truncate text-[11px] text-ink-subtle">{r.message}</span> : null}
                            </button>
                          </td>
                          <td className="w-px px-3 py-3.5">
                            <ReferralStatusBadge status={r.status} />
                          </td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted lg:table-cell" title={formatDate(r.createdAt)}>
                            {formatDate(r.createdAt)}
                            <span className="block text-[11px] text-ink-subtle">{formatRelative(r.createdAt)}</span>
                          </td>
                          <td className="w-px py-3 pl-3 pr-5 text-right">
                            <ActionMenu label={`Actions for referral by ${r.referrerName}`} items={menu(r)} />
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
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </li>
                  ))
                : rows.map((r) => (
                    <li key={r.id} className="flex items-start gap-3 p-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Share2 className="size-4" aria-hidden />
                      </span>
                      <button type="button" onClick={() => setViewing(r)} className="min-w-0 flex-1 space-y-1 text-left">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink">
                            {r.referrerName} → {r.friendName}
                          </span>
                          <ReferralStatusBadge status={r.status} />
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                          {r.referrerEmail} · {r.referrerPhone}
                        </span>
                        <span className="block text-[11px] text-ink-subtle">
                          Friend: {r.friendPhone} · {formatDate(r.createdAt)}
                        </span>
                      </button>
                      <ActionMenu label={`Actions for referral by ${r.referrerName}`} items={menu(r)} />
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

      {viewing ? <ReferralDrawer key={viewing.id} seed={viewing} onClose={() => setViewing(null)} /> : null}
      {statusDialog ? (
        <ReferralStatusDialog
          referral={statusDialog.referral}
          target={statusDialog.target}
          onClose={() => setStatusDialog(null)}
          onDone={() => setViewing(null)}
        />
      ) : null}
      {deleteTarget ? <ReferralDeleteDialog referral={deleteTarget} onClose={() => setDeleteTarget(null)} onDone={() => setViewing(null)} /> : null}
    </>
  );
}
