import { hasPermissions, isSuperAdmin } from '@/lib/roles';
import type { AuthUser } from '@/types/auth';
import type { CourseStatus } from '@/types/courses';

function any(user: AuthUser | null, codes: string[]): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const owned = new Set(user.role?.permissions ?? []);
  return codes.some((c) => owned.has(c));
}

/** UI gating only; each route re-checks the same permissions (adminCourse.routes.js). */
export const coursePolicy = {
  canCreate: (u: AuthUser | null) => hasPermissions(u, ['courses.create']),
  canUpdate: (u: AuthUser | null) => any(u, ['courses.update', 'instructor.courses.update']),
  canChangeStatus: (u: AuthUser | null) => hasPermissions(u, ['courses.publish']),
  canReadAnalytics: (u: AuthUser | null) => any(u, ['courses.analytics.read', 'instructor.courses.read']),
  canReadCurriculum: (u: AuthUser | null) =>
    any(u, ['courses.curriculum.manage', 'courses.curriculum.read', 'instructor.curriculum.manage', 'courses.read', 'instructor.courses.read']),
  /** The picker lists categories from GET /admin/course-categories (categories.manage). */
  canPickCategories: (u: AuthUser | null) => hasPermissions(u, ['categories.manage']),
  /** The picker lists staff from GET /admin/instructors (courses.instructors.manage). */
  canPickInstructors: (u: AuthUser | null) => hasPermissions(u, ['courses.instructors.manage']),
};

export type StatusAction = 'publish' | 'unpublish' | 'archive' | 'restore';

export const STATUS_ACTIONS: Record<StatusAction, { target: CourseStatus; label: string; title: string; body: string; tone: 'primary' | 'danger' }> = {
  publish: {
    target: 'published',
    label: 'Publish',
    title: 'Publish course?',
    body: 'The course becomes visible in the public catalogue. Publishing needs a description, thumbnail, at least one instructor, category and lesson.',
    tone: 'primary',
  },
  unpublish: {
    target: 'draft',
    label: 'Unpublish',
    title: 'Move course back to draft?',
    body: 'The course is removed from the public catalogue. Existing enrollments are kept.',
    tone: 'danger',
  },
  archive: {
    target: 'archived',
    label: 'Archive',
    title: 'Archive course?',
    body: 'Archived courses are hidden from the catalogue and cannot receive new curriculum. You can restore it to draft later.',
    tone: 'danger',
  },
  restore: {
    target: 'draft',
    label: 'Restore to draft',
    title: 'Restore course to draft?',
    body: 'The course returns to draft so it can be edited and published again.',
    tone: 'primary',
  },
};

export function statusActionsFor(status: CourseStatus): StatusAction[] {
  if (status === 'draft') return ['publish', 'archive'];
  if (status === 'published') return ['unpublish', 'archive'];
  return ['restore', 'publish'];
}
