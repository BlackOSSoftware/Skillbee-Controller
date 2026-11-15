import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MODULES } from '@/lib/navigation';

/** Shows which sidebar modules lack backend support, so gaps are visible instead of faked. */
export function ApiCoverageCard() {
  const gaps = MODULES.filter((m) => m.status === 'missing-api' || m.status === 'partial');
  return (
    <Card>
      <CardHeader title="Backend coverage gaps" description="Modules without full backend APIs" />
      <ul className="divide-y divide-line">
        {gaps.map((m) => (
          <li key={m.slug} className="px-5 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">{m.label}</span>
              <Badge tone={m.status === 'missing-api' ? 'danger' : 'warning'}>
                {m.status === 'missing-api' ? 'No API' : 'Partial'}
              </Badge>
            </div>
            {m.note ? <p className="mt-1 text-xs text-ink-muted">{m.note}</p> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
