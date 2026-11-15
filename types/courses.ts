import type { Pagination } from './api';
import type { CourseCategory } from './categories';

/** Enums from backend `config/security.js` (COURSE_STATUS, COURSE_LEVELS, DURATION_UNITS, SUPPORTED_CURRENCIES). */
export const COURSE_STATUSES = ['draft', 'published', 'archived'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const COURSE_LEVELS = ['beginner', 'intermediate', 'advanced', 'all_levels'] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const DURATION_UNITS = ['minutes', 'hours', 'days', 'weeks'] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export type PricingType = 'free' | 'paid';

/** Delivery type — independent of pricing.type (`COURSE_TYPES` in backend security.js). */
export const COURSE_TYPES = ['FREE', 'PRE_RECORDED', 'LIVE_SESSION'] as const;
export type CourseType = (typeof COURSE_TYPES)[number];

/** `cloudinaryMediaSchema` / `cloudinaryMediaInput`. */
export interface CloudinaryMedia {
  provider?: 'cloudinary';
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

export interface LearningObjective {
  title: string;
  description?: string;
  sortOrder?: number;
}

export interface CourseFaq {
  question: string;
  answer: string;
  sortOrder?: number;
}

export interface CourseCertificate {
  enabled: boolean;
  templateId: string | null;
  minimumCompletionPercentage: number;
  autoIssue: boolean;
}

export interface CourseEnrollmentSettings {
  limitEnabled: boolean;
  maximumStudents: number;
  currentStudents?: number;
}

export interface CourseExpiry {
  enabled: boolean;
  durationValue: number;
  durationUnit: DurationUnit;
}

/** LIVE_SESSION batch details — only meaningful when courseType is LIVE_SESSION. */
export interface CourseLiveSession {
  batchName: string;
  startDate: string | null;
  endDate: string | null;
  sessionMode: string;
  sessionSchedule: string;
}

export interface CourseSeo {
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  focusKeyword?: string;
}

export interface CourseTaxConfiguration {
  taxEnabled?: boolean;
  taxPercent?: number;
  taxClass?: string;
  taxInclusive?: boolean;
}

export interface CoursePurchaseAvailability {
  enabled?: boolean;
  startAt?: string | null;
  endAt?: string | null;
}

/** Prices are in major currency units (e.g. rupees). */
export interface CoursePricing {
  type: PricingType;
  regularPrice?: number;
  salePrice?: number | null;
  currency?: Currency;
  saleStartAt?: string | null;
  saleEndAt?: string | null;
  isPurchasable?: boolean;
  automaticEnrollmentEnabled?: boolean;
  taxConfiguration?: CourseTaxConfiguration;
  purchaseAvailability?: CoursePurchaseAvailability;
}

export interface CourseInstructor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImage?: string | null;
}

export interface CourseRatingStats {
  averageRating: number;
  approvedReviewCount: number;
}

/** `Course.toAdminObject()`; `categories` / `instructors` are present when the backend populated them. */
export interface Course {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  thumbnail: CloudinaryMedia | null;
  gallery: CloudinaryMedia[];
  categoryIds: string[];
  categories?: CourseCategory[];
  instructorIds: string[];
  instructors?: CourseInstructor[];
  level: CourseLevel;
  language: string;
  courseType: CourseType;
  durationValue: number;
  durationUnit: DurationUnit;
  status: CourseStatus;
  isFeatured: boolean;
  sortOrder: number;
  learningObjectives: LearningObjective[];
  requirements: string[];
  targetAudience: string[];
  faqs: CourseFaq[];
  tags: string[];
  certificate: CourseCertificate;
  enrollment: CourseEnrollmentSettings;
  expiry: CourseExpiry;
  seo: CourseSeo;
  pricing: CoursePricing;
  liveSession: CourseLiveSession;
  ratingStats: CourseRatingStats;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const COURSE_SORT_FIELDS = ['createdAt', 'updatedAt', 'publishedAt', 'title', 'sortOrder'] as const;
export type CourseSortField = (typeof COURSE_SORT_FIELDS)[number];

/** Query accepted by GET /admin/courses (`listCoursesQuerySchema`). */
export interface CourseListParams {
  page: number;
  limit: number;
  search?: string;
  status?: CourseStatus;
  categoryId?: string;
  instructorId?: string;
  level?: CourseLevel;
  language?: string;
  pricingType?: PricingType;
  courseType?: CourseType;
  isFeatured?: boolean;
  sortBy?: CourseSortField;
  sortOrder?: 'asc' | 'desc';
}

export interface CourseListResponse {
  data: Course[];
  pagination: Pagination;
}

/** Body for POST /admin/courses (`createCourseSchema`, strict). New courses always start as draft. */
export interface CourseInput {
  title: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  thumbnail?: CloudinaryMedia | null;
  gallery?: CloudinaryMedia[];
  categoryIds?: string[];
  instructorIds?: string[];
  level?: CourseLevel;
  language?: string;
  courseType?: CourseType;
  durationValue?: number;
  durationUnit?: DurationUnit;
  isFeatured?: boolean;
  sortOrder?: number;
  learningObjectives?: LearningObjective[];
  requirements?: string[];
  targetAudience?: string[];
  faqs?: CourseFaq[];
  tags?: string[];
  certificate?: Partial<CourseCertificate>;
  enrollment?: { limitEnabled?: boolean; maximumStudents?: number };
  expiry?: Partial<CourseExpiry>;
  seo?: CourseSeo;
  pricing?: CoursePricing;
  liveSession?: Partial<CourseLiveSession>;
}

/** Body for PATCH /admin/courses/:id (`updateCourseSchema`: any subset, at least one field). */
export type UpdateCourseInput = Partial<CourseInput>;

/** GET /admin/courses/:id/analytics → data.analytics. */
export interface CourseAnalytics {
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  averageRating: number;
  approvedReviewCount: number;
  totalLessons: number;
  publishedLessons: number;
  totalTopics: number;
  courseStatus: CourseStatus;
  createdAt: string;
  publishedAt: string | null;
}

export type TopicStatus = 'draft' | 'published' | 'archived';

/** `CourseLesson.toAdminObject()` fields shown in the curriculum outline. */
export interface CourseLessonSummary {
  id: string;
  title: string;
  slug: string;
  type: 'video' | 'text' | 'live' | 'resource';
  durationSeconds?: number;
  isPreview?: boolean;
  isRequired?: boolean;
  sortOrder: number;
  status: string;
}

/** `CourseTopic.toSafeObject()`; `lessons` is present with `includeLessons=true`. */
export interface CourseTopic {
  id: string;
  courseId: string;
  title: string;
  description: string;
  sortOrder: number;
  availabilityType: 'immediate' | 'scheduled';
  availableAt: string | null;
  status: TopicStatus;
  isRequired: boolean;
  lessons?: CourseLessonSummary[];
  createdAt: string;
  updatedAt: string;
}
