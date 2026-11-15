'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { RefreshButton } from '@/components/ui/refresh-button';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/query-keys';
import { EmailLogsPanel } from './logs-panel';
import { EmailTemplatesPanel } from './templates-panel';

type Tab = 'templates' | 'logs';

const TABS: { key: Tab; label: string; description: string }[] = [
  { key: 'templates', label: 'Email Templates', description: 'Create, edit and activate email templates' },
  { key: 'logs', label: 'Delivery Logs', description: 'Real delivery records from the backend' },
];

export function EmailWorkspace() {
  const [tab, setTab] = useState<Tab>('templates');
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <>
      <PageHeader
        title="Email Management"
        description="Templates and delivery logs for transactional email."
        actions={<RefreshButton queryKeys={[queryKeys.emailTemplates.all, queryKeys.emailLogs.all]} />}
      />

      <div className="mb-5">
        <div role="tablist" aria-label="Email sections" className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface-2/60 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === t.key ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 px-1 text-xs text-ink-muted">{active.description}</p>
      </div>

      {tab === 'templates' ? <EmailTemplatesPanel /> : <EmailLogsPanel />}
    </>
  );
}
