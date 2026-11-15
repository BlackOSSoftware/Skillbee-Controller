import type { BlogCategoryInput, BlogCategoryStatus, CategoryInput, CategoryStatus, CourseCategory, UpdateCategoryInput } from '@/types/categories';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface CategoryFormValues {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  imagePublicId: string;
  parentCategoryId: string;
  status: CategoryStatus;
  sortOrder: string;
  metaTitle: string;
  metaDescription: string;
}

export type FormErrors<T> = Partial<Record<keyof T, string>>;

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function initialCategoryValues(category?: CourseCategory | null, nextSortOrder = 0): CategoryFormValues {
  return {
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    description: category?.description ?? '',
    imageUrl: category?.image?.secureUrl ?? '',
    imagePublicId: category?.image?.publicId ?? '',
    parentCategoryId: category?.parentCategoryId ?? '',
    status: category?.status ?? 'active',
    sortOrder: String(category?.sortOrder ?? nextSortOrder),
    metaTitle: category?.seo?.metaTitle ?? '',
    metaDescription: category?.seo?.metaDescription ?? '',
  };
}

/** Mirrors backend `createCategorySchema`. */
export function validateCategory(v: CategoryFormValues): FormErrors<CategoryFormValues> {
  const errors: FormErrors<CategoryFormValues> = {};
  const name = v.name.trim();
  if (name.length < 2) errors.name = 'Name needs at least 2 characters.';
  else if (name.length > 120) errors.name = 'Name must be 120 characters or less.';
  const slug = v.slug.trim().toLowerCase();
  if (slug && !SLUG_RE.test(slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens.';
  if (v.description.length > 2000) errors.description = 'Description must be 2000 characters or less.';
  const url = v.imageUrl.trim();
  const publicId = v.imagePublicId.trim();
  if (url || publicId) {
    if (!url || !isUrl(url)) errors.imageUrl = 'Enter the image’s https URL.';
    if (!publicId) errors.imagePublicId = 'Enter the Cloudinary public ID.';
  }
  if (v.sortOrder.trim() && !Number.isInteger(Number(v.sortOrder))) errors.sortOrder = 'Sort order must be a whole number.';
  if (v.metaTitle.length > 120) errors.metaTitle = 'Meta title must be 120 characters or less.';
  if (v.metaDescription.length > 300) errors.metaDescription = 'Meta description must be 300 characters or less.';
  return errors;
}

export function toCategoryInput(v: CategoryFormValues): CategoryInput {
  const url = v.imageUrl.trim();
  const publicId = v.imagePublicId.trim();
  return {
    name: v.name.trim(),
    ...(v.slug.trim() ? { slug: v.slug.trim().toLowerCase() } : {}),
    description: v.description.trim(),
    image: url && publicId ? { provider: 'cloudinary', secureUrl: url, publicId } : null,
    parentCategoryId: v.parentCategoryId || null,
    status: v.status,
    sortOrder: Number(v.sortOrder || 0),
    seo: { metaTitle: v.metaTitle.trim(), metaDescription: v.metaDescription.trim() },
  };
}

/** Only fields that differ from the loaded category. */
export function diffCategory(category: CourseCategory, v: CategoryFormValues): UpdateCategoryInput {
  const before = toCategoryInput(initialCategoryValues(category));
  const after = toCategoryInput(v);
  const body: Record<string, unknown> = {};
  for (const key of Object.keys(after) as Array<keyof CategoryInput>) {
    if (JSON.stringify(after[key]) !== JSON.stringify(before[key])) body[key] = after[key];
  }
  return body as UpdateCategoryInput;
}

/** Ids of `id` and every category nested under it (a category cannot be moved beneath itself). */
export function selfAndDescendants(id: string, all: CourseCategory[]): Set<string> {
  const result = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of all) {
      if (c.parentCategoryId && result.has(c.parentCategoryId) && !result.has(c.id)) {
        result.add(c.id);
        grew = true;
      }
    }
  }
  return result;
}

export interface BlogCategoryFormValues {
  name: string;
  slug: string;
  description: string;
  status: BlogCategoryStatus;
}

/** Mirrors the inline schema on POST /admin/blogs/categories. */
export function validateBlogCategory(v: BlogCategoryFormValues): FormErrors<BlogCategoryFormValues> {
  const errors: FormErrors<BlogCategoryFormValues> = {};
  const name = v.name.trim();
  if (name.length < 2) errors.name = 'Name needs at least 2 characters.';
  else if (name.length > 120) errors.name = 'Name must be 120 characters or less.';
  const slug = v.slug.trim();
  if (slug && !SLUG_RE.test(slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens.';
  if (v.description.length > 1000) errors.description = 'Description must be 1000 characters or less.';
  return errors;
}

export function toBlogCategoryInput(v: BlogCategoryFormValues): BlogCategoryInput {
  return {
    name: v.name.trim(),
    ...(v.slug.trim() ? { slug: v.slug.trim() } : {}),
    ...(v.description.trim() ? { description: v.description.trim() } : {}),
    status: v.status,
  };
}
