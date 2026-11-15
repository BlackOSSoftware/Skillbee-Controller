import { hasPermissions, isSuperAdmin, ROLE_SLUGS } from '@/lib/roles';
import type { AuthUser } from '@/types/auth';
import type { AdminUser, Role } from '@/types/users';

/**
 * Backend checks users:* permissions but does not stop an Admin from editing or assigning
 * Super Admin (it only blocks removing the last active Super Admin). These rules add that
 * protection in the UI; backend RBAC remains the final authority for everything else.
 */
function touchesSuperAdmin(actor: AuthUser | null, target: AdminUser): boolean {
  return target.role?.slug === ROLE_SLUGS.SUPER_ADMIN && !isSuperAdmin(actor);
}

export const userPolicy = {
  canView: (actor: AuthUser | null) => hasPermissions(actor, ['users:read']),
  canCreate: (actor: AuthUser | null) => hasPermissions(actor, ['users:write']),
  canEdit: (actor: AuthUser | null, target: AdminUser) =>
    hasPermissions(actor, ['users:write']) && !touchesSuperAdmin(actor, target),
  canChangeStatus: (actor: AuthUser | null, target: AdminUser) =>
    hasPermissions(actor, ['users:write']) && target.id !== actor?.id && !touchesSuperAdmin(actor, target),
  canDelete: (actor: AuthUser | null, target: AdminUser) =>
    hasPermissions(actor, ['users:delete']) && target.id !== actor?.id && !touchesSuperAdmin(actor, target),
  /** Only a Super Admin may grant the Super Admin role. Inactive roles are rejected by the backend. */
  assignableRoles: (actor: AuthUser | null, roles: Role[]) =>
    roles.filter((r) => r.isActive && (r.slug !== ROLE_SLUGS.SUPER_ADMIN || isSuperAdmin(actor))),
};
