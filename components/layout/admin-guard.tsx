'use client';

import { ShieldAlert } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useLogoutMutation } from '@/features/auth/hooks';
import { useAuth } from '@/hooks/use-auth';
import { canUseDashboard } from '@/lib/roles';

/** Client-side route protection. Every API call is still authorized by the backend. */
export function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status, error, retry } = useAuth();
  const logout = useLogoutMutation();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Verifying session…" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <ErrorState error={error} onRetry={retry} />
      </div>
    );
  }

  if (!canUseDashboard(user)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-warning/10 text-warning">
          <ShieldAlert className="size-6" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold text-ink">Admin access required</h1>
        <p className="max-w-sm text-sm text-ink-muted">
          Your account role does not have access to the Super Admin console.
        </p>
        <Button
          variant="secondary"
          loading={logout.isPending}
          onClick={() => logout.mutate()}
        >
          Sign in with a different account
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
