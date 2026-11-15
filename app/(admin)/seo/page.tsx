import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { SeoWorkspace } from '@/features/seo/components/seo-workspace';

export const metadata: Metadata = { title: 'SEO Management' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function SeoPage() {
  return (
    <ModuleGate slug="seo">
      <SeoWorkspace />
    </ModuleGate>
  );
}
