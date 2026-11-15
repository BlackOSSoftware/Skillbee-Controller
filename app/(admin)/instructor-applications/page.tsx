import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { ApplicationsManagement } from '@/features/instructor-applications/components/applications-management';

export const metadata: Metadata = { title: 'Instructor Applications' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function InstructorApplicationsPage() {
  return (
    <ModuleGate slug="instructor-applications">
      <ApplicationsManagement />
    </ModuleGate>
  );
}
