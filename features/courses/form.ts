import type {
  CloudinaryMedia,
  Course,
  CourseInput,
  CourseLevel,
  CourseLiveSession,
  CourseType,
  Currency,
  DurationUnit,
  PricingType,
  UpdateCourseInput,
} from '@/types/courses';

export interface MediaRow {
  secureUrl: string;
  publicId: string;
}

/** Form state; numbers stay strings until submit so partially typed values are not coerced. */
export interface CourseFormValues {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  thumbnail: MediaRow;
  gallery: MediaRow[];
  categoryIds: string[];
  instructorIds: string[];
  level: CourseLevel;
  language: string;
  courseType: CourseType;
  durationValue: string;
  durationUnit: DurationUnit;
  isFeatured: boolean;
  sortOrder: string;
  learningObjectives: Array<{ title: string; description: string }>;
  requirements: string[];
  targetAudience: string[];
  faqs: Array<{ question: string; answer: string }>;
  tags: string[];
  certificate: { enabled: boolean; templateId: string; minimumCompletionPercentage: string; autoIssue: boolean };
  enrollment: { limitEnabled: boolean; maximumStudents: string };
  liveSession: {
    batchName: string;
    startDate: string;
    endDate: string;
    sessionMode: string;
    sessionSchedule: string;
  };
  expiry: { enabled: boolean; durationValue: string; durationUnit: DurationUnit };
  seo: {
    metaTitle: string;
    metaDescription: string;
    canonicalUrl: string;
    noIndex: boolean;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    focusKeyword: string;
  };
  pricing: {
    type: PricingType;
    regularPrice: string;
    salePrice: string;
    currency: Currency;
    saleStartAt: string;
    saleEndAt: string;
    isPurchasable: boolean;
    automaticEnrollmentEnabled: boolean;
    taxEnabled: boolean;
    taxPercent: string;
    taxClass: string;
    taxInclusive: boolean;
    purchaseWindowEnabled: boolean;
    purchaseStartAt: string;
    purchaseEndAt: string;
  };
}

/** Errors keyed by backend-style dot paths (`pricing.regularPrice`, `faqs.0.answer`). */
export type CourseFormErrors = Record<string, string>;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

function num(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

/** ISO → value for `<input type="datetime-local">` in the browser's timezone. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO → value for `<input type="date">` (YYYY-MM-DD, UTC). */
function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function fromDateInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function initialCourseValues(course?: Course | null): CourseFormValues {
  const p = course?.pricing;
  return {
    title: course?.title ?? '',
    slug: course?.slug ?? '',
    shortDescription: course?.shortDescription ?? '',
    description: course?.description ?? '',
    thumbnail: { secureUrl: course?.thumbnail?.secureUrl ?? '', publicId: course?.thumbnail?.publicId ?? '' },
    gallery: (course?.gallery ?? []).map((g) => ({ secureUrl: g.secureUrl, publicId: g.publicId })),
    categoryIds: course?.categoryIds ?? [],
    instructorIds: course?.instructorIds ?? [],
    level: course?.level ?? 'all_levels',
    language: course?.language ?? 'en',
    courseType: course?.courseType ?? (course?.pricing?.type === 'free' ? 'FREE' : 'PRE_RECORDED'),
    durationValue: num(course?.durationValue ?? 0),
    durationUnit: course?.durationUnit ?? 'hours',
    isFeatured: course?.isFeatured ?? false,
    sortOrder: num(course?.sortOrder ?? 0),
    learningObjectives: (course?.learningObjectives ?? []).map((o) => ({ title: o.title, description: o.description ?? '' })),
    requirements: course?.requirements ?? [],
    targetAudience: course?.targetAudience ?? [],
    faqs: (course?.faqs ?? []).map((f) => ({ question: f.question, answer: f.answer })),
    tags: course?.tags ?? [],
    certificate: {
      enabled: course?.certificate?.enabled ?? false,
      templateId: course?.certificate?.templateId ?? '',
      minimumCompletionPercentage: num(course?.certificate?.minimumCompletionPercentage ?? 80),
      autoIssue: course?.certificate?.autoIssue ?? false,
    },
    enrollment: {
      limitEnabled: course?.enrollment?.limitEnabled ?? false,
      maximumStudents: num(course?.enrollment?.maximumStudents ?? 0),
    },
    liveSession: {
      batchName: course?.liveSession?.batchName ?? '',
      startDate: toDateInput(course?.liveSession?.startDate),
      endDate: toDateInput(course?.liveSession?.endDate),
      sessionMode: course?.liveSession?.sessionMode ?? '',
      sessionSchedule: course?.liveSession?.sessionSchedule ?? '',
    },
    expiry: {
      enabled: course?.expiry?.enabled ?? false,
      durationValue: num(course?.expiry?.durationValue ?? 0),
      durationUnit: course?.expiry?.durationUnit ?? 'days',
    },
    seo: {
      metaTitle: course?.seo?.metaTitle ?? '',
      metaDescription: course?.seo?.metaDescription ?? '',
      canonicalUrl: course?.seo?.canonicalUrl ?? '',
      noIndex: course?.seo?.noIndex ?? false,
      ogTitle: course?.seo?.ogTitle ?? '',
      ogDescription: course?.seo?.ogDescription ?? '',
      ogImage: course?.seo?.ogImage ?? '',
      focusKeyword: course?.seo?.focusKeyword ?? '',
    },
    pricing: {
      type: p?.type ?? 'free',
      regularPrice: p?.type === 'paid' ? num(p.regularPrice) : '',
      salePrice: p?.type === 'paid' ? num(p.salePrice) : '',
      currency: p?.currency ?? 'INR',
      saleStartAt: toLocalInput(p?.saleStartAt),
      saleEndAt: toLocalInput(p?.saleEndAt),
      isPurchasable: p?.isPurchasable ?? true,
      automaticEnrollmentEnabled: p?.automaticEnrollmentEnabled ?? true,
      taxEnabled: p?.taxConfiguration?.taxEnabled ?? false,
      taxPercent: num(p?.taxConfiguration?.taxPercent ?? 0),
      taxClass: p?.taxConfiguration?.taxClass ?? '',
      taxInclusive: p?.taxConfiguration?.taxInclusive ?? true,
      purchaseWindowEnabled: p?.purchaseAvailability?.enabled ?? true,
      purchaseStartAt: toLocalInput(p?.purchaseAvailability?.startAt),
      purchaseEndAt: toLocalInput(p?.purchaseAvailability?.endAt),
    },
  };
}

function cleanList(items: string[]): string[] {
  return items.map((s) => s.trim()).filter(Boolean);
}

function media(row: MediaRow): CloudinaryMedia | null {
  const secureUrl = row.secureUrl.trim();
  const publicId = row.publicId.trim();
  return secureUrl && publicId ? { provider: 'cloudinary', publicId, secureUrl } : null;
}

/** Full request body for the current form state (every field the backend accepts). */
export function toCourseInput(v: CourseFormValues): Required<Omit<CourseInput, 'slug' | 'liveSession'>> & { slug?: string; liveSession?: CourseLiveSession } {
  const paid = v.pricing.type === 'paid';
  const input: Required<Omit<CourseInput, 'slug' | 'liveSession'>> & { slug?: string; liveSession?: CourseLiveSession } = {
    title: v.title.trim(),
    ...(v.slug.trim() ? { slug: v.slug.trim().toLowerCase() } : {}),
    shortDescription: v.shortDescription.trim(),
    description: v.description,
    thumbnail: media(v.thumbnail),
    gallery: v.gallery.map(media).filter((m): m is CloudinaryMedia => m !== null),
    categoryIds: v.categoryIds,
    instructorIds: v.instructorIds,
    level: v.level,
    language: v.language.trim().toLowerCase(),
    courseType: v.courseType,
    durationValue: Number(v.durationValue || 0),
    durationUnit: v.durationUnit,
    isFeatured: v.isFeatured,
    sortOrder: Number(v.sortOrder || 0),
    learningObjectives: v.learningObjectives
      .filter((o) => o.title.trim())
      .map((o, i) => ({ title: o.title.trim(), description: o.description.trim(), sortOrder: i })),
    requirements: cleanList(v.requirements),
    targetAudience: cleanList(v.targetAudience),
    faqs: v.faqs
      .filter((f) => f.question.trim() || f.answer.trim())
      .map((f, i) => ({ question: f.question.trim(), answer: f.answer.trim(), sortOrder: i })),
    tags: cleanList(v.tags),
    certificate: {
      enabled: v.certificate.enabled,
      templateId: v.certificate.templateId.trim() || null,
      minimumCompletionPercentage: Number(v.certificate.minimumCompletionPercentage || 0),
      autoIssue: v.certificate.autoIssue,
    },
    enrollment: {
      limitEnabled: v.enrollment.limitEnabled,
      maximumStudents: Number(v.enrollment.maximumStudents || 0),
    },
    expiry: {
      enabled: v.expiry.enabled,
      durationValue: Number(v.expiry.durationValue || 0),
      durationUnit: v.expiry.durationUnit,
    },
    seo: {
      metaTitle: v.seo.metaTitle.trim(),
      metaDescription: v.seo.metaDescription.trim(),
      canonicalUrl: v.seo.canonicalUrl.trim(),
      noIndex: v.seo.noIndex,
      ogTitle: v.seo.ogTitle.trim(),
      ogDescription: v.seo.ogDescription.trim(),
      ogImage: v.seo.ogImage.trim(),
      focusKeyword: v.seo.focusKeyword.trim(),
    },
    pricing: {
      type: v.pricing.type,
      regularPrice: paid ? Number(v.pricing.regularPrice || 0) : 0,
      salePrice: paid && v.pricing.salePrice.trim() ? Number(v.pricing.salePrice) : null,
      currency: v.pricing.currency,
      saleStartAt: paid ? fromLocalInput(v.pricing.saleStartAt) : null,
      saleEndAt: paid ? fromLocalInput(v.pricing.saleEndAt) : null,
      isPurchasable: v.pricing.isPurchasable,
      automaticEnrollmentEnabled: v.pricing.automaticEnrollmentEnabled,
      taxConfiguration: {
        taxEnabled: v.pricing.taxEnabled,
        taxPercent: Number(v.pricing.taxPercent || 0),
        taxClass: v.pricing.taxClass.trim(),
        taxInclusive: v.pricing.taxInclusive,
      },
      purchaseAvailability: {
        enabled: v.pricing.purchaseWindowEnabled,
        startAt: fromLocalInput(v.pricing.purchaseStartAt),
        endAt: fromLocalInput(v.pricing.purchaseEndAt),
      },
    },
  };
  // liveSession is only sent for LIVE_SESSION courses — the backend rejects
  // it for other types, and omitting it preserves stored data on type switch.
  if (v.courseType === 'LIVE_SESSION') {
    input.liveSession = {
      batchName: v.liveSession.batchName.trim(),
      startDate: fromDateInput(v.liveSession.startDate),
      endDate: fromDateInput(v.liveSession.endDate),
      sessionMode: v.liveSession.sessionMode.trim(),
      sessionSchedule: v.liveSession.sessionSchedule.trim(),
    };
  }
  return input;
}

type InputKey = keyof ReturnType<typeof toCourseInput>;

/**
 * PATCH body with only the top-level fields that differ from the course as loaded.
 * `omit` drops fields the actor may not change (instructors/pricing are admin-only server-side).
 */
export function diffCourseInput(course: Course, values: CourseFormValues, omit: InputKey[] = []): UpdateCourseInput {
  const before = toCourseInput(initialCourseValues(course));
  const after = toCourseInput(values);
  const body: Record<string, unknown> = {};
  for (const key of Object.keys(after) as InputKey[]) {
    if (omit.includes(key)) continue;
    if (JSON.stringify(after[key]) !== JSON.stringify(before[key])) body[key] = after[key];
  }
  if (after.slug === undefined && course.slug) delete body.slug;
  return body as UpdateCourseInput;
}

function length(errors: CourseFormErrors, path: string, value: string, max: number, label: string, min = 0) {
  if (value.length < min) errors[path] = min === 1 ? `${label} is required.` : `${label} needs at least ${min} characters.`;
  else if (value.length > max) errors[path] = `${label} must be ${max} characters or less.`;
}

function numberIn(errors: CourseFormErrors, path: string, raw: string, opts: { min?: number; max?: number; int?: boolean; label: string }) {
  if (raw.trim() === '') return;
  const value = Number(raw);
  if (!Number.isFinite(value)) errors[path] = `${opts.label} must be a number.`;
  else if (opts.int && !Number.isInteger(value)) errors[path] = `${opts.label} must be a whole number.`;
  else if (opts.min !== undefined && value < opts.min) errors[path] = `${opts.label} must be at least ${opts.min}.`;
  else if (opts.max !== undefined && value > opts.max) errors[path] = `${opts.label} must be ${opts.max} or less.`;
}

function mediaRow(errors: CourseFormErrors, path: string, row: MediaRow, label: string) {
  const url = row.secureUrl.trim();
  const id = row.publicId.trim();
  if (!url && !id) return;
  if (!url || !isUrl(url)) errors[`${path}.secureUrl`] = `${label} needs a valid https URL.`;
  if (!id) errors[`${path}.publicId`] = `${label} needs its Cloudinary public ID.`;
}

/** Mirrors `createCourseSchema` and `pricingInput` refinements in the backend validators. */
export function validateCourseForm(v: CourseFormValues): CourseFormErrors {
  const errors: CourseFormErrors = {};
  length(errors, 'title', v.title.trim(), 200, 'Title', 3);
  const slug = v.slug.trim().toLowerCase();
  if (slug && !SLUG_RE.test(slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens.';
  length(errors, 'shortDescription', v.shortDescription, 500, 'Short description');
  length(errors, 'description', v.description, 100_000, 'Description');

  mediaRow(errors, 'thumbnail', v.thumbnail, 'Thumbnail');
  if (v.gallery.length > 20) errors.gallery = 'Up to 20 gallery images.';
  v.gallery.forEach((row, i) => mediaRow(errors, `gallery.${i}`, row, 'Image'));

  if (v.categoryIds.length > 20) errors.categoryIds = 'Up to 20 categories.';
  if (v.instructorIds.length > 20) errors.instructorIds = 'Up to 20 instructors.';
  const language = v.language.trim();
  if (language.length < 2 || language.length > 10) errors.language = 'Use a 2–10 character language code (e.g. en, hi).';
  numberIn(errors, 'durationValue', v.durationValue, { min: 0, label: 'Duration' });
  numberIn(errors, 'sortOrder', v.sortOrder, { int: true, label: 'Sort order' });

  if (v.learningObjectives.length > 50) errors.learningObjectives = 'Up to 50 objectives.';
  v.learningObjectives.forEach((o, i) => {
    if (!o.title.trim() && !o.description.trim()) return;
    length(errors, `learningObjectives.${i}.title`, o.title.trim(), 200, 'Objective', 1);
    length(errors, `learningObjectives.${i}.description`, o.description, 1000, 'Description');
  });
  for (const key of ['requirements', 'targetAudience'] as const) {
    if (cleanList(v[key]).length > 50) errors[key] = 'Up to 50 items.';
    v[key].forEach((item, i) => length(errors, `${key}.${i}`, item.trim(), 300, 'Item'));
  }
  if (v.faqs.length > 50) errors.faqs = 'Up to 50 FAQs.';
  v.faqs.forEach((f, i) => {
    if (!f.question.trim() && !f.answer.trim()) return;
    length(errors, `faqs.${i}.question`, f.question.trim(), 300, 'Question', 1);
    length(errors, `faqs.${i}.answer`, f.answer.trim(), 2000, 'Answer', 1);
  });
  if (cleanList(v.tags).length > 50) errors.tags = 'Up to 50 tags.';
  v.tags.forEach((t, i) => length(errors, `tags.${i}`, t.trim(), 50, 'Tag'));

  const templateId = v.certificate.templateId.trim();
  if (templateId && !OBJECT_ID_RE.test(templateId)) errors['certificate.templateId'] = 'Template ID must be a 24-character id.';
  numberIn(errors, 'certificate.minimumCompletionPercentage', v.certificate.minimumCompletionPercentage, { min: 0, max: 100, label: 'Completion' });
  numberIn(errors, 'enrollment.maximumStudents', v.enrollment.maximumStudents, { min: 0, int: true, label: 'Maximum students' });
  numberIn(errors, 'expiry.durationValue', v.expiry.durationValue, { min: 0, label: 'Expiry duration' });

  length(errors, 'seo.metaTitle', v.seo.metaTitle, 120, 'Meta title');
  length(errors, 'seo.metaDescription', v.seo.metaDescription, 300, 'Meta description');
  if (v.seo.canonicalUrl.trim() && !isUrl(v.seo.canonicalUrl.trim())) errors['seo.canonicalUrl'] = 'Enter a full URL or leave empty.';
  length(errors, 'seo.ogTitle', v.seo.ogTitle, 120, 'OG title');
  length(errors, 'seo.ogDescription', v.seo.ogDescription, 300, 'OG description');
  length(errors, 'seo.focusKeyword', v.seo.focusKeyword, 100, 'Focus keyword');

  const p = v.pricing;
  // courseType ↔ pricing consistency (mirrors backend assertCourseTypePricing)
  if (v.courseType === 'FREE' && p.type !== 'free') {
    errors['pricing.type'] = 'FREE courses must use free pricing — set pricing type to Free.';
  }
  if (v.courseType === 'PRE_RECORDED' && p.type !== 'paid') {
    errors['pricing.type'] = 'PRE_RECORDED courses must use paid pricing.';
  }
  if (p.type === 'paid') {
    const regular = Number(p.regularPrice);
    if (!p.regularPrice.trim() || !Number.isFinite(regular) || regular <= 0) {
      errors['pricing.regularPrice'] = 'Paid courses need a regular price above 0.';
    }
    numberIn(errors, 'pricing.salePrice', p.salePrice, { min: 0, label: 'Sale price' });
    if (!errors['pricing.salePrice'] && p.salePrice.trim() && Number(p.salePrice) > regular) {
      errors['pricing.salePrice'] = 'Sale price cannot exceed the regular price.';
    }
    if (p.saleStartAt && p.saleEndAt && new Date(p.saleStartAt) > new Date(p.saleEndAt)) {
      errors['pricing.saleEndAt'] = 'Sale end must be after the sale start.';
    }
  }
  numberIn(errors, 'pricing.taxConfiguration.taxPercent', p.taxPercent, { min: 0, max: 100, label: 'Tax percent' });
  length(errors, 'pricing.taxConfiguration.taxClass', p.taxClass, 50, 'Tax class');

  if (v.courseType === 'LIVE_SESSION') {
    length(errors, 'liveSession.batchName', v.liveSession.batchName, 200, 'Batch name');
    length(errors, 'liveSession.sessionMode', v.liveSession.sessionMode, 100, 'Session mode');
    length(errors, 'liveSession.sessionSchedule', v.liveSession.sessionSchedule, 2000, 'Session schedule');
    if (v.liveSession.startDate && v.liveSession.endDate && v.liveSession.startDate > v.liveSession.endDate) {
      errors['liveSession.endDate'] = 'End date must be after the start date.';
    }
  }
  return errors;
}

export const COURSE_FORM_TABS = ['basics', 'content', 'media', 'pricing', 'settings', 'seo'] as const;
export type CourseFormTab = (typeof COURSE_FORM_TABS)[number];

const TAB_OF_FIELD: Array<[RegExp, CourseFormTab]> = [
  [/^(learningObjectives|requirements|targetAudience|faqs|tags)/, 'content'],
  [/^(thumbnail|gallery)/, 'media'],
  [/^pricing/, 'pricing'],
  [/^(certificate|enrollment|expiry|liveSession|isFeatured|sortOrder)/, 'settings'],
  [/^seo/, 'seo'],
];

export function tabOfField(path: string): CourseFormTab {
  return TAB_OF_FIELD.find(([re]) => re.test(path))?.[1] ?? 'basics';
}
