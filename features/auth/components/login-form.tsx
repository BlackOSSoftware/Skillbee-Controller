'use client';

import { Eye, EyeOff } from 'lucide-react';
import { BrandWordmark } from '@/components/brand/brand-logo';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { canUseDashboard } from '@/lib/roles';
import { safeNextPath } from '@/lib/safe-redirect';
import { homePathFor } from '@/hooks/use-module-access';
import { useLoginMutation, useLogoutMutation } from '../hooks';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));
  const { user, status } = useAuth();
  // Staff without dashboard access land on their first permitted module instead.
  const resolveTarget = (u: typeof user) => (nextPath === '/dashboard' ? homePathFor(u) : nextPath);
  const login = useLoginMutation();
  const logout = useLogoutMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && canUseDashboard(user)) {
      router.replace(resolveTarget(user));
    }
  }, [status, user, nextPath, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRoleError(null);
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: (session) => {
          // Next keeps this route's state alive after navigation; never leave the password in the DOM.
          setPassword('');
          setShowPassword(false);
          if (!canUseDashboard(session.user)) {
            setRoleError('Invalid email or password.');
            logout.mutate();
            return;
          }
          router.replace(resolveTarget(session.user));
        },
      }
    );
  }

  if (status === 'loading') {
    return <LoadingState label="Checking session…" />;
  }

  const errorMessage = roleError ?? (login.isError ? normalizeApiError(login.error).message : null);

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <BrandWordmark height={56} priority />
        <p className="mt-3 text-xs font-medium text-ink-muted">Super Admin &amp; Admin console</p>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-1 text-sm text-ink-muted">Use your SkillBee administrator account.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@skillbee.co.in"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-subtle hover:text-ink"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <Button type="submit" className="w-full" loading={login.isPending} disabled={!email || !password}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
