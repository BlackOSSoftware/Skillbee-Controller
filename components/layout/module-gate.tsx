'use client';

import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { useModuleAccess } from '@/hooks/use-module-access';
import { findModuleBySlug } from '@/lib/navigation';

/** Blocks direct URL access to modules the user's role cannot use (UI layer; backend enforces too). */
export function ModuleGate({ slug, children }: { slug: string; children: ReactNode }) {
  const allowed = useModuleAccess(findModuleBySlug(slug));

  if (!allowed) {
    return (
      <Card>
        <EmptyState
          icon={<Lock className="size-5" aria-hidden />}
          title="Access restricted"
          description="Your role has not been granted access to this module. Ask a Super Admin to assign the required permissions."
        />
      </Card>
    );
  }
  return <>{children}</>;
}
