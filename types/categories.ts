import type { CloudinaryMedia } from './courses';

export type CategoryStatus = 'active' | 'inactive';

/** `CourseCategory.toSafeObject()`. */
export interface CourseCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: CloudinaryMedia | null;
  parentCategoryId: string | null;
  status: CategoryStatus;
  sortOrder: number;
  seo: { metaTitle?: string; metaDescription?: string };
  createdAt: string;
  updatedAt: string;
}

/** Body for POST /admin/course-categories (`createCategorySchema`, strict). */
export interface CategoryInput {
  name: string;
  slug?: string;
  description?: string;
  image?: CloudinaryMedia | null;
  parentCategoryId?: string | null;
  status?: CategoryStatus;
  sortOrder?: number;
  seo?: { metaTitle?: string; metaDescription?: string };
}

/** Body for PATCH /admin/course-categories/:id (any subset, at least one field). */
export type UpdateCategoryInput = Partial<CategoryInput>;

/** PATCH /admin/course-categories/reorder → { items: [{ id, sortOrder }] } (1–200 items). */
export interface CategoryOrderItem {
  id: string;
  sortOrder: number;
}

export type BlogCategoryStatus = 'draft' | 'published';

/** `BlogCategory.toSafeObject()`. */
export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: BlogCategoryStatus;
  createdAt: string;
  updatedAt: string;
}

/** Body for POST /admin/blogs/categories (strict). */
export interface BlogCategoryInput {
  name: string;
  slug?: string;
  description?: string;
  status?: BlogCategoryStatus;
}
