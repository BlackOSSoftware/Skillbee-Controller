import { cn } from '@/lib/cn';
import { initialsOf } from '@/lib/roles';
import type { AdminUser } from '@/types/users';

export function UserAvatar({ user, size = 'md' }: { user: AdminUser; size?: 'md' | 'lg' }) {
  const box = cn(
    'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary',
    size === 'lg' ? 'size-14 text-base' : 'size-9 text-xs'
  );
  if (user.profileImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.profileImage} alt="" className={cn(box, 'object-cover')} aria-hidden />
    );
  }
  return (
    <span className={box} aria-hidden>
      {initialsOf(user)}
    </span>
  );
}
