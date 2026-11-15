import type { Metadata } from 'next';
import { CoursePlayer } from '@/features/learning/components/course-player';

export const metadata: Metadata = { title: 'Course' };

/** Learner pages render only after the client verifies the session. */
export const instant = false;

export default async function LearnCoursePage(props: PageProps<'/learn/courses/[courseId]'>) {
  const { courseId } = await props.params;
  return <CoursePlayer courseId={courseId} />;
}
