import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { SiteSettingsWorkspace } from '@/features/site-settings/components/site-settings-workspace';

export const metadata: Metadata = { title: 'Site Settings' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function SiteSettingsPage() {
  return (
    <ModuleGate slug="site-settings">
      <SiteSettingsWorkspace />
    </ModuleGate>
  );
}
