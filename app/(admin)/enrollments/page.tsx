import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { EnrollmentManagement } from '@/features/enrollments/components/enrollment-management';

export const metadata: Metadata = { title: 'Enrollments & Progress' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function EnrollmentsPage() {
  return (
    <ModuleGate slug="enrollments">
      <EnrollmentManagement />
    </ModuleGate>
  );
}
