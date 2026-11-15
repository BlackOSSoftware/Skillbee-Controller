import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { DashboardOverview } from '@/features/dashboard/components/dashboard-overview';

export const metadata: Metadata = { title: 'Dashboard' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function DashboardPage() {
  return (
    <ModuleGate slug="dashboard">
      <DashboardOverview />
    </ModuleGate>
  );
}
