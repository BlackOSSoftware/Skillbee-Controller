import { hasPermissions, isSuperAdmin, ROLE_SLUGS } from '@/lib/roles';
import type { AuthUser } from '@/types/auth';
import type { Role } from '@/types/users';

/** Permission modules treated as teaching-related for the Instructor role. */
export const TEACHING_MODULES = new Set(['instructor', 'courses', 'media', 'quizzes', 'assignments']);

/**
 * UI rules on top of backend RBAC. The backend does not block editing Super Admin or Student
 * permissions, nor self-assignment, so these guards exist only in the console.
 */
export const rolePolicy = {
  canCreate: (actor: AuthUser | null) => hasPermissions(actor, ['roles:write']),

  canEditDetails: (actor: AuthUser | null, role: Role) =>
    hasPermissions(actor, ['roles:write']) && (role.slug !== ROLE_SLUGS.SUPER_ADMIN || isSuperAdmin(actor)),

  /** Reason permissions are locked for this role, or null when the actor may assign them. */
  permissionLockReason: (actor: AuthUser | null, role: Role): string | null => {
    if (role.slug === ROLE_SLUGS.SUPER_ADMIN) return 'Super Admin always has every permission, including future ones.';
    if (role.slug === ROLE_SLUGS.STUDENT) return 'Students never receive administrative permissions.';
    if (!hasPermissions(actor, ['permissions:assign'])) return 'You do not have permission to assign permissions.';
    if (actor?.role?.id === role.id) return 'You cannot change permissions for your own role.';
    return null;
  },

  /** Instructor may only hold teaching permissions; other modules are locked for that role. */
  isModuleAssignable: (role: Role, module: string) =>
    role.slug !== ROLE_SLUGS.INSTRUCTOR || TEACHING_MODULES.has(module),

  canDelete: (actor: AuthUser | null, role: Role) => hasPermissions(actor, ['roles:delete']) && !role.isSystem,
};
