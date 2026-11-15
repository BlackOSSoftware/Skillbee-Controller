import type { Pagination } from './api';

// ---------- Global SEO settings ----------

export interface SeoSocialLink {
  platform: string;
  url: string;
}

export interface SitemapSettings {
  enabled: boolean;
  includeCourses: boolean;
  includePages: boolean;
  changefreqCourses: string;
  changefreqPages: string;
  maxUrlsPerSitemap: number;
}

/** `SeoSettings.toSafeObject()` — GET/PATCH /admin/seo/settings. */
export interface SeoSettings {
  id: string;
  siteName: string;
  siteUrl: string;
  defaultSeoTitle: string;
  defaultMetaDescription: string;
  defaultOgImage: string;
  defaultRobotsIndex: boolean;
  defaultRobotsFollow: boolean;
  organizationName: string;
  organizationLogo: string;
  organizationDescription: string;
  organizationSocialLinks: SeoSocialLink[];
  defaultSchemaSettings: Record<string, unknown>;
  sitemapSettings: SitemapSettings;
  robotsTxtContent: string;
  createdAt: string;
  updatedAt: string;
}

/** PATCH /admin/seo/settings — every field optional (strict schema). */
export interface UpdateSeoSettingsInput {
  siteName?: string;
  siteUrl?: string;
  defaultSeoTitle?: string;
  defaultMetaDescription?: string;
  defaultOgImage?: string;
  defaultRobotsIndex?: boolean;
  defaultRobotsFollow?: boolean;
  organizationName?: string;
  organizationLogo?: string;
  organizationDescription?: string;
  organizationSocialLinks?: SeoSocialLink[];
  defaultSchemaSettings?: Record<string, unknown>;
  sitemapSettings?: Partial<SitemapSettings>;
  robotsTxtContent?: string;
}

// ---------- Page SEO ----------

export interface SeoBreadcrumb {
  name: string;
  path: string;
}

/** `PageSeo.toSafeObject()` — GET/PATCH /admin/seo/pages/:id. */
export interface PageSeo {
  id: string;
  pageIdentifier: string;
  pagePath: string;
  seoTitle: string;
  metaDescription: string;
  slug: string;
  canonicalUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  schemaType: string;
  schemaData: Record<string, unknown>;
  breadcrumbs: SeoBreadcrumb[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePageSeoInput {
  pagePath?: string;
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
  breadcrumbs?: SeoBreadcrumb[];
}

/** Built-in page identifiers supported by the backend (`SEO_PAGE_IDENTIFIERS`). */
export const SEO_PAGE_IDENTIFIERS = ['home', 'courses', 'about', 'contact', 'pricing', 'blog', 'login', 'register'] as const;
export type SeoPageIdentifier = (typeof SEO_PAGE_IDENTIFIERS)[number];

// ---------- Course SEO ----------

/** `mapCourseSeoResponse()` — GET/PATCH /admin/seo/courses/:id. */
export interface CourseSeoData {
  courseId: string;
  title: string;
  slug: string;
  status: string;
  publicPath: string;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  focusKeyword: string;
  schemaType: string;
  schemaData: Record<string, unknown>;
}

/** Minimal course row from GET /admin/seo/courses (SEO picker). */
export interface SeoCourseOption {
  id: string;
  title: string;
  slug: string;
  status: string;
}

export interface UpdateCourseSeoInput {
  seoTitle?: string;
  metaTitle?: string;
  metaDescription?: string;
  slug?: string;
  canonicalUrl?: string;
  robotsIndex?: boolean;
  noIndex?: boolean;
  robotsFollow?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  focusKeyword?: string;
  schemaType?: string;
  schemaData?: Record<string, unknown>;
}

// ---------- Redirects ----------

export type RedirectType = 301 | 302;

/** `SeoRedirect.toSafeObject()` — GET/POST/PATCH/DELETE /admin/seo/redirects. */
export interface SeoRedirect {
  id: string;
  sourcePath: string;
  destinationPath: string;
  redirectType: RedirectType;
  isActive: boolean;
  hitCount: number;
  lastAccessedAt: string | null;
  allowExternal: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RedirectListParams {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  redirectType?: RedirectType;
}

export interface CreateRedirectInput {
  sourcePath: string;
  destinationPath: string;
  redirectType?: RedirectType;
  isActive?: boolean;
  allowExternal?: boolean;
}

export type UpdateRedirectInput = Partial<CreateRedirectInput>;

export interface RedirectListResponse {
  data: SeoRedirect[];
  pagination: Pagination;
}
