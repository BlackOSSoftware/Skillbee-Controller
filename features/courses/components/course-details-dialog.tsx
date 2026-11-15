'use client';

import {
  Archive,
  BookOpenCheck,
  CalendarClock,
  ChevronDown,
  CircleCheck,
  Clock,
  Eye,
  Layers,
  ListChecks,
  Pencil,
  RotateCcw,
  Star,
  Undo2,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/cn';
import { formatDate, formatNumber } from '@/lib/format';
import { displayName } from '@/lib/roles';
import type { Course } from '@/types/courses';
import { CurriculumEditor } from '@/features/curriculum/components/curriculum-editor';
import { useCourseAnalytics, useCourseDetail } from '../hooks';
import { CourseStatusBadge, CourseThumb, levelLabel, priceLabel } from '../display';
import { coursePolicy, STATUS_ACTIONS, statusActionsFor, type StatusAction } from '../policy';

type Tab = 'overview' | 'curriculum' | 'analytics';

const STATUS_ICONS: Record<StatusAction, typeof CircleCheck> = { publish: CircleCheck, unpublish: Undo2, archive: Archive, restore: RotateCcw };

interface CourseDetailsDialogProps {
  courseId: string;
  seed?: { course: Course; updatedAt: number };
  onClose: () => void;
  onEdit: (course: Course) => void;
  onStatusAction: (course: Course, action: StatusAction) => void;
  statusPending: boolean;
}

function plainText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{title}</h3>
      {children}
    </section>
  );
}

function Overview({ course }: { course: Course }) {
  const price = priceLabel(course);
  const description = plainText(course.description);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        {course.shortDescription ? <p className="text-sm text-ink-muted">{course.shortDescription}</p> : null}
        <Section title="Description">
          {description ? (
            <p className="max-h-56 overflow-y-auto whitespace-pre-line rounded-lg border border-line bg-surface-2/40 p-3 text-sm leading-relaxed text-ink">{description}</p>
          ) : (
            <p className="text-sm text-ink-subtle">No description yet (required to publish).</p>
          )}
        </Section>
        {course.gallery.length ? (
          <Section title={`Gallery (${course.gallery.length})`}>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {course.gallery.map((g) => (
                <li key={g.publicId} className="overflow-hidden rounded-lg border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL */}
                  <img src={g.secureUrl} alt="" className="aspect-video w-full object-cover" loading="lazy" />
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
        <Section title={`Learning objectives (${course.learningObjectives.length})`}>
          {course.learningObjectives.length ? (
            <ul className="space-y-1.5">
              {course.learningObjectives.map((o, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  <span>
                    <span className="font-medium text-ink">{o.title}</span>
                    {o.description ? <span className="block text-xs text-ink-muted">{o.description}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-subtle">None</p>
          )}
        </Section>
        <div className="grid gap-6 sm:grid-cols-2">
          <Section title="Requirements">
            {course.requirements.length ? (
              <ul className="list-disc space-y-1 pl-4 text-sm text-ink">{course.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
            ) : (
              <p className="text-sm text-ink-subtle">None</p>
            )}
          </Section>
          <Section title="Target audience">
            {course.targetAudience.length ? (
              <ul className="list-disc space-y-1 pl-4 text-sm text-ink">{course.targetAudience.map((r, i) => <li key={i}>{r}</li>)}</ul>
            ) : (
              <p className="text-sm text-ink-subtle">None</p>
            )}
          </Section>
        </div>
        <Section title={`FAQs (${course.faqs.length})`}>
          {course.faqs.length ? (
            <div className="divide-y divide-line rounded-lg border border-line">
              {course.faqs.map((f, i) => (
                <details key={i} className="group px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-ink">
                    {f.question}
                    <ChevronDown className="size-4 shrink-0 text-ink-subtle transition group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="mt-1.5 text-sm text-ink-muted">{f.answer}</p>
                </details>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-subtle">None</p>
          )}
        </Section>
      </div>

      <div className="space-y-6 lg:col-span-2">
        <Section title="Summary">
          <dl className="divide-y divide-line rounded-lg border border-line px-3">
            <Detail label="Price">
              {price.struck ? <span className="mr-1.5 text-xs font-normal text-ink-subtle line-through">{price.struck}</span> : null}
              {price.primary}
              {price.struck ? (
                <span className="block text-[11px] font-normal text-success">{price.saleUntil ? `Sale until ${formatDate(price.saleUntil)}` : 'Sale price, no end date'}</span>
              ) : null}
            </Detail>
            <Detail label="Level">{levelLabel(course.level)}</Detail>
            <Detail label="Language">{course.language.toUpperCase()}</Detail>
            <Detail label="Duration">{course.durationValue ? `${course.durationValue} ${course.durationUnit}` : '—'}</Detail>
            <Detail label="Rating">
              {course.ratingStats.approvedReviewCount ? `${course.ratingStats.averageRating.toFixed(1)} (${course.ratingStats.approvedReviewCount})` : 'No reviews'}
            </Detail>
            <Detail label="Certificate">{course.certificate.enabled ? `At ${course.certificate.minimumCompletionPercentage}%${course.certificate.autoIssue ? ', auto-issued' : ''}` : 'Off'}</Detail>
            <Detail label="Enrollment limit">
              {course.enrollment.limitEnabled ? `${formatNumber(course.enrollment.currentStudents ?? 0)} / ${formatNumber(course.enrollment.maximumStudents)}` : 'Unlimited'}
            </Detail>
            <Detail label="Access expiry">{course.expiry.enabled ? `${course.expiry.durationValue} ${course.expiry.durationUnit}` : 'Never'}</Detail>
            <Detail label="Published">{formatDate(course.publishedAt)}</Detail>
            <Detail label="Updated">{formatDate(course.updatedAt)}</Detail>
          </dl>
        </Section>
        <Section title="Categories">
          <div className="flex flex-wrap gap-1.5">
            {(course.categories ?? []).length ? (course.categories ?? []).map((c) => <Badge key={c.id} tone={c.status === 'active' ? 'brand' : 'neutral'}>{c.name}</Badge>) : <p className="text-sm text-ink-subtle">None (required to publish)</p>}
          </div>
        </Section>
        <Section title="Instructors">
          {(course.instructors ?? []).length ? (
            <ul className="space-y-2">
              {(course.instructors ?? []).map((i) => (
                <li key={i.id} className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary" aria-hidden>
                    {(i.firstName[0] ?? '') + (i.lastName[0] ?? '')}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{displayName(i)}</span>
                    <span className="block truncate text-xs text-ink-muted">{i.email}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-subtle">None (required to publish)</p>
          )}
        </Section>
        {course.tags.length ? (
          <Section title="Tags">
            <div className="flex flex-wrap gap-1.5">{course.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>
          </Section>
        ) : null}
        <Section title="SEO">
          <dl className="divide-y divide-line rounded-lg border border-line px-3">
            <Detail label="Meta title">{course.seo.metaTitle || '—'}</Detail>
            <Detail label="Focus keyword">{course.seo.focusKeyword || '—'}</Detail>
            <Detail label="Indexing">{course.seo.noIndex ? 'noindex' : 'Indexed'}</Detail>
          </dl>
        </Section>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint, tone }: { icon: typeof Users; label: string; value: string; hint?: string; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <span className={cn('flex size-8 items-center justify-center rounded-lg', tone)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

function Analytics({ courseId }: { courseId: string }) {
  const analytics = useCourseAnalytics(courseId);
  if (analytics.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (analytics.isError) return <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />;
  const a = analytics.data;
  const completion = a.totalEnrollments ? Math.round((a.completedEnrollments / a.totalEnrollments) * 100) : 0;
  const lessonShare = a.totalLessons ? Math.round((a.publishedLessons / a.totalLessons) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric icon={Users} label="Total enrollments" value={formatNumber(a.totalEnrollments)} hint={`${formatNumber(a.activeEnrollments)} active`} tone="bg-primary/10 text-primary" />
        <Metric icon={BookOpenCheck} label="Completed" value={formatNumber(a.completedEnrollments)} hint={`${completion}% completion rate`} tone="bg-success/10 text-success" />
        <Metric icon={Star} label="Average rating" value={a.approvedReviewCount ? a.averageRating.toFixed(1) : '—'} hint={`${formatNumber(a.approvedReviewCount)} approved reviews`} tone="bg-warning/10 text-warning" />
        <Metric icon={Layers} label="Topics" value={formatNumber(a.totalTopics)} tone="bg-accent/10 text-accent" />
        <Metric icon={ListChecks} label="Lessons" value={formatNumber(a.totalLessons)} hint={`${formatNumber(a.publishedLessons)} published`} tone="bg-info/10 text-info" />
        <Metric icon={CalendarClock} label="Published" value={formatDate(a.publishedAt)} hint={`Created ${formatDate(a.createdAt)}`} tone="bg-surface-2 text-ink-muted" />
      </div>
      <div className="rounded-xl border border-line p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-ink">Lessons published</span>
          <span className="text-ink-muted">{lessonShare}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${lessonShare}%` }} />
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-subtle">
          <Clock className="size-3" aria-hidden />
          The backend caches analytics for up to a minute, so very recent enrollments can take that long to appear.
        </p>
      </div>
    </div>
  );
}

export function CourseDetailsDialog({ courseId, seed, onClose, onEdit, onStatusAction, statusPending }: CourseDetailsDialogProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const detail = useCourseDetail(courseId, seed);
  const course = detail.data;
  const tabs: Array<{ key: Tab; label: string; show: boolean }> = [
    { key: 'overview', label: 'Overview', show: true },
    { key: 'curriculum', label: 'Curriculum', show: coursePolicy.canReadCurriculum(user) },
    { key: 'analytics', label: 'Analytics', show: coursePolicy.canReadAnalytics(user) },
  ];

  return (
    <Dialog
      open
      onClose={onClose}
      size="full"
      title={course?.title ?? 'Course details'}
      description={course ? `/${course.slug}` : undefined}
      toolbar={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" aria-label="Course sections" className="flex gap-1">
            {tabs
              .filter((t) => t.show)
              .map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition', tab === t.key ? 'bg-primary/10 text-primary' : 'text-ink-muted hover:bg-surface-2 hover:text-ink')}
                >
                  {t.label}
                </button>
              ))}
          </div>
          {course ? (
            <div className="flex flex-wrap items-center gap-2">
              <CourseStatusBadge status={course.status} />
              {coursePolicy.canChangeStatus(user)
                ? statusActionsFor(course.status).map((action) => {
                    const Icon = STATUS_ICONS[action];
                    return (
                      <Button key={action} size="sm" variant={action === 'publish' ? 'primary' : 'secondary'} disabled={statusPending} onClick={() => onStatusAction(course, action)}>
                        <Icon className="size-3.5" aria-hidden />
                        {STATUS_ACTIONS[action].label}
                      </Button>
                    );
                  })
                : null}
              {coursePolicy.canUpdate(user) ? (
                <Button size="sm" variant="secondary" onClick={() => onEdit(course)}>
                  <Pencil className="size-3.5" aria-hidden />
                  Edit
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      }
    >
      {detail.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : detail.isError ? (
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      ) : course ? (
        <>
          {tab === 'overview' ? (
            <>
              <div className="mb-5 flex items-center gap-4">
                <CourseThumb course={course} size="lg" />
                <div className="min-w-0 text-xs text-ink-muted">
                  <p className="flex items-center gap-1.5">
                    <Eye className="size-3.5" aria-hidden />
                    {course.isFeatured ? 'Featured course' : 'Standard listing'} · sort order {course.sortOrder}
                  </p>
                  <p className="mt-1">Created {formatDate(course.createdAt)}</p>
                </div>
              </div>
              <Overview course={course} />
            </>
          ) : null}
          {tab === 'curriculum' ? <CurriculumEditor course={course} /> : null}
          {tab === 'analytics' ? <Analytics courseId={course.id} /> : null}
        </>
      ) : null}
    </Dialog>
  );
}
