'use client';

import { ArrowLeft, LogOut } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-logo';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useLogoutMutation } from '@/features/auth/hooks';
import { useAuth } from '@/hooks/use-auth';
import { canUseDashboard, displayName, initialsOf } from '@/lib/roles';
import { homePathFor } from '@/hooks/use-module-access';

/** Staff-only learner view: students use the student dashboard instead. */
function LearnerGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status, error, retry } = useAuth();
  const logout = useLogoutMutation();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(`/learn/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <ErrorState error={error} onRetry={retry} />
      </div>
    );
  }
  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Verifying session…" />
      </div>
    );
  }
  if (!canUseDashboard(user)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-lg font-semibold text-ink">Staff access required</h1>
        <p className="max-w-sm text-sm text-ink-muted">
          Students should sign in on the student dashboard. This area is for staff only.
        </p>
        <Button variant="secondary" loading={logout.isPending} onClick={() => logout.mutate()}>
          Sign in with a different account
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}

export function LearnerShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const logout = useLogoutMutation();
  const pathname = usePathname();
  const staff = canUseDashboard(user);

  // The login page must render without the auth guard (it handles its own states).
  if (pathname?.startsWith('/learn/login')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
        {children}
      </div>
    );
  }

  return (
    <LearnerGuard>
      <div className="min-h-screen bg-canvas">
        <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
            <Link href="/learn" className="flex items-center gap-2.5">
              <BrandMark size={32} priority />
              <span className="leading-tight">
                <span className="block text-sm font-semibold text-ink">SkillBee</span>
                <span className="block text-[11px] text-ink-subtle">Learning</span>
              </span>
            </Link>
            <nav className="ml-4 hidden text-sm sm:block">
              <Link href="/learn" className="rounded-md px-2.5 py-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink">
                My learning
              </Link>
            </nav>
            <div className="ml-auto flex items-center gap-1.5">
              {staff ? (
                <Link href={homePathFor(user)} className="hidden items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-2 hover:text-ink md:inline-flex">
                  <ArrowLeft className="size-3.5" aria-hidden />
                  Admin console
                </Link>
              ) : null}
              <ThemeToggle />
              <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />
              <span className="hidden items-center gap-2 sm:flex">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{initialsOf(user)}</span>
                <span className="max-w-40 truncate text-sm text-ink">{displayName(user)}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => logout.mutate()} loading={logout.isPending} aria-label="Sign out">
                {logout.isPending ? null : <LogOut className="size-4" aria-hidden />}
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </LearnerGuard>
  );
}
