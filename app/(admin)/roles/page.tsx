import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { RolesOverview } from '@/features/roles/components/roles-overview';

export const metadata: Metadata = { title: 'Role & Permissions' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function RolesPage() {
  return (
    <ModuleGate slug="roles">
      <RolesOverview />
    </ModuleGate>
  );
}
