import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingState } from '@/components/ui/states';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex items-center justify-center bg-surface px-6 py-12">
        <Suspense fallback={<LoadingState />}>
          <LoginForm />
        </Suspense>
      </section>
      <section className="relative hidden overflow-hidden border-l border-line bg-linear-to-br from-[#5cc8f2] via-[#6d8ff0] to-[#a07af0] lg:flex lg:items-end dark:from-[#2a9fd6] dark:via-[#4e6fd8] dark:to-[#7f5bd8]">
        <span className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/[0.12] dark:bg-white/[0.08]" aria-hidden />
        <span className="pointer-events-none absolute -bottom-32 right-24 size-80 rounded-full bg-white/[0.1] dark:bg-white/[0.06]" aria-hidden />
        <div className="relative p-12 text-white">
          <p className="text-sm font-medium uppercase tracking-widest text-white/70">SkillBee LMS</p>
          <p className="mt-3 max-w-md text-3xl font-semibold leading-tight">
            Manage courses, learners, commerce and content from one place.
          </p>
          <p className="mt-4 max-w-md text-sm text-white/75">
            Access is controlled by your backend role and permissions.
          </p>
        </div>
      </section>
    </main>
  );
}
