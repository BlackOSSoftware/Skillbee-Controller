import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { ReviewsManagement } from '@/features/reviews/components/reviews-management';

export const metadata: Metadata = { title: 'Reviews Management' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function ReviewsPage() {
  return (
    <ModuleGate slug="reviews">
      <ReviewsManagement />
    </ModuleGate>
  );
}
