'use client';

import { History, ScrollText, ShieldCheck, UserRound } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

/**
 * Honest unavailable state — the backend has no global audit log endpoint.
 * Per-record history (orders, enrollments, certificates, submissions) remains
 * available inside those modules and is intentionally not duplicated here.
 */
export function AuditLogsWorkspace() {
  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" description="System-wide administrative audit trail." />

      <Card>
        <div className="flex flex-col items-center px-6 py-14 text-center sm:px-10">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ScrollText className="size-7" aria-hidden />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-ink">System-wide audit logging is not currently available</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">
            The backend does not yet expose a dedicated audit API, so there are no administrative action records to display.
            Nothing on this page is fabricated — no events are being collected or shown.
          </p>
        </div>

        <div className="border-t border-line px-6 py-6 sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">What a future audit API would provide</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: UserRound, label: 'Actor information', desc: 'Which admin or system process performed the action.' },
              { icon: ShieldCheck, label: 'Action & resource', desc: 'Action type and the affected record (user, course, order…).' },
              { icon: History, label: 'Before / after changes', desc: 'Field-level diffs for updates and status transitions.' },
            ].map(({ icon: Icon, label, desc }) => (
              <li key={label} className="flex gap-3 rounded-lg border border-line/60 bg-surface-2/30 p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-muted">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink">{label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-ink-subtle">
            A complete implementation also needs timestamps, IP address or request metadata, and a paginated, filterable
            endpoint (e.g. <code className="rounded bg-surface-2 px-1">GET /admin/audit-logs</code>). Per-record history —
            order history, enrollment history, certificate history and submission history — remains available inside each
            respective module.
          </p>
        </div>
      </Card>
    </div>
  );
}
