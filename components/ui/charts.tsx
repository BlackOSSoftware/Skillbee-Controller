'use client';

import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

export interface ChartSegment {
  label: string;
  value: number;
  /** CSS color — defaults cycle through theme tokens. */
  color?: string;
}

const PALETTE = ['var(--primary)', 'var(--accent)', 'var(--success)', 'var(--warning)', 'var(--danger)', 'var(--brand-soft)'];

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

interface DonutChartProps {
  segments: ChartSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}

/** SVG donut with legend. Zero-total renders an empty ring. */
export function DonutChart({ segments, size = 148, thickness = 20, centerLabel, centerValue, className }: DonutChartProps) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  let angle = 0;

  return (
    <div className={cn('flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={centerLabel ?? 'Chart'}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
          {total > 0
            ? segments
                .filter((s) => s.value > 0)
                .map((s, i) => {
                  const frac = s.value / total;
                  const start = angle;
                  const end = angle + frac * 360;
                  angle = end;
                  return (
                    <path
                      key={s.label}
                      d={arcPath(cx, cy, r, start, Math.min(end, start + 359.99))}
                      fill="none"
                      stroke={s.color ?? PALETTE[i % PALETTE.length]}
                      strokeWidth={thickness}
                      strokeLinecap="butt"
                    />
                  );
                })
            : null}
        </svg>
        {centerValue || centerLabel ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue ? <span className="text-xl font-bold tabular-nums text-ink">{centerValue}</span> : null}
            {centerLabel ? <span className="text-[11px] text-ink-muted">{centerLabel}</span> : null}
          </div>
        ) : null}
      </div>
      <ul className="w-full min-w-0 space-y-1.5">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color ?? PALETTE[i % PALETTE.length] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ink-muted">{s.label}</span>
            <span className="font-semibold tabular-nums text-ink">{formatNumber(s.value)}</span>
            <span className="w-12 text-right text-[11px] tabular-nums text-ink-subtle">
              {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface BarRow {
  label: string;
  value: number;
  hint?: string;
}

interface BarListProps {
  rows: BarRow[];
  /** Max bar width in px. */
  maxWidth?: number;
  formatValue?: (v: number) => string;
  emptyLabel?: string;
  className?: string;
}

/** Horizontal bar list — used for status breakdowns. */
export function BarList({ rows, maxWidth = 220, formatValue = formatNumber, emptyLabel = 'No data', className }: BarListProps) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) {
    return <p className="py-6 text-center text-xs text-ink-subtle">{emptyLabel}</p>;
  }
  return (
    <ul className={cn('space-y-2.5', className)}>
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <span className="truncate text-xs text-ink-muted" title={r.label}>{r.label}</span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-ink">
              {formatValue(r.value)}
              {r.hint ? <span className="ml-1 font-normal text-ink-subtle">{r.hint}</span> : null}
            </span>
          </div>
          <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="presentation">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, maxWidth }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
