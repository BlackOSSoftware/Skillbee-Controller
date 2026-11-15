'use client';

import { Check, Hourglass, Lock, TriangleAlert, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

export type KpiTone = 'purple' | 'teal' | 'sky' | 'coral' | 'amber' | 'slate';

/** Soft gradient card with a tinted shadow (deeper in dark). Full class strings so Tailwind can see them. */
const TONES: Record<KpiTone, { card: string; ring: string; check: string }> = {
  purple: {
    card: 'from-[#c78ff6] to-[#9a73f0] shadow-[0_10px_24px_-12px_rgb(154_115_240/0.75)] dark:from-[#a970ea] dark:to-[#7c5ce0] dark:shadow-[0_10px_26px_-14px_rgb(124_92_224/0.7)]',
    ring: 'ring-[#9a73f0]/55',
    check: 'text-[#8a63e6]',
  },
  sky: {
    card: 'from-[#6db4f2] to-[#6a78ef] shadow-[0_10px_24px_-12px_rgb(106_120_239/0.75)] dark:from-[#4f9be6] dark:to-[#5763e0] dark:shadow-[0_10px_26px_-14px_rgb(87_99_224/0.7)]',
    ring: 'ring-[#6a78ef]/55',
    check: 'text-[#5a68e0]',
  },
  coral: {
    card: 'from-[#ffb68c] to-[#ff8c8f] shadow-[0_10px_24px_-12px_rgb(255_140_143/0.8)] dark:from-[#f39a72] dark:to-[#ec6f7b] dark:shadow-[0_10px_26px_-14px_rgb(236_111_123/0.65)]',
    ring: 'ring-[#ff8c8f]/60',
    check: 'text-[#f0727a]',
  },
  teal: {
    card: 'from-[#5ed8c3] to-[#2fb2c0] shadow-[0_10px_24px_-12px_rgb(47_178_192/0.75)] dark:from-[#3cc2ad] dark:to-[#1f97a8] dark:shadow-[0_10px_26px_-14px_rgb(31_151_168/0.65)]',
    ring: 'ring-[#2fb2c0]/55',
    check: 'text-[#22a0ae]',
  },
  amber: {
    card: 'from-[#ffcf72] to-[#ffa25a] shadow-[0_10px_24px_-12px_rgb(255_162_90/0.8)] dark:from-[#eeb752] dark:to-[#ec8a45] dark:shadow-[0_10px_26px_-14px_rgb(236_138_69/0.6)]',
    ring: 'ring-[#ffa25a]/60',
    check: 'text-[#e88a3d]',
  },
  slate: {
    card: 'from-[#a3afc4] to-[#7c88a0] shadow-[0_10px_24px_-12px_rgb(124_136_160/0.75)] dark:from-[#5d6880] dark:to-[#454f66] dark:shadow-[0_10px_26px_-14px_rgb(0_0_0/0.6)]',
    ring: 'ring-[#7c88a0]/55',
    check: 'text-[#6b778f]',
  },
};

interface KpiCardProps {
  label: string;
  icon: LucideIcon;
  tone: KpiTone;
  value: number | string | null | undefined;
  isLoading?: boolean;
  error?: unknown;
  hint?: ReactNode;
  /** Filter cards: marks the card whose filter is applied. */
  active?: boolean;
  onClick?: () => void;
  href?: string;
  /** Replaces the value when the metric cannot be computed. */
  unavailable?: string;
  className?: string;
}

function ErrorNote({ error }: { error: unknown }) {
  const { status, message } = normalizeApiError(error);
  const Icon = status === 429 ? Hourglass : status === 403 ? Lock : TriangleAlert;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/20 px-1.5 py-0.5 text-xs font-medium text-white" title={message}>
      <Icon className="size-3.5" aria-hidden />
      {status === 429 ? 'Rate limited' : status === 403 ? 'No permission' : 'Failed to load'}
    </span>
  );
}

export function KpiCard({ label, icon: Icon, tone, value, isLoading, error, hint, active, onClick, href, unavailable, className }: KpiCardProps) {
  const t = TONES[tone];
  const body = (
    <>
      <span className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-white/[0.14] dark:bg-white/[0.1]" aria-hidden />
      <span className="pointer-events-none absolute -bottom-14 right-6 size-32 rounded-full bg-white/[0.12] dark:bg-white/[0.08]" aria-hidden />

      <span className="relative flex items-start justify-between gap-2">
        <span className="min-w-0 text-[13px] font-semibold leading-tight text-white/90">{label}</span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white ring-1 ring-inset ring-white/25" aria-hidden>
          <Icon className="size-4" />
        </span>
      </span>
      <span className="relative mt-2 block min-h-8">
        {unavailable ? (
          <span className="block text-xs leading-snug text-white/85">{unavailable}</span>
        ) : isLoading ? (
          <span className="mt-1 block h-7 w-16 animate-pulse rounded bg-white/25" aria-hidden />
        ) : error ? (
          <ErrorNote error={error} />
        ) : (
          <span className="block text-[26px] font-bold tabular-nums tracking-tight text-white">
            {typeof value === 'number' ? formatNumber(value) : (value ?? '—')}
          </span>
        )}
      </span>
      {hint ? <span className="relative mt-1 block truncate text-[11px] font-medium text-white/80">{hint}</span> : null}
      {active ? (
        <span className={cn('absolute bottom-3 right-3 flex size-5 items-center justify-center rounded-full bg-white shadow-sm', t.check)} aria-hidden>
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : null}
    </>
  );

  const classes = cn(
    'group relative block min-w-0 overflow-hidden rounded-xl bg-linear-to-br p-4 text-left transition duration-200 sm:p-5',
    t.card,
    (onClick || href) && 'hover:-translate-y-0.5 hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:ring-primary/50',
    active && cn('ring-2 ring-offset-2 ring-offset-canvas', t.ring),
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={classes}>
        {body}
      </button>
    );
  }
  return <div className={classes}>{body}</div>;
}
