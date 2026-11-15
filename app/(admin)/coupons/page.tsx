import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { CouponsManagement } from '@/features/coupons/components/coupons-management';

export const metadata: Metadata = { title: 'Coupons' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function CouponsPage() {
  return (
    <ModuleGate slug="coupons">
      <CouponsManagement />
    </ModuleGate>
  );
}
