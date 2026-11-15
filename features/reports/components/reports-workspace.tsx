'use client';

import { BarChart3, BookOpen, ClipboardList, Info, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { BarList, DonutChart } from '@/components/ui/charts';
import { Card, CardHeader } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { RefreshButton } from '@/components/ui/refresh-button';
import { Select } from '@/components/ui/input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useCourseAnalytics, useCoursesList } from '@/features/courses/hooks';
import { useQuizAnalytics, useQuizList } from '@/features/quizzes/hooks';
import { formatDate, formatNumber, titleCase } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { CourseAnalytics } from '@/types/courses';
import type { QuizAnalytics } from '@/types/quizzes';

const COURSE_CATALOG_PARAMS = { page: 1, limit: 100, sortBy: 'title' as const, sortOrder: 'asc' as const };
const QUIZ_CATALOG_PARAMS = { page: 1, limit: 100, sortBy: 'title' as const, sortOrder: 'asc' as const };

function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return m ? `${m}m ${s}s` : `${s}s`;
}

function formatScore(value: number | null): string {
  return value == null ? '—' : `${value}%`;
}

// ---------------- Course analytics ----------------

function CourseAnalyticsSection() {
  const catalog = useCoursesList(COURSE_CATALOG_PARAMS);
  const courses = useMemo(() => catalog.data?.data ?? [], [catalog.data]);
  const [pickedCourseId, setCourseId] = useState('');
  // Default to the first course; the admin can override with the selector.
  const courseId = pickedCourseId || courses[0]?.id || '';

  const analytics = useCourseAnalytics(courseId || null);
  const a: CourseAnalytics | undefined = analytics.data;

  const enrollmentSegments = useMemo(
    () =>
      a
        ? [
            { label: 'Active', value: a.activeEnrollments },
            { label: 'Completed', value: a.completedEnrollments },
            { label: 'Other enrollments', value: Math.max(0, a.totalEnrollments - a.activeEnrollments - a.completedEnrollments) },
          ]
        : [],
    [a]
  );

  return (
    <Card>
      <CardHeader
        title="Course analytics"
        description="Per-course enrollment, completion, rating and content metrics from GET /admin/courses/:id/analytics."
        action={
          <div className="flex items-center gap-2">
            <Select
              aria-label="Select course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-44 sm:w-56"
              disabled={!courses.length}
            >
              {courses.length ? null : <option value="">No courses</option>}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
            <RefreshButton queryKeys={[queryKeys.courses.analytics(courseId), queryKeys.courses.lists()]} />
          </div>
        }
      />

      {catalog.isLoading ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : catalog.isError ? (
        <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />
      ) : !courses.length ? (
        <EmptyState icon={<BookOpen className="size-5" aria-hidden />} title="No courses yet" description="Create a course in Course Management to see its analytics here." />
      ) : !courseId ? (
        <EmptyState title="Select a course" description="Choose a course above to load its analytics." />
      ) : analytics.isLoading ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : analytics.isError ? (
        <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />
      ) : a ? (
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={a.courseStatus === 'published' ? 'success' : 'neutral'}>{titleCase(a.courseStatus)}</Badge>
            {a.publishedAt ? <span className="text-xs text-ink-subtle">Published {formatDate(a.publishedAt)}</span> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total enrollments" icon={BookOpen} tone="sky" value={a.totalEnrollments} isLoading={false} />
            <KpiCard label="Active enrollments" icon={ClipboardList} tone="teal" value={a.activeEnrollments} isLoading={false} />
            <KpiCard label="Completed" icon={BarChart3} tone="purple" value={a.completedEnrollments} isLoading={false} />
            <KpiCard
              label="Average rating"
              icon={Star}
              tone="amber"
              value={null}
              isLoading={false}
              hint={a.approvedReviewCount ? `${a.averageRating.toFixed(1)} · ${formatNumber(a.approvedReviewCount)} reviews` : 'No approved reviews yet'}
              unavailable={a.approvedReviewCount ? undefined : 'No reviews'}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-lg border border-line/60 bg-surface-2/30 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Enrollment status</p>
              <DonutChart
                segments={enrollmentSegments}
                centerValue={formatNumber(a.totalEnrollments)}
                centerLabel="enrollments"
              />
            </div>
            <div className="rounded-lg border border-line/60 bg-surface-2/30 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Course content</p>
              <BarList
                rows={[
                  { label: 'Published lessons', value: a.publishedLessons },
                  { label: 'Total lessons', value: a.totalLessons },
                  { label: 'Topics', value: a.totalTopics },
                ]}
                emptyLabel="No content published yet"
              />
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

// ---------------- Quiz analytics ----------------

function QuizAnalyticsSection() {
  const catalog = useQuizList(QUIZ_CATALOG_PARAMS);
  const quizzes = useMemo(() => catalog.data?.quizzes ?? [], [catalog.data]);
  const [pickedQuizId, setQuizId] = useState('');
  const quizId = pickedQuizId || quizzes[0]?.id || '';

  const analytics = useQuizAnalytics(quizId, Boolean(quizId));
  const a: QuizAnalytics | undefined = analytics.data;

  const attemptSegments = useMemo(
    () =>
      a
        ? [
            { label: 'Completed', value: a.completedAttempts },
            { label: 'In progress', value: a.inProgressAttempts },
            { label: 'Expired', value: a.expiredAttempts },
          ]
        : [],
    [a]
  );

  const outcomeSegments = useMemo(
    () =>
      a && a.passCount + a.failCount > 0
        ? [
            { label: 'Passed', value: a.passCount },
            { label: 'Failed', value: a.failCount },
          ]
        : [],
    [a]
  );

  return (
    <Card>
      <CardHeader
        title="Quiz analytics"
        description="Per-quiz attempts, scores and pass rates from GET /admin/quizzes/:id/analytics."
        action={
          <div className="flex items-center gap-2">
            <Select
              aria-label="Select quiz"
              value={quizId}
              onChange={(e) => setQuizId(e.target.value)}
              className="w-44 sm:w-56"
              disabled={!quizzes.length}
            >
              {quizzes.length ? null : <option value="">No quizzes</option>}
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </Select>
            <RefreshButton queryKeys={[queryKeys.quizzes.analytics(quizId), queryKeys.quizzes.lists()]} />
          </div>
        }
      />

      {catalog.isLoading ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : catalog.isError ? (
        <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />
      ) : !quizzes.length ? (
        <EmptyState icon={<ClipboardList className="size-5" aria-hidden />} title="No quizzes yet" description="Create a quiz in Quiz Management to see its analytics here." />
      ) : !quizId ? (
        <EmptyState title="Select a quiz" description="Choose a quiz above to load its analytics." />
      ) : analytics.isLoading ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : analytics.isError ? (
        <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />
      ) : a ? (
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{a.title}</Badge>
            <span className="text-xs text-ink-subtle">{formatNumber(a.uniqueStudents)} unique students</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total attempts" icon={ClipboardList} tone="sky" value={a.totalAttempts} isLoading={false} />
            <KpiCard label="Completed attempts" icon={BarChart3} tone="teal" value={a.completedAttempts} isLoading={false} />
            <KpiCard label="Average score" icon={Star} tone="purple" value={null} isLoading={false} hint={formatScore(a.averageScore)} unavailable={a.averageScore == null ? 'No scored attempts' : undefined} />
            <KpiCard label="Pass rate" icon={BookOpen} tone="amber" value={null} isLoading={false} hint={formatScore(a.passPercentage)} unavailable={a.passPercentage == null ? 'No graded attempts' : undefined} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-lg border border-line/60 bg-surface-2/30 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Attempt status</p>
              <DonutChart segments={attemptSegments} centerValue={formatNumber(a.totalAttempts)} centerLabel="attempts" />
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-line/60 bg-surface-2/30 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Outcomes</p>
                {outcomeSegments.length ? (
                  <DonutChart segments={outcomeSegments} centerValue={formatScore(a.passPercentage)} centerLabel="pass rate" size={120} thickness={16} />
                ) : (
                  <p className="py-4 text-center text-xs text-ink-subtle">No graded attempts yet</p>
                )}
              </div>
              <div className="rounded-lg border border-line/60 bg-surface-2/30 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Performance</p>
                <dl className="space-y-2 text-xs">
                  {[
                    ['Highest score', a.highestScore == null ? '—' : `${a.highestScore}%`],
                    ['Lowest score', a.lowestScore == null ? '—' : `${a.lowestScore}%`],
                    ['Average time taken', formatDuration(a.averageTimeTaken)],
                    ['Pending manual evaluations', formatNumber(a.pendingManualEvaluations)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <dt className="text-ink-muted">{label}</dt>
                      <dd className="font-semibold tabular-nums text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export function ReportsWorkspace() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Per-course and per-quiz analytics powered by the existing admin endpoints."
      />

      <Card className="border-primary/20 bg-primary/[0.04]">
        <div className="flex gap-3 p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="text-xs leading-relaxed text-ink-muted">
            <p className="font-semibold text-ink">Platform-wide reporting is not available yet.</p>
            <p className="mt-1">
              The backend currently exposes analytics only per course (<code className="rounded bg-surface-2 px-1">GET /admin/courses/:id/analytics</code>)
              and per quiz (<code className="rounded bg-surface-2 px-1">GET /admin/quizzes/:id/analytics</code>). There is no platform-wide revenue,
              enrollment-trend, or organization-level aggregate endpoint, so this page intentionally shows no fake totals or revenue charts.
            </p>
          </div>
        </div>
      </Card>

      <CourseAnalyticsSection />
      <QuizAnalyticsSection />
    </div>
  );
}
