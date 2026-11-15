'use client';

import { ArrowLeft, ArrowRight, CalendarClock, Download, ExternalLink, FileText, Lock, Paperclip, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { useToast } from '@/providers/toast-provider';
import type { LearningLesson, LearningTopic } from '@/types/learning';
import { formatDateTime } from '@/features/assignments/display';
import { formatBytes, formatClock, LESSON_TYPE_META } from '@/features/curriculum/display';
import { useDownloadLessonAttachment, useDownloadResource, useLearningAttachments, useLearningCurriculum, useLearningLesson } from '../hooks';
import { ProtectedVideo } from './protected-video';

function AccessError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { status, code, message } = normalizeApiError(error);
  if (code === 'NOT_ENROLLED') {
    return <EmptyState icon={<Lock className="size-5" aria-hidden />} title="Enrollment required" description="This lesson is available to enrolled learners. Free preview lessons can be opened without enrolling." />;
  }
  if (code === 'SCHEDULED') return <EmptyState icon={<CalendarClock className="size-5" aria-hidden />} title="Not released yet" description={message} />;
  if (code === 'ACCOUNT_SUSPENDED') return <EmptyState icon={<ShieldAlert className="size-5" aria-hidden />} title="Account suspended" description="Contact support to restore access." />;
  if (status === 404) return <EmptyState icon={<Lock className="size-5" aria-hidden />} title="Lesson not available" description="It may be unpublished or removed." />;
  return <ErrorState error={error} onRetry={onRetry} />;
}

function LessonAttachments({ lesson }: { lesson: LearningLesson }) {
  const toast = useToast();
  const list = useLearningAttachments(lesson.id, true);
  const download = useDownloadLessonAttachment();
  const downloadResource = useDownloadResource();
  const rows = list.data ?? [];
  const resourceIds = new Set(lesson.content?.resourceContent?.resourceIds ?? []);
  const isResourceLesson = lesson.type === 'resource';

  if (list.isError) {
    const { status } = normalizeApiError(list.error);
    return status === 403 ? null : <ErrorState error={list.error} onRetry={() => list.refetch()} compact />;
  }
  if (list.isPending) return <Skeleton className="h-16 w-full" />;
  if (!rows.length) return isResourceLesson ? <p className="text-sm text-ink-subtle">No downloadable files are available for this lesson.</p> : null;

  return (
    <section aria-label="Lesson files" className="rounded-lg border border-line">
      <p className="flex items-center gap-1.5 border-b border-line px-4 py-3 text-sm font-semibold text-ink">
        <Paperclip className="size-4 text-ink-subtle" aria-hidden />
        {isResourceLesson ? 'Lesson resources' : 'Attachments'}
      </p>
      <ul className="divide-y divide-line">
        {rows.map((a) => {
          // Resource-lesson files go through the course-resource download; other files through the lesson attachment download
          const viaResource = isResourceLesson && resourceIds.has(a.id);
          const pending = viaResource ? downloadResource.isPending && downloadResource.variables?.resourceId === a.id : download.isPending && download.variables?.fileId === a.id;
          return (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="size-5 shrink-0 text-ink-subtle" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{a.title}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {a.originalFileName} · {formatBytes(a.sizeBytes)}
                  {a.description ? ` · ${a.description}` : ''}
                </span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() => {
                  const onError = (error: unknown) => {
                    const { code, message } = normalizeApiError(error);
                    toast.error('Download not allowed', code === 'NOT_ENROLLED' ? 'Enroll in the course to download this file.' : message);
                  };
                  if (viaResource) downloadResource.mutate({ resourceId: a.id, filename: a.originalFileName }, { onError });
                  else download.mutate({ lessonId: lesson.id, fileId: a.id, filename: a.originalFileName }, { onError });
                }}
              >
                {pending ? null : <Download className="size-3.5" aria-hidden />}
                Download
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LessonBody({ lesson }: { lesson: LearningLesson }) {
  const c = lesson.content;
  if (lesson.type === 'video') return <ProtectedVideo key={lesson.id} lesson={lesson} />;
  if (lesson.type === 'text') {
    const body = c?.textContent?.body ?? '';
    if (!body.trim()) return <p className="text-sm text-ink-subtle">This lesson has no text yet.</p>;
    return c?.textContent?.format === 'markdown' ? (
      <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-ink">{body}</pre>
    ) : (
      // Stored HTML is sanitized by the backend (sanitizeRichText) on write
      <div className="lesson-html text-[15px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: body }} />
    );
  }
  if (lesson.type === 'live') {
    const live = c?.liveSession;
    return (
      <div className="rounded-lg border border-line p-4">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-subtle">Starts</dt>
            <dd className="text-ink">{formatDateTime(live?.startsAt ?? null)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">Ends</dt>
            <dd className="text-ink">{formatDateTime(live?.endsAt ?? null)}</dd>
          </div>
        </dl>
        {live?.instructions ? <p className="mt-3 whitespace-pre-wrap text-sm text-ink-muted">{live.instructions}</p> : null}
        {live?.meetingUrl ? (
          <a href={live.meetingUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-fg hover:bg-primary-hover">
            Join session
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : (
          <p className="mt-3 text-xs text-ink-subtle">The joining link is shown to enrolled learners.</p>
        )}
      </div>
    );
  }
  return c?.resourceContent?.instructions ? <p className="whitespace-pre-wrap text-sm text-ink-muted">{c.resourceContent.instructions}</p> : null;
}

function Outline({ topics, current, onOpen }: { topics: LearningTopic[]; current: string | null; onOpen: (id: string) => void }) {
  return (
    <ol className="divide-y divide-line">
      {topics.map((t, i) => (
        <li key={t.id} className="py-2">
          <p className="flex items-center gap-1.5 px-3 py-1 text-[13px] font-semibold text-ink">
            <span className="tabular-nums text-ink-subtle">{i + 1}.</span>
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            {t.locked ? <Lock className="size-3.5 text-ink-subtle" aria-label="Locked" /> : null}
          </p>
          {t.locked ? <p className="px-3 pb-1 text-[11px] text-ink-subtle">Unlocks later</p> : null}
          <ul>
            {t.lessons.map((l) => {
              const meta = LESSON_TYPE_META[l.type];
              const active = current === l.id;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(l.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn('relative flex w-full items-center gap-2 py-1.5 pl-8 pr-3 text-left text-[13px] transition-colors', active ? 'bg-primary/[0.08] font-medium text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink')}
                  >
                    {active ? <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-primary" aria-hidden /> : null}
                    {l.locked ? <Lock className="size-3.5 shrink-0 text-ink-subtle" aria-hidden /> : <meta.icon className={cn('size-3.5 shrink-0', meta.tone)} aria-hidden />}
                    <span className="min-w-0 flex-1 truncate">{l.title}</span>
                    {l.isPreview ? <span className="rounded bg-primary/10 px-1 text-[9px] font-bold text-primary">FREE</span> : null}
                    {l.durationSeconds ? <span className="shrink-0 text-[11px] tabular-nums text-ink-subtle">{formatClock(l.durationSeconds)}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function CoursePlayer() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const curriculum = useLearningCurriculum(courseId);
  const lessons = (curriculum.data?.topics ?? []).flatMap((t) => t.lessons);
  const requested = params.get('lesson');
  const currentId = requested && lessons.some((l) => l.id === requested) ? requested : (lessons.find((l) => !l.locked)?.id ?? lessons[0]?.id ?? null);
  const lesson = useLearningLesson(currentId);
  const index = lessons.findIndex((l) => l.id === currentId);
  const lessonRef = useRef<HTMLElement>(null);
  const open = (id: string) => {
    router.replace(`/learn/courses/${courseId}?lesson=${id}`, { scroll: false });
    // On small screens the outline sits below the lesson, so bring the lesson back into view.
    const el = lessonRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (curriculum.isError) {
    return (
      <div className="rounded-lg border border-line bg-surface">
        <AccessError error={curriculum.error} onRetry={() => curriculum.refetch()} />
      </div>
    );
  }
  if (curriculum.isPending) {
    return (
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  const c = curriculum.data;
  const l = lesson.data;
  const meta = l ? LESSON_TYPE_META[l.type] : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/learn" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
            <ArrowLeft className="size-3.5" aria-hidden />
            My learning
          </Link>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-ink">{c.course.title}</h1>
        </div>
        <span className={cn('rounded-md border px-2 py-1 text-xs font-medium', c.enrolled ? 'border-success/30 text-success' : c.isStaff ? 'border-primary/30 text-primary' : 'border-warning/30 text-warning')}>
          {c.enrolled ? 'Enrolled' : c.isStaff ? 'Staff access' : 'Not enrolled · previews only'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="order-2 min-w-0 overflow-hidden rounded-lg border border-line bg-surface lg:order-1 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
          <p className="border-b border-line px-3 py-2.5 text-xs font-semibold text-ink">Course content · {lessons.length} lessons</p>
          {c.topics.length ? <Outline topics={c.topics} current={currentId} onOpen={open} /> : <EmptyState title="No lessons published yet" />}
        </aside>

        <section ref={lessonRef} className="order-1 min-w-0 scroll-mt-20 rounded-lg border border-line bg-surface lg:order-2" aria-label="Lesson">
          {!currentId ? (
            <EmptyState title="No lessons available" description="Published lessons appear here." />
          ) : lesson.isError ? (
            <AccessError error={lesson.error} onRetry={() => lesson.refetch()} />
          ) : !l ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="aspect-video w-full" />
            </div>
          ) : (
            <article>
              <header className="border-b border-line px-5 py-4">
                {meta ? (
                  <p className={cn('flex items-center gap-1.5 text-xs font-medium', meta.tone)}>
                    <meta.icon className="size-3.5" aria-hidden />
                    {meta.label}
                    {l.durationSeconds ? ` · ${formatClock(l.durationSeconds)}` : ''}
                  </p>
                ) : null}
                <h2 className="mt-1 text-lg font-semibold text-ink">{l.title}</h2>
                {l.description ? <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{l.description}</p> : null}
              </header>
              <div className="space-y-5 px-5 py-5">
                {l.locked ? (
                  <EmptyState icon={<Lock className="size-5" aria-hidden />} title="This lesson is locked" description="Enroll in the course to open it." />
                ) : (
                  <>
                    <LessonBody lesson={l} />
                    <LessonAttachments key={l.id} lesson={l} />
                  </>
                )}
              </div>
              <footer className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
                <Button size="sm" variant="ghost" disabled={index <= 0} onClick={() => index > 0 && open(lessons[index - 1].id)}>
                  <ArrowLeft className="size-3.5" aria-hidden />
                  Previous
                </Button>
                <Button size="sm" variant="secondary" disabled={index < 0 || index >= lessons.length - 1} onClick={() => index < lessons.length - 1 && open(lessons[index + 1].id)}>
                  Next
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              </footer>
            </article>
          )}
        </section>
      </div>
    </div>
  );
}
