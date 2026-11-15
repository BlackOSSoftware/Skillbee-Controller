'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { RefreshButton } from '@/components/ui/refresh-button';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/query-keys';
import { CourseSeoManager } from './course-seo';
import { GlobalSeoSettings } from './global-settings';
import { PageSeoManager } from './page-seo';
import { RedirectManager } from './redirects';

type Tab = 'settings' | 'pages' | 'courses' | 'redirects';

const TABS: { key: Tab; label: string; description: string }[] = [
  { key: 'settings', label: 'Global Settings', description: 'Site-wide defaults, organization and sitemap' },
  { key: 'pages', label: 'Page SEO', description: 'Metadata for built-in public pages' },
  { key: 'courses', label: 'Course SEO', description: 'Per-course metadata, slug and social tags' },
  { key: 'redirects', label: 'Redirects', description: '301/302 redirect rules' },
];

export function SeoWorkspace() {
  const [tab, setTab] = useState<Tab>('settings');
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <>
      <PageHeader
        title="SEO Management"
        description="Global defaults, page metadata, course SEO and redirects."
        actions={<RefreshButton queryKeys={[queryKeys.seo.all]} />}
      />

      <div className="mb-5">
        <div role="tablist" aria-label="SEO sections" className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface-2/60 p-1">
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

      {tab === 'settings' ? <GlobalSeoSettings /> : null}
      {tab === 'pages' ? <PageSeoManager /> : null}
      {tab === 'courses' ? <CourseSeoManager /> : null}
      {tab === 'redirects' ? <RedirectManager /> : null}
    </>
  );
}
