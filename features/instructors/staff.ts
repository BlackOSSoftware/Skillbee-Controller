import { isHiddenRole, ROLE_SLUGS } from '@/lib/roles';
import type { Instructor } from '@/types/instructors';

export type StaffKind = 'instructor' | 'admin';

/**
 * GET /admin/instructors also returns Admin and Super Admin accounts and has no role filter.
 * Instructors always count as teaching staff; Admins only once assigned to a course; every other
 * role (Super Admin, Student, Career Mentor, custom roles) is excluded.
 */
export function staffKind(member: Pick<Instructor, 'role'>): StaffKind | null {
  const role = member.role;
  if (!role || isHiddenRole(role)) return null;
  if (role.slug === ROLE_SLUGS.INSTRUCTOR) return 'instructor';
  if (role.slug === ROLE_SLUGS.ADMIN) return 'admin';
  return null;
}
