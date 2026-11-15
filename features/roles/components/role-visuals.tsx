import { Crown, GraduationCap, Shapes, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ROLE_SLUGS } from '@/lib/roles';
import type { Role } from '@/types/users';

const VISUALS: Record<string, { icon: LucideIcon; tone: string }> = {
  [ROLE_SLUGS.SUPER_ADMIN]: { icon: Crown, tone: 'bg-primary/12 text-primary' },
  [ROLE_SLUGS.ADMIN]: { icon: ShieldCheck, tone: 'bg-primary/10 text-primary' },
  [ROLE_SLUGS.INSTRUCTOR]: { icon: GraduationCap, tone: 'bg-accent/12 text-accent' },
  [ROLE_SLUGS.STUDENT]: { icon: UserRound, tone: 'bg-info/10 text-info' },
};

export function RoleIcon({ role, size = 'md' }: { role: Pick<Role, 'slug'>; size?: 'sm' | 'md' }) {
  const { icon: Icon, tone } = VISUALS[role.slug] ?? { icon: Shapes, tone: 'bg-warning/10 text-warning' };
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-xl', tone, size === 'md' ? 'size-10' : 'size-8')}
      aria-hidden
    >
      <Icon className={size === 'md' ? 'size-5' : 'size-4'} />
    </span>
  );
}

/** Thin coverage bar; `value` and `max` are permission counts. */
export function Coverage({ value, max, full }: { value: number; max: number | undefined; full?: boolean }) {
  const pct = full ? 100 : max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="presentation">
      <div className={cn('h-full rounded-full transition-all', full ? 'bg-primary' : 'bg-accent')} style={{ width: `${pct}%` }} />
    </div>
  );
}
