import type { Metadata } from 'next';
import { MyLearning } from '@/features/learning/components/my-learning';

export const metadata: Metadata = { title: 'My learning' };

/** Learner pages render only after the client verifies the session. */
export const instant = false;

export default function LearnPage() {
  return <MyLearning />;
}
