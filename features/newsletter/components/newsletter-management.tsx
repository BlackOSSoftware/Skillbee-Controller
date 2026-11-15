'use client';

import { Eye, Mail, MailCheck, MailWarning, Megaphone, Send, Trash2, UserMinus, Users, X } from 'lucide-react';
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
import type { NewsletterCampaign, NewsletterSubscriber, SubscriberStatus } from '@/types/newsletter';
import { CampaignStatusBadge, SUBSCRIBER_STATUS_LABEL, SUBSCRIBER_STATUSES, SubscriberStatusBadge } from '../display';
import {
  SUBSCRIBER_STATUSES as SUB_STAT_KEYS,
  useCampaignList,
  useSubscriberList,
  useSubscriberStats,
  type SubscriberStatKey,
} from '../hooks';
import { CampaignCreateDialog } from './campaign-create-dialog';
import { CampaignDrawer } from './campaign-drawer';
import { SubscriberDeleteDialog, SubscriberStatusDialog } from './subscriber-actions';
import { SubscriberDrawer } from './subscriber-drawer';

const PAGE_SIZES = [10, 20, 50];

type Tab = 'subscribers' | 'campaigns';

const SUB_STAT_CARD: Record<SubscriberStatKey, { label: string; hint: string; icon: typeof Users; tone: KpiTone }> = {
  all: { label: 'Total subscribers', hint: 'Excludes deleted', icon: Users, tone: 'purple' },
  pending: { label: 'Pending', hint: 'Awaiting verification', icon: MailWarning, tone: 'amber' },
  subscribed: { label: 'Subscribed', hint: 'Receives campaigns', icon: MailCheck, tone: 'teal' },
  unsubscribed: { label: 'Unsubscribed', hint: 'Opted out', icon: UserMinus, tone: 'slate' },
};

function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'subscribers', label: 'Subscribers' },
    { key: 'campaigns', label: 'Campaigns' },
  ];
  return (
    <div role="tablist" aria-label="Newsletter sections" className="inline-flex rounded-lg border border-line bg-surface-2/60 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={tab === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tab === t.key ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function NewsletterManagement() {
  const [tab, setTab] = useState<Tab>('subscribers');
  return (
    <>
      <PageHeader
        title="Newsletter"
        description="Manage subscribers and email campaigns."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs tab={tab} onChange={setTab} />
            <RefreshButton queryKeys={[queryKeys.newsletter.all]} />
          </div>
        }
      />
      {tab === 'subscribers' ? <SubscribersPanel /> : <CampaignsPanel />}
    </>
  );
}

// ---------------- Subscribers ----------------

function SubscribersPanel() {
  const stats = useSubscriberStats();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SubscriberStatus | ''>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [viewing, setViewing] = useState<NewsletterSubscriber | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ subscriber: NewsletterSubscriber; target: SubscriberStatus } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NewsletterSubscriber | null>(null);

  const debounced = useDebouncedValue(search.trim(), 350);
  const list = useSubscriberList({
    page,
    limit,
    search: debounced || undefined,
    status: status || undefined,
  });
  const rows = list.data?.data ?? [];
  const filtered = Boolean(debounced || status);

  function applyStat(key: SubscriberStatKey) {
    setStatus(key === 'all' ? '' : key);
    setPage(1);
  }
  const statActive = (key: SubscriberStatKey) => (key === 'all' ? !status : status === key);

  function clearAll() {
    setSearch('');
    setStatus('');
    setPage(1);
  }

  const menu = (s: NewsletterSubscriber): MenuItem[] => [
    { key: 'view', label: 'View subscriber', icon: <Eye className="size-4" />, onSelect: () => setViewing(s) },
    ...SUBSCRIBER_STATUSES.filter((st) => st !== s.status).map((st) => ({
      key: `status-${st}`,
      label: `Mark as ${SUBSCRIBER_STATUS_LABEL[st]}…`,
      icon: <Mail className="size-4" />,
      onSelect: () => setStatusDialog({ subscriber: s, target: st }),
    })),
    { key: 'delete', label: 'Delete subscriber…', icon: <Trash2 className="size-4" />, tone: 'danger', onSelect: () => setDeleteTarget(s) },
  ];

  return (
    <>
      <section aria-label="Subscriber overview" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SUB_STAT_KEYS.map((key) => {
          const meta = SUB_STAT_CARD[key];
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
            <h2 className="text-sm font-semibold text-ink">{filtered ? 'Filtered subscribers' : 'All subscribers'}</h2>
            <p className="text-xs text-ink-muted">Search matches email address.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by email" className="pl-9" aria-label="Search subscribers" />
            </div>
            <Select value={status} onChange={(e) => { setStatus(e.target.value as SubscriberStatus | ''); setPage(1); }} aria-label="Filter by status" className="sm:w-48">
              <option value="">Any status</option>
              {SUBSCRIBER_STATUSES.map((s) => (
                <option key={s} value={s}>{SUBSCRIBER_STATUS_LABEL[s]}</option>
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
            icon={<Mail className="size-5" aria-hidden />}
            title={filtered ? 'No subscribers match these filters' : 'No subscribers yet'}
            description={filtered ? 'Try another search or status filter.' : 'Newsletter signups will appear here.'}
            action={filtered ? <Button size="sm" variant="secondary" onClick={clearAll}>Clear filters</Button> : undefined}
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Email</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Source</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Subscribed</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3.5 pl-5 pr-3"><Skeleton className="h-3.5 w-56" /></td>
                          <td className="px-3 py-3.5"><Skeleton className="h-5 w-24" /></td>
                          <td className="hidden px-3 py-3.5 lg:table-cell"><Skeleton className="h-3.5 w-20" /></td>
                          <td className="hidden px-3 py-3.5 lg:table-cell"><Skeleton className="h-3.5 w-24" /></td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((s) => (
                        <tr key={s.id} className="group align-top transition-colors hover:bg-surface-2/50">
                          <td className="py-3.5 pl-5 pr-3">
                            <button type="button" onClick={() => setViewing(s)} className="block max-w-0 truncate text-left font-medium text-ink group-hover:text-primary" title={s.email}>
                              {s.email}
                            </button>
                          </td>
                          <td className="w-px px-3 py-3.5"><SubscriberStatusBadge status={s.status} /></td>
                          <td className="hidden w-px px-3 py-3.5 text-xs text-ink-muted lg:table-cell">{s.source || 'website'}</td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted lg:table-cell" title={s.subscribedAt ? formatDate(s.subscribedAt) : undefined}>
                            {s.subscribedAt ? formatDate(s.subscribedAt) : '—'}
                            {s.subscribedAt ? <span className="block text-[11px] text-ink-subtle">{formatRelative(s.subscribedAt)}</span> : null}
                          </td>
                          <td className="w-px py-3 pl-3 pr-5 text-right">
                            <ActionMenu label={`Actions for ${s.email}`} items={menu(s)} />
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
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </li>
                  ))
                : rows.map((s) => (
                    <li key={s.id} className="flex items-start gap-3 p-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Mail className="size-4" aria-hidden />
                      </span>
                      <button type="button" onClick={() => setViewing(s)} className="min-w-0 flex-1 space-y-1 text-left">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink">{s.email}</span>
                          <SubscriberStatusBadge status={s.status} />
                        </span>
                        <span className="block text-[11px] text-ink-subtle">
                          {s.source || 'website'} · {s.subscribedAt ? `subscribed ${formatDate(s.subscribedAt)}` : 'not verified'}
                        </span>
                      </button>
                      <ActionMenu label={`Actions for ${s.email}`} items={menu(s)} />
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

      {viewing ? <SubscriberDrawer key={viewing.id} seed={viewing} onClose={() => setViewing(null)} /> : null}
      {statusDialog ? (
        <SubscriberStatusDialog
          subscriber={statusDialog.subscriber}
          target={statusDialog.target}
          onClose={() => setStatusDialog(null)}
          onDone={() => setViewing(null)}
        />
      ) : null}
      {deleteTarget ? <SubscriberDeleteDialog subscriber={deleteTarget} onClose={() => setDeleteTarget(null)} onDone={() => setViewing(null)} /> : null}
    </>
  );
}

// ---------------- Campaigns ----------------

function CampaignsPanel() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [viewing, setViewing] = useState<NewsletterCampaign | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const list = useCampaignList({ page, limit });
  const rows = list.data?.data ?? [];

  const menu = (c: NewsletterCampaign): MenuItem[] => [
    { key: 'view', label: 'View campaign', icon: <Eye className="size-4" />, onSelect: () => setViewing(c) },
  ];

  return (
    <>
      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Campaign history</h2>
            <p className="text-xs text-ink-muted">Every campaign queues emails to verified subscribers only.</p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="shrink-0">
            <Send className="size-3.5" aria-hidden />
            New campaign
          </Button>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isPending && !rows.length ? (
          <EmptyState
            icon={<Megaphone className="size-5" aria-hidden />}
            title="No campaigns yet"
            description="Create your first newsletter campaign to reach verified subscribers."
            action={<Button size="sm" onClick={() => setCreateOpen(true)}>New campaign</Button>}
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Subject</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 md:table-cell">Queued</th>
                    <th scope="col" className="hidden px-3 py-2.5 md:table-cell">Sent</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Failed</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Created</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3.5 pl-5 pr-3"><Skeleton className="h-3.5 w-64" /></td>
                          <td className="px-3 py-3.5"><Skeleton className="h-5 w-20" /></td>
                          <td className="hidden px-3 py-3.5 md:table-cell"><Skeleton className="h-3.5 w-10" /></td>
                          <td className="hidden px-3 py-3.5 md:table-cell"><Skeleton className="h-3.5 w-10" /></td>
                          <td className="hidden px-3 py-3.5 lg:table-cell"><Skeleton className="h-3.5 w-10" /></td>
                          <td className="hidden px-3 py-3.5 lg:table-cell"><Skeleton className="h-3.5 w-24" /></td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((c) => (
                        <tr key={c.id} className="group align-top transition-colors hover:bg-surface-2/50">
                          <td className="py-3.5 pl-5 pr-3">
                            <button type="button" onClick={() => setViewing(c)} className="block max-w-0 truncate text-left font-medium text-ink group-hover:text-primary" title={c.subject}>
                              {c.subject}
                            </button>
                          </td>
                          <td className="w-px px-3 py-3.5"><CampaignStatusBadge status={c.status} /></td>
                          <td className="hidden w-px px-3 py-3.5 text-xs tabular-nums text-ink-muted md:table-cell">{c.stats?.queued ?? 0}</td>
                          <td className="hidden w-px px-3 py-3.5 text-xs tabular-nums text-ink-muted md:table-cell">{c.stats?.sent ?? 0}</td>
                          <td className="hidden w-px px-3 py-3.5 text-xs tabular-nums text-ink-muted lg:table-cell">{c.stats?.failed ?? 0}</td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted lg:table-cell" title={formatDate(c.createdAt)}>
                            {formatDate(c.createdAt)}
                            <span className="block text-[11px] text-ink-subtle">{formatRelative(c.createdAt)}</span>
                          </td>
                          <td className="w-px py-3 pl-3 pr-5 text-right">
                            <ActionMenu label={`Actions for campaign ${c.subject}`} items={menu(c)} />
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
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </li>
                  ))
                : rows.map((c) => (
                    <li key={c.id} className="flex items-start gap-3 p-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Megaphone className="size-4" aria-hidden />
                      </span>
                      <button type="button" onClick={() => setViewing(c)} className="min-w-0 flex-1 space-y-1 text-left">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink">{c.subject}</span>
                          <CampaignStatusBadge status={c.status} />
                        </span>
                        <span className="block text-[11px] text-ink-subtle">
                          {c.stats?.sent ?? 0} sent · {c.stats?.queued ?? 0} queued · {formatDate(c.createdAt)}
                        </span>
                      </button>
                      <ActionMenu label={`Actions for campaign ${c.subject}`} items={menu(c)} />
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

      {viewing ? <CampaignDrawer key={viewing.id} seed={viewing} onClose={() => setViewing(null)} /> : null}
      <CampaignCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} onDone={() => setPage(1)} />
    </>
  );
}
