import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { ReportsWorkspace } from '@/features/reports/components/reports-workspace';

export const metadata: Metadata = { title: 'Reports & Analytics' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function ReportsPage() {
  return (
    <ModuleGate slug="reports">
      <ReportsWorkspace />
    </ModuleGate>
  );
}
