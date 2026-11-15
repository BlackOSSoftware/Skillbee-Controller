import { cn } from '@/lib/cn';
import { initialsOf } from '@/lib/roles';
import type { AdminUser } from '@/types/users';

export function UserAvatar({ user, size = 'md' }: { user: AdminUser; size?: 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary',
        size === 'lg' ? 'size-14 text-base' : 'size-9 text-xs'
      )}
      aria-hidden
    >
      {initialsOf(user)}
    </span>
  );
}
