'use client';

import { useState, type ReactNode } from 'react';
import { Breadcrumbs } from './breadcrumbs';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed';
import { cn } from '@/lib/cn';

export function DashboardShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <div className="min-h-screen">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
      />
      <div
        className={cn(
          'transition-[padding] duration-300 ease-out',
          collapsed ? 'lg:pl-16' : 'lg:pl-64'
        )}
      >
        <Topbar
          onOpenMenu={() => setMobileOpen(true)}
          collapsed={collapsed}
          onToggleCollapse={toggle}
        />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}
