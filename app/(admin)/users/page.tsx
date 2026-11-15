import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { UserManagement } from '@/features/users/components/user-management';

export const metadata: Metadata = { title: 'User Management' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function UsersPage() {
  return (
    <ModuleGate slug="users">
      <UserManagement />
    </ModuleGate>
  );
}
