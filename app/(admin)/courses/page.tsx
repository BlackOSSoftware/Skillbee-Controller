import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { CourseManagement } from '@/features/courses/components/course-management';

export const metadata: Metadata = { title: 'Course Management' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function CoursesPage() {
  return (
    <ModuleGate slug="courses">
      <CourseManagement />
    </ModuleGate>
  );
}
