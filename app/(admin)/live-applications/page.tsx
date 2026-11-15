import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { LiveApplicationsManagement } from '@/features/live-applications/components/live-applications-management';

export const metadata: Metadata = { title: 'Live Course Applications' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function LiveApplicationsPage() {
  return (
    <ModuleGate slug="live-applications">
      <LiveApplicationsManagement />
    </ModuleGate>
  );
}
