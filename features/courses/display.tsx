import { Badge, type BadgeTone } from '@/components/ui/badge';
import { titleCase } from '@/lib/format';
import type { Course, CourseLevel, CourseStatus } from '@/types/courses';

const STATUS_TONE: Record<CourseStatus, BadgeTone> = { published: 'success', draft: 'warning', archived: 'neutral' };

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{titleCase(status)}</Badge>;
}

export function levelLabel(level: CourseLevel): string {
  return level === 'all_levels' ? 'All levels' : titleCase(level);
}

export function formatMoney(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

/** Same window as backend `resolveCoursePriceMajor`: no start/end date means the sale is open on that side. */
export function isSaleActive(pricing: Course['pricing'], now = new Date()): boolean {
  if (pricing.salePrice === null || pricing.salePrice === undefined) return false;
  const startOk = !pricing.saleStartAt || new Date(pricing.saleStartAt) <= now;
  const endOk = !pricing.saleEndAt || new Date(pricing.saleEndAt) >= now;
  return startOk && endOk;
}

/** Price learners pay right now: an active sale price over the regular price, or "Free". */
export function priceLabel(course: Pick<Course, 'pricing'>): { primary: string; struck?: string; saleUntil?: string | null } {
  const p = course.pricing;
  if (!p || p.type === 'free') return { primary: 'Free' };
  const currency = p.currency ?? 'INR';
  const regular = p.regularPrice ?? 0;
  if (isSaleActive(p) && (p.salePrice as number) < regular) {
    return { primary: formatMoney(p.salePrice as number, currency), struck: formatMoney(regular, currency), saleUntil: p.saleEndAt ?? null };
  }
  return { primary: formatMoney(regular, currency) };
}

const THUMB_SIZES = { md: 'h-10 w-16', row: 'h-12 w-20', lg: 'h-20 w-32' } as const;

export function CourseThumb({ course, size = 'md' }: { course: Pick<Course, 'thumbnail' | 'title'>; size?: keyof typeof THUMB_SIZES }) {
  const box = THUMB_SIZES[size];
  if (course.thumbnail?.secureUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URLs are arbitrary remote hosts
      <img src={course.thumbnail.secureUrl} alt="" className={`${box} shrink-0 rounded-md border border-line object-cover`} loading="lazy" />
    );
  }
  return (
    <span
      className={`${box} flex shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-xs font-semibold text-ink-subtle`}
      aria-hidden
    >
      {course.title.slice(0, 2).toUpperCase()}
    </span>
  );
}
