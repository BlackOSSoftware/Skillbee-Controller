'use client';

import { ChevronDown, LogOut, UserCog } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { useLogoutMutation } from '@/features/auth/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useDismiss } from '@/hooks/use-dismiss';
import { titleCase } from '@/lib/format';
import { displayName, initialsOf } from '@/lib/roles';

export function ProfileMenu() {
  const { user } = useAuth();
  const logout = useLogoutMutation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  if (!user) return null;
  const roleLabel = user.role?.name || titleCase(user.role?.slug || '');

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 hover:bg-surface-2"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {initialsOf(user)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-36 truncate text-sm font-medium text-ink">{displayName(user)}</span>
          <span className="block text-[11px] text-ink-muted">{roleLabel}</span>
        </span>
        <ChevronDown className="hidden size-4 text-ink-subtle sm:block" aria-hidden />
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-pop">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-medium text-ink">{displayName(user)}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
          </div>
          <Link
            href="/profile"
            role="menuitem"
            onClick={close}
            className="flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-surface-2"
          >
            <UserCog className="size-4 text-ink-subtle" aria-hidden />
            Profile &amp; settings
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden />
            {logout.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
