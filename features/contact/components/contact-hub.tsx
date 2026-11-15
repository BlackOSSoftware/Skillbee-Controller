'use client';

import { Inbox, LifeBuoy } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { EnquiriesManagement } from './enquiries-management';
import { TicketsManagement } from '../../support/components/tickets-management';
import { useEnquiryStats } from '../hooks';
import { useTicketStats } from '../../support/hooks';

type Tab = 'enquiries' | 'tickets';

/** Contact & Enquiries hub: website enquiries and student support tickets. */
export function ContactHub() {
  const [tab, setTabState] = useState<Tab>('enquiries');
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set(['enquiries']));
  const enquiryStats = useEnquiryStats();
  const ticketStats = useTicketStats();

  function setTab(next: Tab) {
    setTabState(next);
    setVisited((v) => (v.has(next) ? v : new Set(v).add(next)));
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof Inbox; count: number | null }> = [
    { id: 'enquiries', label: 'Website enquiries', icon: Inbox, count: enquiryStats.all.value },
    { id: 'tickets', label: 'Support tickets', icon: LifeBuoy, count: ticketStats.all.value },
  ];

  return (
    <>
      <PageHeader title="Contact & Enquiries" description="Website contact submissions and student support tickets." />

      <div role="tablist" aria-label="Contact and support sections" className="mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none]">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`contact-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`contact-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35',
                tab === t.id ? 'border-primary font-semibold text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t.label}
              {t.count !== null ? (
                <span className={cn('rounded px-1.5 py-px text-[11px] tabular-nums', tab === t.id ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-ink-muted')}>
                  {formatNumber(t.count)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Visited panels stay mounted (hidden) so filters and pages survive tab switches. */}
      <div role="tabpanel" id="contact-panel-enquiries" aria-labelledby="contact-tab-enquiries" hidden={tab !== 'enquiries'}>
        <EnquiriesManagement />
      </div>
      {visited.has('tickets') ? (
        <div role="tabpanel" id="contact-panel-tickets" aria-labelledby="contact-tab-tickets" hidden={tab !== 'tickets'}>
          <TicketsManagement />
        </div>
      ) : null}
    </>
  );
}
