import { Suspense } from 'react';
import { AdminGuard } from '@/components/layout/admin-guard';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LoadingState } from '@/components/ui/states';

export default function AdminLayout({ children }: LayoutProps<'/'>) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingState label="Loading console…" />
        </div>
      }
    >
      <AdminGuard>
        <DashboardShell>{children}</DashboardShell>
      </AdminGuard>
    </Suspense>
  );
}
