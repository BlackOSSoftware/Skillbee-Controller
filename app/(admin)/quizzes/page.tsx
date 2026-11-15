import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { QuizManagement } from '@/features/quizzes/components/quiz-management';

export const metadata: Metadata = { title: 'Quizzes & Results' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function QuizzesPage() {
  return (
    <ModuleGate slug="quizzes">
      <QuizManagement />
    </ModuleGate>
  );
}
