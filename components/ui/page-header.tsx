'use client';

import type { LucideIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { MODULES } from '@/lib/navigation';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Defaults to the icon of the module that owns the current route. */
  icon?: LucideIcon;
}

export function PageHeader({ title, description, actions, icon }: PageHeaderProps) {
  const pathname = usePathname();
  const Icon = icon ?? MODULES.find((m) => pathname === m.href || pathname.startsWith(`${m.href}/`))?.icon;

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-cyan-400 to-sky-500 text-white shadow-[0_8px_18px_-8px_rgb(14_165_233/0.7)] dark:shadow-[0_8px_18px_-10px_rgb(14_165_233/0.6)]"
            aria-hidden
          >
            <Icon className="size-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
