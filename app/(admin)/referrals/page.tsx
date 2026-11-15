import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { ReferralsManagement } from '@/features/referrals/components/referrals-management';

export const metadata: Metadata = { title: 'Referrals' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function ReferralsPage() {
  return (
    <ModuleGate slug="referrals">
      <ReferralsManagement />
    </ModuleGate>
  );
}
