import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { BlogsManagement } from '@/features/blogs/components/blogs-management';

export const metadata: Metadata = { title: 'Blog Management' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function BlogsPage() {
  return (
    <ModuleGate slug="blogs">
      <BlogsManagement />
    </ModuleGate>
  );
}
