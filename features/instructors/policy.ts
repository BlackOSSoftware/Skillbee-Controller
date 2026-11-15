import { ROLE_SLUGS } from '@/lib/roles';
import type { AuthUser } from '@/types/auth';
import type { Instructor } from '@/types/instructors';

/**
 * PATCH /admin/instructors/:id/status has no "last super admin" guard (unlike /admin/users),
 * so Super Admin accounts and the signed-in user are never changed from this page.
 */
export function instructorStatusLockReason(actor: AuthUser | null, target: Instructor): string | null {
  if (target.id === actor?.id) return 'You cannot change your own status.';
  if (target.role?.slug === ROLE_SLUGS.SUPER_ADMIN) return 'Super Admin status is managed from User Management.';
  return null;
}
