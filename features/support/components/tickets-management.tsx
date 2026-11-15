'use client';

import { CheckCircle2, CircleDot, Eye, LifeBuoy, Lock, Search, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ActionMenu, type MenuItem } from '@/components/ui/menu';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/cn';
import { formatDate, formatRelative } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { SupportStatus, SupportTicket, TicketCategory, TicketListParams, TicketPriority } from '@/types/contact';
import { SupportStatusBadge, supportStatusLabel, TICKET_CATEGORY_LABEL, TicketPriorityBadge } from '@/features/contact/display';
import { TICKET_STAT_KEYS, useAdminTicketList, useTicketStats, type TicketStatKey } from '../hooks';
import { TicketDrawer } from './ticket-drawer';
import { TicketAssignDialog, TicketStatusDialog } from './ticket-actions';

const PAGE_SIZES = [10, 20, 50];

const STAT_CARD: Record<TicketStatKey, { label: string; hint: string; icon: typeof LifeBuoy; tone: 'purple' | 'sky' | 'amber' | 'teal' | 'coral' }> = {
  all: { label: 'Total tickets', hint: 'Excludes deleted', icon: LifeBuoy, tone: 'purple' },
  open: { label: 'Open', hint: 'Awaiting review', icon: CircleDot, tone: 'sky' },
  reviewed: { label: 'Reviewed', hint: 'Being handled', icon: UserRound, tone: 'amber' },
  resolved: { label: 'Resolved', hint: 'Answered & closed out', icon: CheckCircle2, tone: 'teal' },
  closed: { label: 'Closed', hint: 'Archived', icon: Lock, tone: 'coral' },
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'last_activity', label: 'Recent activity' },
] as const;

export function TicketsManagement() {
  const stats = useTicketStats();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SupportStatus | ''>('');
  const [category, setCategory] = useState<TicketCategory | ''>('');
  const [priority, setPriority] = useState<TicketPriority | ''>('');
  const [unassigned, setUnassigned] = useState(false);
  const [sort, setSort] = useState<'newest' | 'last_activity'>('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [viewing, setViewing] = useState<SupportTicket | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ ticket: SupportTicket; target: SupportStatus } | null>(null);
  const [assignTicket, setAssignTicket] = useState<SupportTicket | null>(null);

  const debounced = useDebouncedValue(search.trim(), 350);
  const params: TicketListParams = {
    page,
    limit,
    search: debounced || undefined,
    status: status || undefined,
    category: category || undefined,
    priority: priority || undefined,
    unassigned: unassigned || undefined,
    sort: sort === 'newest' ? undefined : sort,
  };
  const list = useAdminTicketList(params);
  const rows = list.data?.data ?? [];
  const filtered = Boolean(debounced || status || category || priority || unassigned);

  const resetPage =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  function applyStat(key: TicketStatKey) {
    setStatus(key === 'all' ? '' : key);
    setPage(1);
  }

  const statActive = (key: TicketStatKey) => (key === 'all' ? !status : status === key);

  function clearAll() {
    setSearch('');
    setStatus('');
    setCategory('');
    setPriority('');
    setUnassigned(false);
    setSort('newest');
    setPage(1);
  }

  const menu = (t: SupportTicket): MenuItem[] => [
    { key: 'view', label: 'View ticket', icon: <Eye className="size-4" />, onSelect: () => setViewing(t) },
    { key: 'assign', label: 'Assign…', icon: <UserRound className="size-4" />, onSelect: () => setAssignTicket(t) },
    ...(['reviewed', 'resolved', 'closed', 'open'] as SupportStatus[])
      .filter((s) => s !== t.status)
      .map((s) => ({
        key: `status-${s}`,
        label: `Mark as ${supportStatusLabel(s)}…`,
        icon: <CircleDot className="size-4" />,
        onSelect: () => setStatusDialog({ ticket: t, target: s }),
      })),
  ];

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Support tickets</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Student support requests — reply, assign and track.</p>
          </div>
          <RefreshButton queryKeys={[queryKeys.support.all]} />
        </div>
      </div>

      <section aria-label="Ticket overview" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {TICKET_STAT_KEYS.map((key) => {
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
            <h3 className="text-sm font-semibold text-ink">{filtered ? 'Filtered tickets' : 'All tickets'}</h3>
            <p className="text-xs text-ink-muted">Search matches the ticket number, subject, description or student.</p>
          </div>
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <div className="flex min-w-0 gap-2 xl:w-72 xl:shrink-0">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
                <Input type="search" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} placeholder="Search tickets" className="pl-9" aria-label="Search tickets" />
              </div>
              {filtered || sort !== 'newest' ? (
                <span className="shrink-0 xl:hidden">
                  <Button variant="ghost" onClick={clearAll}>
                    <X className="size-4" aria-hidden />
                    Clear
                  </Button>
                </span>
              ) : null}
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              <Select value={status} onChange={(e) => resetPage(setStatus)(e.target.value as SupportStatus | '')} aria-label="Filter by status">
                <option value="">Any status</option>
                <option value="open">Open</option>
                <option value="reviewed">Reviewed</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </Select>
              <Select value={category} onChange={(e) => resetPage(setCategory)(e.target.value as TicketCategory | '')} aria-label="Filter by category">
                <option value="">Any category</option>
                {Object.entries(TICKET_CATEGORY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select value={priority} onChange={(e) => resetPage(setPriority)(e.target.value as TicketPriority | '')} aria-label="Filter by priority">
                <option value="">Any priority</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
              <label className="flex items-center gap-2 rounded-md border border-line px-2.5 text-xs text-ink-muted">
                <input type="checkbox" checked={unassigned} onChange={(e) => resetPage(setUnassigned)(e.target.checked)} className="size-3.5 accent-primary" />
                Unassigned only
              </label>
              <Select value={sort} onChange={(e) => resetPage(setSort)(e.target.value as 'newest' | 'last_activity')} aria-label="Sort tickets" className="col-span-2 md:col-span-1">
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <div className="hidden xl:block" />
            </div>
            {filtered || sort !== 'newest' ? (
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
            icon={<LifeBuoy className="size-5" aria-hidden />}
            title={filtered ? 'No tickets match these filters' : 'No support tickets yet'}
            description={filtered ? 'Try another search, status, category, priority or assignee filter.' : 'Student support tickets will appear here.'}
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
                    <th scope="col" className="py-2.5 pl-5 pr-3">Ticket</th>
                    <th scope="col" className="px-3 py-2.5">Student</th>
                    <th scope="col" className="px-3 py-2.5">Subject</th>
                    <th scope="col" className="px-3 py-2.5">Category</th>
                    <th scope="col" className="px-3 py-2.5">Priority</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Assignee</th>
                    <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">Raised</th>
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
                            <Skeleton className="h-3.5 w-24" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-3.5 w-32" />
                            <Skeleton className="mt-1.5 h-3 w-40" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-3.5 w-48" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-5 w-20" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-5 w-16" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-5 w-16" />
                          </td>
                          <td className="hidden px-3 py-3.5 lg:table-cell">
                            <Skeleton className="h-3.5 w-24" />
                          </td>
                          <td className="hidden px-3 py-3.5 xl:table-cell">
                            <Skeleton className="h-3.5 w-20" />
                          </td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((t) => (
                        <tr key={t.id} className="group align-top transition-colors hover:bg-surface-2/50">
                          <td className="py-3.5 pl-5 pr-3">
                            <button type="button" onClick={() => setViewing(t)} className="font-mono text-xs font-medium text-primary hover:underline">
                              {t.ticketNumber}
                            </button>
                          </td>
                          <td className="w-px whitespace-nowrap px-3 py-3.5">
                            <p className="font-medium text-ink">{t.student ? `${t.student.firstName} ${t.student.lastName}`.trim() : 'Unknown'}</p>
                            <p className="text-xs text-ink-muted">{t.student?.email ?? '—'}</p>
                          </td>
                          <td className="w-full min-w-56 max-w-0 px-3 py-3.5">
                            <button type="button" onClick={() => setViewing(t)} className="block w-full text-left">
                              <span className="block truncate font-medium text-ink group-hover:text-primary">{t.subject}</span>
                              <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">{t.description}</span>
                            </button>
                          </td>
                          <td className="w-px px-3 py-3.5">
                            <Badge tone="neutral">{TICKET_CATEGORY_LABEL[t.category] ?? t.category}</Badge>
                          </td>
                          <td className="w-px px-3 py-3.5">
                            <TicketPriorityBadge priority={t.priority} />
                          </td>
                          <td className="w-px px-3 py-3.5">
                            <SupportStatusBadge status={t.status} />
                          </td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted lg:table-cell">
                            {t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}`.trim() : <span className="text-ink-subtle">Unassigned</span>}
                          </td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted xl:table-cell" title={formatDate(t.createdAt)}>
                            {formatDate(t.createdAt)}
                            <span className="block text-[11px] text-ink-subtle">{formatRelative(t.lastActivityAt)}</span>
                          </td>
                          <td className="w-px py-3 pl-3 pr-5 text-right">
                            <ActionMenu label={`Actions for ticket ${t.ticketNumber}`} items={menu(t)} />
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
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </li>
                  ))
                : rows.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 p-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <LifeBuoy className="size-4" aria-hidden />
                      </span>
                      <button type="button" onClick={() => setViewing(t)} className="min-w-0 flex-1 space-y-1 text-left">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-xs font-medium text-primary">{t.ticketNumber}</span>
                          <SupportStatusBadge status={t.status} />
                        </span>
                        <span className="block truncate text-sm font-medium text-ink">{t.subject}</span>
                        <span className="block truncate text-xs text-ink-muted">
                          {t.student ? `${t.student.firstName} ${t.student.lastName}`.trim() : 'Unknown'} · {t.student?.email ?? '—'}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-subtle">
                          <Badge tone="neutral">{TICKET_CATEGORY_LABEL[t.category] ?? t.category}</Badge>
                          <TicketPriorityBadge priority={t.priority} />
                          <span>{formatDate(t.createdAt)}</span>
                        </span>
                      </button>
                      <ActionMenu label={`Actions for ticket ${t.ticketNumber}`} items={menu(t)} />
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

      {viewing ? <TicketDrawer key={viewing.id} seed={viewing} onClose={() => setViewing(null)} /> : null}
      {statusDialog ? <TicketStatusDialog ticket={statusDialog.ticket} target={statusDialog.target} onClose={() => setStatusDialog(null)} /> : null}
      {assignTicket ? <TicketAssignDialog ticket={assignTicket} onClose={() => setAssignTicket(null)} /> : null}
    </>
  );
}
