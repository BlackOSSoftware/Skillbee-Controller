import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingState } from '@/components/ui/states';
import { LearnerLogin } from '@/features/learning/components/learner-login';

export const metadata: Metadata = { title: 'Sign in' };

export default function LearnLoginPage() {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-10">
      <Suspense fallback={<LoadingState label="Loading…" />}>
        <LearnerLogin />
      </Suspense>
    </main>
  );
}
