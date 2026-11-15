import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { AssignmentManagement } from '@/features/assignments/components/assignment-management';

export const metadata: Metadata = { title: 'Assignments' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function AssignmentsPage() {
  return (
    <ModuleGate slug="assignments">
      <AssignmentManagement />
    </ModuleGate>
  );
}
