'use client';

import { BookOpen, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { canUseDashboard } from '@/lib/roles';
import { cn } from '@/lib/cn';
import { useMyCourses } from '../hooks';

export function MyLearning() {
  const { user } = useAuth();
  const courses = useMyCourses(true);
  const staff = canUseDashboard(user);
  const rows = courses.data ?? [];

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink">My learning</h1>
      <p className="mt-1 text-sm text-ink-muted">Courses you are enrolled in.</p>
      <div className="mt-6">
        {courses.isError ? (
          <ErrorState error={courses.error} onRetry={() => courses.refetch()} />
        ) : courses.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-lg" />
            ))}
          </div>
        ) : !rows.length ? (
          <div className="rounded-lg border border-line bg-surface">
            <EmptyState
              icon={<BookOpen className="size-5" aria-hidden />}
              title="No enrolled courses"
              description={staff ? 'Staff can open any course’s learner view from Course Management → Curriculum.' : 'Courses you enroll in will appear here.'}
            />
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => {
              const pct = Math.max(0, Math.min(100, Math.round(r.progressPercentage ?? 0)));
              const active = ['active', 'completed'].includes(r.enrollmentStatus);
              const href = `/learn/courses/${r.course.id}${r.nextIncompleteLesson ? `?lesson=${r.nextIncompleteLesson.lessonId}` : ''}`;
              return (
                <li key={r.enrollmentId} className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card">
                  <div className="aspect-[16/7] bg-surface-2">
                    {r.course.thumbnail?.secureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.course.thumbnail.secureUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-ink-subtle">
                        <BookOpen className="size-6" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="line-clamp-2 font-semibold text-ink">{r.course.title}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {r.completedLessonsCount}/{r.totalRequiredLessons} required lessons · {pct}%
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className={cn('h-full rounded-full', pct === 100 ? 'bg-success' : 'bg-primary')} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-auto pt-4">
                      {active ? (
                        <Link href={href} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-fg hover:bg-primary-hover">
                          <PlayCircle className="size-4" aria-hidden />
                          {r.nextIncompleteLesson ? 'Continue' : 'Open course'}
                        </Link>
                      ) : (
                        <span className="text-xs font-medium text-warning">Enrollment {r.enrollmentStatus}</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
