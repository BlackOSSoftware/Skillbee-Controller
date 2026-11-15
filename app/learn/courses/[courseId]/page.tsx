import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingState } from '@/components/ui/states';
import { CoursePlayer } from '@/features/learning/components/course-player';

export const metadata: Metadata = { title: 'Course' };

/** Learner pages render only after the client verifies the session. */
export const instant = false;

export default function LearnCoursePage() {
  return (
    <Suspense fallback={<LoadingState label="Loading course…" />}>
      <CoursePlayer />
    </Suspense>
  );
}
