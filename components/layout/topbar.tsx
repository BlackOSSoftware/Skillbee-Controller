'use client';

import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ModuleSearch } from './module-search';
import { NotificationsMenu } from './notifications-menu';
import { ProfileMenu } from './profile-menu';
import { ThemeToggle } from './theme-toggle';

export function Topbar({
  onOpenMenu,
  collapsed,
  onToggleCollapse,
}: {
  onOpenMenu: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>
      {onToggleCollapse ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 lg:flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
        </button>
      ) : null}
      <ModuleSearch />
      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <NotificationsMenu />
        <div className="mx-1 h-6 w-px bg-line" aria-hidden />
        <ProfileMenu />
      </div>
    </header>
  );
}
