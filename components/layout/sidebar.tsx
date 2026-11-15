'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { BrandMark } from '@/components/brand/brand-logo';
import { useAccessibleModules } from '@/hooks/use-module-access';
import { cn } from '@/lib/cn';
import { MODULE_GROUP_ORDER } from '@/lib/navigation';
import type { ModuleGroup, ModuleStatus } from '@/types/modules';

const statusHint: Partial<Record<ModuleStatus, { label: string; className: string }>> = {
  'missing-api': { label: 'No API', className: 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-300/20' },
  partial: { label: 'Partial', className: 'bg-slate-500/[0.07] text-sidebar-ink-muted ring-slate-500/15 dark:bg-white/5 dark:ring-white/10' },
};

/** One soft accent per section; full class strings so Tailwind can see them. */
const GROUP_TONE: Record<ModuleGroup, { dot: string; tile: string; tileActive: string; icon: string; iconActive: string }> = {
  Overview: {
    dot: 'bg-sky-400',
    tile: 'bg-sky-500/10 group-hover:bg-sky-500/15 dark:bg-sky-400/10 dark:group-hover:bg-sky-400/20',
    tileActive: 'bg-sky-500/15 ring-sky-500/20 dark:bg-sky-400/25 dark:ring-sky-300/30',
    icon: 'text-sky-500 dark:text-sky-300',
    iconActive: 'text-sky-600 dark:text-sky-100',
  },
  People: {
    dot: 'bg-violet-400',
    tile: 'bg-violet-500/10 group-hover:bg-violet-500/15 dark:bg-violet-400/10 dark:group-hover:bg-violet-400/20',
    tileActive: 'bg-violet-500/15 ring-violet-500/20 dark:bg-violet-400/25 dark:ring-violet-300/30',
    icon: 'text-violet-500 dark:text-violet-300',
    iconActive: 'text-violet-600 dark:text-violet-100',
  },
  Learning: {
    dot: 'bg-teal-400',
    tile: 'bg-teal-500/10 group-hover:bg-teal-500/15 dark:bg-teal-400/10 dark:group-hover:bg-teal-400/20',
    tileActive: 'bg-teal-500/15 ring-teal-500/20 dark:bg-teal-400/25 dark:ring-teal-300/30',
    icon: 'text-teal-500 dark:text-teal-300',
    iconActive: 'text-teal-600 dark:text-teal-100',
  },
  Commerce: {
    dot: 'bg-amber-400',
    tile: 'bg-amber-500/10 group-hover:bg-amber-500/15 dark:bg-amber-400/10 dark:group-hover:bg-amber-400/20',
    tileActive: 'bg-amber-500/15 ring-amber-500/20 dark:bg-amber-400/25 dark:ring-amber-300/30',
    icon: 'text-amber-500 dark:text-amber-300',
    iconActive: 'text-amber-600 dark:text-amber-100',
  },
  Engagement: {
    dot: 'bg-rose-400',
    tile: 'bg-rose-500/10 group-hover:bg-rose-500/15 dark:bg-rose-400/10 dark:group-hover:bg-rose-400/20',
    tileActive: 'bg-rose-500/15 ring-rose-500/20 dark:bg-rose-400/25 dark:ring-rose-300/30',
    icon: 'text-rose-500 dark:text-rose-300',
    iconActive: 'text-rose-600 dark:text-rose-100',
  },
  'Content & SEO': {
    dot: 'bg-violet-400',
    tile: 'bg-violet-500/10 group-hover:bg-violet-500/15 dark:bg-violet-400/10 dark:group-hover:bg-violet-400/20',
    tileActive: 'bg-violet-500/15 ring-violet-500/20 dark:bg-violet-400/25 dark:ring-violet-300/30',
    icon: 'text-violet-500 dark:text-violet-300',
    iconActive: 'text-violet-600 dark:text-violet-100',
  },
  Communication: {
    dot: 'bg-teal-400',
    tile: 'bg-teal-500/10 group-hover:bg-teal-500/15 dark:bg-teal-400/10 dark:group-hover:bg-teal-400/20',
    tileActive: 'bg-teal-500/15 ring-teal-500/20 dark:bg-teal-400/25 dark:ring-teal-300/30',
    icon: 'text-teal-500 dark:text-teal-300',
    iconActive: 'text-teal-600 dark:text-teal-100',
  },
  System: {
    dot: 'bg-sky-400',
    tile: 'bg-sky-500/10 group-hover:bg-sky-500/15 dark:bg-sky-400/10 dark:group-hover:bg-sky-400/20',
    tileActive: 'bg-sky-500/15 ring-sky-500/20 dark:bg-sky-400/25 dark:ring-sky-300/30',
    icon: 'text-sky-500 dark:text-sky-300',
    iconActive: 'text-sky-600 dark:text-sky-100',
  },
};

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
}

export function Sidebar({ mobileOpen, onClose, collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const modules = useAccessibleModules();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [pathname]);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-30 bg-overlay transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-line bg-linear-to-b from-sidebar to-sidebar-2 text-sidebar-ink transition-[width,transform] duration-300 ease-out lg:translate-x-0',
          collapsed ? 'w-16' : 'w-64',
          'shadow-[1px_0_24px_-12px_rgb(45_49_66/0.12)] dark:shadow-[1px_0_24px_-12px_rgb(0_0_0/0.5)]',
          mobileOpen ? 'translate-x-0 shadow-pop' : '-translate-x-full lg:translate-x-0'
        )}
        aria-label="Main navigation"
      >
        <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            onClick={onClose}
            title={collapsed ? 'SkillBee Admin' : undefined}
          >
            <BrandMark size={36} priority />
            {!collapsed ? (
              <span className="leading-tight">
                <span className="block text-[15px] font-bold tracking-tight text-sky-500 dark:text-sky-400">SkillBee</span>
                <span className="block text-[11px] font-medium text-sidebar-ink-subtle">Admin console</span>
              </span>
            ) : null}
          </Link>
          <button
            className="rounded-md p-1.5 text-sidebar-ink-subtle transition-colors hover:bg-sidebar-hover hover:text-sidebar-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav ref={navRef} className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-6 pt-4">
          {MODULE_GROUP_ORDER.map((group) => {
            const items = modules.filter((m) => m.group === group);
            if (!items.length) return null;
            const tone = GROUP_TONE[group];
            return (
              <div key={group} className={cn('mb-5 last:mb-0', collapsed && 'mb-3')}>
                {!collapsed ? (
                  <p className="flex items-center gap-2 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-ink-subtle">
                    <span className={cn('size-1.5 rounded-full opacity-80', tone.dot)} aria-hidden />
                    {group}
                  </p>
                ) : (
                  <div className="mx-2 mb-2 border-t border-sidebar-line" aria-hidden />
                )}
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    const hint = statusHint[item.status];
                    return (
                      <li key={item.slug}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          aria-current={active ? 'page' : undefined}
                          title={collapsed ? item.label : undefined}
                          className={cn(
                            'group relative flex items-center gap-3 rounded-lg py-1.5 text-[13px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                            collapsed ? 'justify-center px-2' : 'pl-2 pr-2.5',
                            active
                              ? 'bg-sidebar-active font-semibold text-sky-600 dark:text-sky-300'
                              : 'font-medium text-sidebar-ink-muted hover:bg-sidebar-hover hover:text-sidebar-ink'
                          )}
                        >
                          <span
                            className={cn(
                              'absolute inset-y-2 -left-3 w-[3px] rounded-r-full bg-linear-to-b from-cyan-400 to-sky-500 transition-opacity duration-200',
                              active ? 'opacity-100' : 'opacity-0'
                            )}
                            aria-hidden
                          />
                          <span
                            className={cn(
                              'flex size-7 shrink-0 items-center justify-center rounded-md transition-all duration-200',
                              active ? cn('ring-1 ring-inset', tone.tileActive) : cn(tone.tile, 'motion-safe:group-hover:scale-105')
                            )}
                          >
                            <Icon className={cn('size-[15px] transition-colors duration-200', active ? tone.iconActive : cn(tone.icon, 'opacity-90 group-hover:opacity-100'))} aria-hidden />
                          </span>
                          {!collapsed ? (
                            <>
                              <span className="flex-1 truncate transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">{item.label}</span>
                              {hint ? (
                                <span className={cn('inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset', hint.className)}>{hint.label}</span>
                              ) : null}
                            </>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
