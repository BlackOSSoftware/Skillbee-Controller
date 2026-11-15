import { PlugZap, TriangleAlert } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/page-header';
import { env } from '@/lib/env';
import type { ModuleDefinition, ModuleStatus } from '@/types/modules';

const statusMeta: Record<ModuleStatus, { label: string; tone: BadgeTone; message: string }> = {
  live: { label: 'Live', tone: 'success', message: 'This module is connected.' },
  'api-ready': {
    label: 'Backend ready',
    tone: 'info',
    message: 'Backend endpoints exist. The management screen for this module is the next increment.',
  },
  partial: {
    label: 'Partial API',
    tone: 'warning',
    message: 'Only part of this module is supported by the backend.',
  },
  'missing-api': {
    label: 'No backend API',
    tone: 'danger',
    message: 'This module cannot be built until the backend provides endpoints.',
  },
};

const methodTone: Record<string, BadgeTone> = {
  GET: 'success',
  POST: 'brand',
  PATCH: 'warning',
  PUT: 'warning',
  DELETE: 'danger',
};

/** Module landing for modules whose screens are not built yet; lists the real backend contract. */
export function ModuleWorkspace({ module }: { module: ModuleDefinition }) {
  const meta = statusMeta[module.status];
  return (
    <>
      <PageHeader title={module.label} description={module.description} actions={<Badge tone={meta.tone}>{meta.label}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Backend endpoints" description={`Base URL: ${env.apiBaseUrl}`} />
          {module.endpoints.length ? (
            <ul className="divide-y divide-line">
              {module.endpoints.map((ep) => (
                <li key={`${ep.method}-${ep.path}`} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="w-16 shrink-0">
                    <Badge tone={methodTone[ep.method]}>{ep.method}</Badge>
                  </span>
                  <code className="truncate font-mono text-xs text-ink">{ep.path}</code>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<TriangleAlert className="size-5" aria-hidden />}
              title="No endpoints available"
              description={module.note}
            />
          )}
        </Card>
        <Card>
          <CardHeader title="Status" />
          <div className="space-y-3 px-5 py-4 text-sm text-ink-muted">
            <p className="flex items-start gap-2">
              <PlugZap className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
              {meta.message}
            </p>
            {module.note && module.endpoints.length ? <p className="text-xs text-ink-muted">{module.note}</p> : null}
          </div>
        </Card>
      </div>
    </>
  );
}
