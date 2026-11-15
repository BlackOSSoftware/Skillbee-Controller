'use client';

import { useMemo } from 'react';
import { MODULES } from '@/lib/navigation';
import { hasAnyPermissions, hasPermissions, isAdminRole, isSuperAdmin } from '@/lib/roles';
import type { AuthUser } from '@/types/auth';
import type { ModuleDefinition } from '@/types/modules';
import { useAuth } from './use-auth';

/** UI-level visibility only. The backend re-checks every request and remains the authority. */
export function canAccessModule(user: AuthUser | null, module: ModuleDefinition): boolean {
  if (!user) return false;
  if (module.superAdminOnly && !isSuperAdmin(user)) return false;
  if (module.staffWide) return true;

  const required = module.requiredPermissions ?? [];
  if (required.length) {
    if (hasPermissions(user, required)) return true;
    return hasAnyPermissions(user, module.anyPermissions ?? []);
  }

  // No granular permission → backend guards this module by admin role only.
  return isAdminRole(user);
}

/** Landing path after sign-in: dashboard when allowed, else the first accessible module. */
export function homePathFor(user: AuthUser | null): string {
  const dashboard = MODULES.find((m) => m.slug === 'dashboard');
  if (dashboard && canAccessModule(user, dashboard)) return dashboard.href;
  const first = MODULES.find((m) => canAccessModule(user, m) && m.slug !== 'profile');
  return first?.href ?? '/profile';
}

export function useAccessibleModules(): ModuleDefinition[] {
  const { user } = useAuth();
  return useMemo(() => MODULES.filter((m) => canAccessModule(user, m)), [user]);
}

export function useModuleAccess(module: ModuleDefinition | undefined): boolean {
  const { user } = useAuth();
  return module ? canAccessModule(user, module) : false;
}
