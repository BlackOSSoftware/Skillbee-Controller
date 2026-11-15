'use client';

import { PageHeader } from '@/components/ui/page-header';
import { RefreshButton } from '@/components/ui/refresh-button';
import { useAuth } from '@/hooks/use-auth';
import { queryKeys } from '@/lib/query-keys';
import { displayName } from '@/lib/roles';
import { DASHBOARD_STATS } from '../stats';
import { ApiCoverageCard } from './api-coverage-card';
import { RecentUsersCard } from './recent-users-card';
import { StatCard } from './stat-card';

export function DashboardOverview() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        title={`Welcome back, ${displayName(user).split(' ')[0] || 'Admin'}`}
        description="Live counts from SkillBee backend list endpoints."
        actions={<RefreshButton queryKeys={[queryKeys.dashboard.all, queryKeys.users.all]} />}
      />

      <section aria-label="Key statistics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {DASHBOARD_STATS.map((stat, i) => (
          <StatCard key={stat.id} stat={stat} index={i} />
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentUsersCard />
        </div>
        <ApiCoverageCard />
      </section>
    </>
  );
}
