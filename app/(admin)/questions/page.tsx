import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { QuestionsManagement } from '@/features/qa/components/questions-management';

export const metadata: Metadata = { title: 'Questions & Answers' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function QuestionsPage() {
  return (
    <ModuleGate slug="questions">
      <QuestionsManagement />
    </ModuleGate>
  );
}
