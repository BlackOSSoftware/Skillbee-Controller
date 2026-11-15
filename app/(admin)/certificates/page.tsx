import type { Metadata } from 'next';
import { ModuleGate } from '@/components/layout/module-gate';
import { CertificateManagement } from '@/features/certificates/components/certificate-management';

export const metadata: Metadata = { title: 'Certificates' };

/** Admin pages render only after the client verifies the session. */
export const instant = false;

export default function CertificatesPage() {
  return (
    <ModuleGate slug="certificates">
      <CertificateManagement />
    </ModuleGate>
  );
}
