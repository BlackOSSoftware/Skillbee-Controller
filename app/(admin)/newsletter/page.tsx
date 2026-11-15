import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { NewsletterManagement } from '@/features/newsletter/components/newsletter-management';

export const metadata: Metadata = { title: 'Newsletter' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function NewsletterPage() {
  return (
    <ModuleGate slug="newsletter">
      <NewsletterManagement />
    </ModuleGate>
  );
}
