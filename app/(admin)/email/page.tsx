import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { EmailWorkspace } from '@/features/email/components/email-workspace';

export const metadata: Metadata = { title: 'Email Management' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function EmailPage() {
  return (
    <ModuleGate slug="email">
      <EmailWorkspace />
    </ModuleGate>
  );
}
