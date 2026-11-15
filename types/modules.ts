import type { LucideIcon } from 'lucide-react';

/**
 * live        – screen implemented and wired to backend
 * api-ready   – backend endpoints exist; screen not built yet
 * partial     – only per-entity endpoints exist (no module-wide API)
 * missing-api – no backend endpoint exists for this module
 */
export type ModuleStatus = 'live' | 'api-ready' | 'partial' | 'missing-api';

export type ModuleGroup =
  | 'Overview'
  | 'People'
  | 'Learning'
  | 'Commerce'
  | 'Engagement'
  | 'Content & SEO'
  | 'Communication'
  | 'System';

export interface ModuleEndpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
}

export interface ModuleDefinition {
  slug: string;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: ModuleGroup;
  status: ModuleStatus;
  /** Permission codes the backend checks (ALL required); empty = backend checks admin role only. */
  requiredPermissions?: string[];
  /** Alternative permission codes — access granted when the user has ANY of these (OR with requiredPermissions). */
  anyPermissions?: string[];
  /** Visible to every signed-in staff role regardless of permissions (e.g. profile). */
  staffWide?: boolean;
  superAdminOnly?: boolean;
  endpoints: ModuleEndpoint[];
  note?: string;
}
