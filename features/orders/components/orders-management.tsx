'use client';

import { CircleCheckBig, Clock3, Receipt, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { RefreshButton } from '@/components/ui/refresh-button';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { useCommerceStats } from '../hooks';
import { GatewaysPanel } from './gateways-panel';
import { OrdersPanel, type OrderPreset } from './orders-panel';
import { RefundsPanel } from './refunds-panel';

type Tab = 'orders' | 'refunds' | 'gateways';

export function OrdersManagement() {
  const stats = useCommerceStats();
  const [tab, setTabState] = useState<Tab>('orders');
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set(['orders']));
  const [preset, setPreset] = useState<OrderPreset & { v: number }>({ v: 0 });

  function setTab(next: Tab) {
    setTabState(next);
    setVisited((v) => (v.has(next) ? v : new Set(v).add(next)));
  }

  function openOrders(p: OrderPreset) {
    setPreset((x) => ({ ...p, v: x.v + 1 }));
    setTab('orders');
  }

  const tabs: Array<{ id: Tab; label: string; count: number | null }> = [
    { id: 'orders', label: 'Orders', count: stats.orders.value },
    { id: 'refunds', label: 'Refunds', count: stats.refunds.value },
    { id: 'gateways', label: 'Payment gateways', count: null },
  ];

  return (
    <>
      <PageHeader title="Orders & Payments" description="Course purchases, refunds and payment gateway configuration." actions={<RefreshButton queryKeys={[queryKeys.commerce.all]} />} />

      <section aria-label="Commerce overview" className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Orders" hint="All statuses" icon={Receipt} tone="purple" value={stats.orders.value} isLoading={stats.orders.isLoading} error={stats.orders.error} onClick={() => openOrders({})} />
        <KpiCard label="Completed" hint="Paid and fulfilled" icon={CircleCheckBig} tone="teal" value={stats.completed.value} isLoading={stats.completed.isLoading} error={stats.completed.error} onClick={() => openOrders({ orderStatus: 'completed' })} />
        <KpiCard label="Pending" hint="Awaiting payment" icon={Clock3} tone="amber" value={stats.pending.value} isLoading={stats.pending.isLoading} error={stats.pending.error} onClick={() => openOrders({ orderStatus: 'pending' })} />
        <KpiCard label="Refunds" hint="All refund requests" icon={RotateCcw} tone="coral" value={stats.refunds.value} isLoading={stats.refunds.isLoading} error={stats.refunds.error} onClick={() => setTab('refunds')} />
      </section>

      <div role="tablist" aria-label="Orders and payments sections" className="mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`commerce-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`commerce-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35',
              tab === t.id ? 'border-primary font-semibold text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            )}
          >
            {t.label}
            {t.count !== null ? <span className={cn('rounded px-1.5 py-px text-[11px] tabular-nums', tab === t.id ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-ink-muted')}>{formatNumber(t.count)}</span> : null}
          </button>
        ))}
      </div>

      {/* Visited panels stay mounted (hidden) so their filters and pages survive tab switches. */}
      <div role="tabpanel" id="commerce-panel-orders" aria-labelledby="commerce-tab-orders" hidden={tab !== 'orders'}>
        <OrdersPanel key={`o-${preset.v}`} preset={preset} />
      </div>
      {visited.has('refunds') ? (
        <div role="tabpanel" id="commerce-panel-refunds" aria-labelledby="commerce-tab-refunds" hidden={tab !== 'refunds'}>
          <RefundsPanel />
        </div>
      ) : null}
      {visited.has('gateways') ? (
        <div role="tabpanel" id="commerce-panel-gateways" aria-labelledby="commerce-tab-gateways" hidden={tab !== 'gateways'}>
          <GatewaysPanel />
        </div>
      ) : null}
    </>
  );
}
