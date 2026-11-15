'use client';

import { KpiCard, type KpiTone } from '@/components/ui/kpi-card';
import { useDashboardStat } from '../hooks';
import type { DashboardStatDefinition } from '../stats';

/** Cycles the theme palette so neighbouring cards differ. */
const TONE_CYCLE: KpiTone[] = ['purple', 'sky', 'coral', 'teal'];

export function StatCard({ stat, index }: { stat: DashboardStatDefinition; index: number }) {
  const result = useDashboardStat(stat);
  const unavailable = stat.unavailableReason ? `Not available — ${stat.unavailableReason}` : undefined;

  return (
    <KpiCard
      label={stat.label}
      icon={stat.icon}
      tone={unavailable ? 'slate' : TONE_CYCLE[index % TONE_CYCLE.length]}
      value={result.value}
      isLoading={result.isLoading}
      error={result.error}
      hint={unavailable ? undefined : stat.hint}
      unavailable={unavailable}
      href={stat.href && !unavailable ? stat.href : undefined}
      className="h-full"
    />
  );
}
