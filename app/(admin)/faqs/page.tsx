import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { FaqsManagement } from '@/features/faqs/components/faqs-management';

export const metadata: Metadata = { title: 'FAQs' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function FaqsPage() {
  return (
    <ModuleGate slug="faqs">
      <FaqsManagement />
    </ModuleGate>
  );
}
