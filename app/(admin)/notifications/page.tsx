import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { NotificationsWorkspace } from '@/features/notifications/components/notifications-workspace';

export const metadata: Metadata = { title: 'Notifications' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function NotificationsPage() {
  return (
    <ModuleGate slug="notifications">
      <NotificationsWorkspace />
    </ModuleGate>
  );
}
