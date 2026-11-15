import type { Pagination } from './api';
import type { AuthUser, UserStatus } from './auth';

/** GET /admin/instructors items: User.toSafeObject() with `role` reduced to { id, name, slug }. */
export type Instructor = Omit<AuthUser, 'role'> & {
  phoneVerified?: boolean;
  role: { id: string; name: string; slug: string } | null;
};

/** GET /admin/instructors/:id/courses items (backend selects these fields only). */
export interface InstructorCourse {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published' | 'archived' | string;
  level?: string;
  isFeatured?: boolean;
  publishedAt?: string | null;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

/** Query params read by the controller: page, limit (max 100), search (name/email), status. */
export interface InstructorListParams {
  page: number;
  limit: number;
  search?: string;
  status?: UserStatus;
}
