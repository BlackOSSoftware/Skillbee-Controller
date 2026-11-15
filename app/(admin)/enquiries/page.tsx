import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { ContactHub } from '@/features/contact/components/contact-hub';

export const metadata: Metadata = { title: 'Contact & Enquiries' };

/** Rendered only after the client verifies the session. */
export const instant = false;

export default function EnquiriesPage() {
  return (
    <ModuleGate slug="enquiries">
      <ContactHub />
    </ModuleGate>
  );
}
