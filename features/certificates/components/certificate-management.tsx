'use client';

import { Ban, BadgeCheck, FileBadge2, LayoutTemplate } from 'lucide-react';
import { useState } from 'react';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { RefreshButton } from '@/components/ui/refresh-button';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { useCertificateStats } from '../hooks';
import { IssuedPanel } from './issued-panel';
import { TemplatesPanel } from './templates-panel';

type Tab = 'issued' | 'templates';

export function CertificateManagement() {
  const stats = useCertificateStats();
  const [tab, setTabState] = useState<Tab>('issued');
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set(['issued']));

  function setTab(next: Tab) {
    setTabState(next);
    setVisited((v) => (v.has(next) ? v : new Set(v).add(next)));
  }

  const tabs: Array<{ id: Tab; label: string; count: number | null }> = [
    { id: 'issued', label: 'Issued certificates', count: null },
    { id: 'templates', label: 'Templates', count: stats.templates.value },
  ];

  return (
    <>
      <PageHeader
        title="Certificate Management"
        description="Issue, verify and maintain course completion certificates and their templates."
        actions={<RefreshButton queryKeys={[queryKeys.certificates.all]} />}
      />

      <section aria-label="Certificate overview" className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Issued" hint="Valid certificates" icon={BadgeCheck} tone="teal" value={stats.issued.value} isLoading={stats.issued.isLoading} error={stats.issued.error} onClick={() => setTab('issued')} />
        <KpiCard label="Revoked" hint="Kept for history" icon={Ban} tone="coral" value={stats.revoked.value} isLoading={stats.revoked.isLoading} error={stats.revoked.error} onClick={() => setTab('issued')} />
        <KpiCard label="Templates" hint="All statuses" icon={LayoutTemplate} tone="purple" value={stats.templates.value} isLoading={stats.templates.isLoading} error={stats.templates.error} onClick={() => setTab('templates')} />
        <KpiCard label="Active templates" hint="Available for issuing" icon={FileBadge2} tone="sky" value={stats.activeTemplates.value} isLoading={stats.activeTemplates.isLoading} error={stats.activeTemplates.error} onClick={() => setTab('templates')} />
      </section>

      <div role="tablist" aria-label="Certificate sections" className="mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`cert-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`cert-panel-${t.id}`}
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
      <div role="tabpanel" id="cert-panel-issued" aria-labelledby="cert-tab-issued" hidden={tab !== 'issued'}>
        <IssuedPanel />
      </div>
      {visited.has('templates') ? (
        <div role="tabpanel" id="cert-panel-templates" aria-labelledby="cert-tab-templates" hidden={tab !== 'templates'}>
          <TemplatesPanel />
        </div>
      ) : null}
    </>
  );
}
