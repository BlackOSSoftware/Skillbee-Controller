'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { ErrorState, Spinner } from '@/components/ui/states';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMyNotifications,
} from '@/features/notifications/hooks';
import { useDismiss } from '@/hooks/use-dismiss';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const notifications = useMyNotifications(8);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = notifications.data?.data ?? [];
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell className="size-[18px]" />
        {unread ? (
          <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-danger text-[9px] font-semibold text-white dark:text-canvas">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={!unread || markAll.isPending}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover disabled:cursor-not-allowed disabled:text-ink-subtle"
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.isPending ? (
              <div className="p-6 text-center">
                <Spinner />
              </div>
            ) : notifications.isError ? (
              <ErrorState error={notifications.error} onRetry={() => notifications.refetch()} />
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-ink-muted">You have no notifications.</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => !n.isRead && markRead.mutate(n.id)}
                      className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2', !n.isRead && 'bg-primary/5')}
                    >
                      <span
                        className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : 'bg-primary/100')}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{n.title}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-ink-muted">{n.message}</span>
                        <span className="mt-1 block text-[11px] text-ink-subtle">{formatRelative(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
