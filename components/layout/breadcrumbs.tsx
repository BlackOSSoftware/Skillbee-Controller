'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { findModuleByPath } from '@/lib/navigation';

export function Breadcrumbs() {
  const pathname = usePathname();
  const current = findModuleByPath(pathname);

  const crumbs: Array<{ label: string; href?: string }> = [{ label: 'Home', href: '/dashboard' }];
  if (current && current.slug !== 'dashboard') {
    crumbs.push({ label: current.group });
    crumbs.push({ label: current.label });
  } else {
    crumbs.push({ label: 'Dashboard' });
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {crumb.href && !last ? (
                <Link href={crumb.href} className="hover:text-ink">
                  {crumb.label}
                </Link>
              ) : (
                <span className={last ? 'font-medium text-ink' : undefined} aria-current={last ? 'page' : undefined}>
                  {crumb.label}
                </span>
              )}
              {!last ? <ChevronRight className="size-3 text-ink-subtle" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
