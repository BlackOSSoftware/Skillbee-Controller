import type { AuthUser } from '@/types/auth';

/** Role slugs defined by the backend (`backend/src/config/security.js` ROLE_SLUGS). */
export const ROLE_SLUGS = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor',
  SEO: 'seo_manage',
  STUDENT: 'student',
} as const;

export function roleSlugOf(user: AuthUser | null | undefined): string | null {
  return user?.role?.slug ?? null;
}

export function isSuperAdmin(user: AuthUser | null | undefined): boolean {
  return roleSlugOf(user) === ROLE_SLUGS.SUPER_ADMIN;
}

/** Career Mentor is retired from the console; hidden from role lists without touching backend data. */
export function isHiddenRole(role: { slug?: string; name?: string }): boolean {
  return /mentor/i.test(role.slug ?? '') || /career\s*mentor/i.test(role.name ?? '');
}

/** Roles the backend treats as admin-console staff (requireAdminAccess). */
export function isAdminRole(user: AuthUser | null | undefined): boolean {
  const slug = roleSlugOf(user);
  return slug === ROLE_SLUGS.SUPER_ADMIN || slug === ROLE_SLUGS.ADMIN;
}

/**
 * Any staff role may sign in — including custom roles created in Role &
 * Permissions. Only students are excluded (they use the student dashboard).
 * Module-level access is still enforced per permission via canAccessModule.
 */
export function canUseDashboard(user: AuthUser | null | undefined): boolean {
  const slug = roleSlugOf(user);
  return slug !== null && slug !== ROLE_SLUGS.STUDENT;
}

export function hasPermissions(user: AuthUser | null | undefined, required: readonly string[] = []): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (!required.length) return true;
  const owned = new Set(user.role?.permissions ?? []);
  return required.every((p) => owned.has(p));
}

export function hasAnyPermissions(user: AuthUser | null | undefined, required: readonly string[] = []): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (!required.length) return false;
  const owned = new Set(user.role?.permissions ?? []);
  return required.some((p) => owned.has(p));
}

export function displayName(user: Pick<AuthUser, 'firstName' | 'lastName' | 'email'> | null | undefined): string {
  if (!user) return '';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email;
}

export function initialsOf(user: Pick<AuthUser, 'firstName' | 'lastName' | 'email'> | null | undefined): string {
  if (!user) return '?';
  const parts = [user.firstName, user.lastName].filter(Boolean);
  const letters = parts.length ? parts.map((p) => p[0]) : [user.email[0]];
  return letters.join('').slice(0, 2).toUpperCase();
}
