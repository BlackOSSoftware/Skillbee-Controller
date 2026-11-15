import type { Paginated } from './instructors';

export type BlogStatus = 'draft' | 'published' | 'archived';
export type BlogCategoryStatus = 'draft' | 'published';

/** Cloudinary media object stored on featuredImage. */
export interface BlogFeaturedImage {
  provider: 'cloudinary';
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

export interface BlogSeo {
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  schemaType?: string;
  schemaData?: Record<string, unknown>;
}

/** Blog.toAdminObject() */
export interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage: BlogFeaturedImage | null;
  authorId: string;
  categoryIds: string[];
  tags: string[];
  status: BlogStatus;
  publishedAt: string | null;
  scheduledAt: string | null;
  readingTime: number;
  viewsCount: number;
  isFeatured: boolean;
  seo: BlogSeo;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BlogsResponse = Paginated<Blog>;

/** GET /admin/blogs query (listQuery). */
export interface BlogListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: BlogStatus;
  categoryId?: string;
  tag?: string;
  isFeatured?: boolean;
  sort?: 'newest' | 'oldest';
}

/** POST /admin/blogs body (createBody). */
export interface CreateBlogInput {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  featuredImage?: BlogFeaturedImage | null;
  categoryIds?: string[];
  tags?: string[];
  isFeatured?: boolean;
  seo?: BlogSeo;
}

/** PATCH /admin/blogs/:id — same shape, all optional. */
export type UpdateBlogInput = Partial<CreateBlogInput>;

/** BlogCategory.toSafeObject() */
export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: BlogCategoryStatus;
  createdAt: string;
  updatedAt: string;
}

/** POST /admin/blogs/categories body. */
export interface CreateBlogCategoryInput {
  name: string;
  slug?: string;
  description?: string;
  status?: BlogCategoryStatus;
}

/** GET /admin/blogs/:id/seo response data. */
export interface BlogSeoResponse {
  blogId: string;
  slug: string;
  status: BlogStatus;
  publicPath: string;
  seo: BlogSeo & { canonicalUrl: string };
}

/** PATCH /admin/blogs/:id/seo body (seoBody). */
export interface UpdateBlogSeoInput {
  seoTitle?: string;
  metaDescription?: string;
  slug?: string;
  canonicalUrl?: string;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  schemaType?: string;
  schemaData?: Record<string, unknown>;
}

/** POST /admin/blogs/:id/preview response data. */
export interface BlogPreview {
  previewToken: string;
  expiresAt: string;
  path: string;
}
