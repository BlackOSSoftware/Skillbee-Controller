import type { Metadata } from 'next';
import { LearnerShell } from '@/features/learning/components/learner-shell';

export const metadata: Metadata = { title: 'Learning' };

/** Learner pages render only after the client verifies the session. */
export const instant = false;

export default function LearnLayout({ children }: LayoutProps<'/learn'>) {
  return <LearnerShell>{children}</LearnerShell>;
}
