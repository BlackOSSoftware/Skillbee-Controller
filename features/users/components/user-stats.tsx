'use client';

import { CircleCheck, CircleSlash, Users, UserX } from 'lucide-react';
import { KpiCard, type KpiTone } from '@/components/ui/kpi-card';
import type { UserStatus } from '@/types/auth';
import { useUserStats, type UserStatKey } from '../hooks';

const CARDS: Array<{ key: UserStatKey; label: string; icon: typeof Users; tone: KpiTone }> = [
  { key: 'all', label: 'Total users', icon: Users, tone: 'purple' },
  { key: 'active', label: 'Active', icon: CircleCheck, tone: 'teal' },
  { key: 'inactive', label: 'Inactive', icon: CircleSlash, tone: 'sky' },
  { key: 'suspended', label: 'Suspended', icon: UserX, tone: 'coral' },
];

interface UserStatsProps {
  activeStatus: UserStatus | '';
  onSelect: (status: UserStatus | '') => void;
}

export function UserStats({ activeStatus, onSelect }: UserStatsProps) {
  const stats = useUserStats();

  return (
    <section aria-label="User totals" className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
      {CARDS.map(({ key, label, icon, tone }) => {
        const stat = stats[key];
        const statusValue: UserStatus | '' = key === 'all' ? '' : key;
        return (
          <KpiCard
            key={key}
            label={label}
            icon={icon}
            tone={tone}
            value={stat.value}
            isLoading={stat.isLoading}
            error={stat.error}
            active={activeStatus === statusValue}
            onClick={() => onSelect(statusValue)}
          />
        );
      })}
    </section>
  );
}
