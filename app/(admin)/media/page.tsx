import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { MediaLibrary } from '@/features/media/components/media-library';

export const metadata: Metadata = { title: 'Media Library' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function MediaPage() {
  return (
    <ModuleGate slug="media">
      <MediaLibrary />
    </ModuleGate>
  );
}
