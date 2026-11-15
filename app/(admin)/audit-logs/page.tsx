import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { AuditLogsWorkspace } from '@/features/audit-logs/components/audit-logs-workspace';

export const metadata: Metadata = { title: 'Audit Logs' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function AuditLogsPage() {
  return (
    <ModuleGate slug="audit-logs">
      <AuditLogsWorkspace />
    </ModuleGate>
  );
}
