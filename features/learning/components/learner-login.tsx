'use client';

import { Eye, EyeOff } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-logo';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/states';
import { useLoginMutation, useLogoutMutation } from '@/features/auth/hooks';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { canUseDashboard } from '@/lib/roles';
import { safeNextPath } from '@/lib/safe-redirect';

/** Learner sign-in. Separate from the admin login, which only admits Super Admin and Admin roles. */
export function LearnerLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get('next'), '/learn');
  const target = next.startsWith('/learn') && !next.startsWith('/learn/login') ? next : '/learn';
  const { status } = useAuth();
  const login = useLoginMutation();
  const logout = useLogoutMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') router.replace(target);
  }, [status, target, router]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setRoleError(null);
    login.mutate(
      { email: email.trim(), password },
      {
        onSuccess: (session) => {
          setPassword('');
          if (!canUseDashboard(session.user)) {
            setRoleError('This area is for staff only. Students should sign in on the student dashboard.');
            logout.mutate();
            return;
          }
          router.replace(target);
        },
      }
    );
  }

  if (status === 'loading') return <LoadingState label="Checking session…" />;

  return (
    <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <BrandMark size={40} priority />
        <div>
          <p className="text-base font-semibold text-ink">SkillBee Learning</p>
          <p className="text-xs text-ink-muted">Sign in to continue your courses</p>
        </div>
      </div>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <div>
          <Label htmlFor="learn-email">Email</Label>
          <Input id="learn-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="learn-password">Password</Label>
          <div className="relative">
            <Input id="learn-password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-subtle hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {roleError || login.isError ? (
          <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {roleError ?? normalizeApiError(login.error).message}
          </p>
        ) : null}
        <Button type="submit" className="w-full" loading={login.isPending} disabled={!email || !password}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
