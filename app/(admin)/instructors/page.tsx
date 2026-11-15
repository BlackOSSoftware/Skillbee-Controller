import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { InstructorManagement } from '@/features/instructors/components/instructor-management';

export const metadata: Metadata = { title: 'Instructor Management' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function InstructorsPage() {
  return (
    <ModuleGate slug="instructors">
      <InstructorManagement />
    </ModuleGate>
  );
}
