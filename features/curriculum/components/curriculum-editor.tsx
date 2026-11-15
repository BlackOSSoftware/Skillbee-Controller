'use client';

import { Archive, ChevronDown, ChevronsDownUp, ChevronsUpDown, ExternalLink, ListTree, Lock, MousePointerClick, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ActionMenu, type MenuItem } from '@/components/ui/menu';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import type { Course, CourseTopic } from '@/types/courses';
import type { LessonType } from '@/types/curriculum';
import { useCourseTopics } from '@/features/courses/hooks';
import { curriculumPolicy, useArchiveTopic } from '../hooks';
import { formatClock, LESSON_TYPE_META } from '../display';
import { NewLessonDialog, TopicDialog } from './curriculum-dialogs';
import { LessonEditor } from './lesson-editor';

function Summary({ topics }: { topics: CourseTopic[] }) {
  const lessons = topics.flatMap((t) => t.lessons ?? []);
  const published = lessons.filter((l) => l.status === 'published').length;
  const seconds = lessons.reduce((s, l) => s + (l.durationSeconds ?? 0), 0);
  const byType = (type: LessonType) => lessons.filter((l) => l.type === type).length;
  const items: Array<[string, string]> = [
    ['Topics', formatNumber(topics.length)],
    ['Lessons', formatNumber(lessons.length)],
    ['Published', `${formatNumber(published)} / ${formatNumber(lessons.length)}`],
    ['Total duration', seconds ? formatClock(seconds) : '—'],
    ['Video · text', `${byType('video')} · ${byType('text')}`],
    ['Live · resources', `${byType('live')} · ${byType('resource')}`],
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
      {items.map(([k, v]) => (
        <div key={k} className="bg-surface px-4 py-3">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{k}</dt>
          <dd className="mt-0.5 text-base font-semibold tabular-nums text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CurriculumEditor({ course }: { course: Course }) {
  const { user } = useAuth();
  const toast = useToast();
  const topics = useCourseTopics(course.id);
  const archiveTopic = useArchiveTopic(course.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [topicDialog, setTopicDialog] = useState<{ topic?: CourseTopic } | null>(null);
  const [newLessonIn, setNewLessonIn] = useState<CourseTopic | null>(null);
  const [archiving, setArchiving] = useState<CourseTopic | null>(null);
  const canTopics = curriculumPolicy.canWriteTopics(user);
  const canDeleteTopics = curriculumPolicy.canDeleteTopics(user);
  const canLessons = curriculumPolicy.canWriteLessons(user);

  if (topics.isError) return <ErrorState error={topics.error} onRetry={() => topics.refetch()} />;
  if (topics.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  const list = topics.data.topics;
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allCollapsed = list.length > 0 && list.every((t) => collapsed.has(t.id));

  function topicMenu(t: CourseTopic): MenuItem[] {
    const items: MenuItem[] = [];
    if (canLessons) items.push({ key: 'lesson', label: 'Add lesson', icon: <Plus className="size-4" />, onSelect: () => setNewLessonIn(t) });
    if (canTopics) items.push({ key: 'edit', label: 'Edit topic', icon: <Pencil className="size-4" />, onSelect: () => setTopicDialog({ topic: t }) });
    if (canDeleteTopics) items.push({ key: 'archive', label: 'Archive topic', icon: <Archive className="size-4" />, tone: 'danger', onSelect: () => setArchiving(t) });
    return items;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink">Curriculum</h3>
          <p className="text-xs text-ink-muted">Topics and lessons in learner order. Select a lesson to edit its content, media and publishing.</p>
        </div>
        <a href={`/learn/courses/${course.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          Open learner view
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
      <Summary topics={list} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface lg:sticky lg:top-0 lg:max-h-[calc(92vh-230px)] lg:self-start lg:overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
              <ListTree className="size-3.5 text-ink-subtle" aria-hidden />
              Outline
            </p>
            <div className="flex items-center gap-1">
              {list.length ? (
                <Button size="sm" variant="ghost" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(list.map((t) => t.id)))} aria-label={allCollapsed ? 'Expand all topics' : 'Collapse all topics'}>
                  {allCollapsed ? <ChevronsUpDown className="size-3.5" aria-hidden /> : <ChevronsDownUp className="size-3.5" aria-hidden />}
                </Button>
              ) : null}
              {canTopics ? (
                <Button size="sm" variant="secondary" onClick={() => setTopicDialog({})}>
                  <Plus className="size-3.5" aria-hidden />
                  Topic
                </Button>
              ) : null}
            </div>
          </div>
          {!list.length ? (
            <EmptyState icon={<ListTree className="size-5" aria-hidden />} title="No topics yet" description="Add a topic, then lessons inside it." action={canTopics ? <Button size="sm" onClick={() => setTopicDialog({})}>Add first topic</Button> : undefined} />
          ) : (
            <ol className="divide-y divide-line">
              {list.map((t, ti) => {
                const open = !collapsed.has(t.id);
                const lessons = t.lessons ?? [];
                const menu = topicMenu(t);
                return (
                  <li key={t.id}>
                    <div className="flex items-center gap-1 px-2 py-2">
                      <button type="button" onClick={() => toggle(t.id)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-surface-2">
                        <ChevronDown className={cn('size-4 shrink-0 text-ink-subtle transition-transform', !open && '-rotate-90')} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-ink">
                            <span className="mr-1.5 tabular-nums text-ink-subtle">{ti + 1}.</span>
                            {t.title}
                          </span>
                          <span className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
                            {lessons.length} lesson{lessons.length === 1 ? '' : 's'}
                            {t.status !== 'published' ? <span className="text-warning">· {t.status}</span> : null}
                            {t.availabilityType === 'scheduled' ? (
                              <span className="inline-flex items-center gap-0.5">
                                · <Lock className="size-3" aria-hidden /> scheduled
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                      {menu.length ? <ActionMenu items={menu} label={`Actions for ${t.title}`} /> : null}
                    </div>
                    {open ? (
                      <ul className="pb-2">
                        {lessons.map((l) => {
                          const meta = LESSON_TYPE_META[l.type];
                          const active = selected === l.id;
                          return (
                            <li key={l.id}>
                              <button
                                type="button"
                                onClick={() => setSelected(l.id)}
                                aria-current={active ? 'true' : undefined}
                                className={cn(
                                  'relative flex w-full items-center gap-2.5 py-1.5 pl-9 pr-3 text-left text-[13px] transition-colors',
                                  active ? 'bg-primary/[0.08] text-ink' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                                )}
                              >
                                {active ? <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-primary" aria-hidden /> : null}
                                <meta.icon className={cn('size-3.5 shrink-0', meta.tone)} aria-hidden />
                                <span className={cn('min-w-0 flex-1 truncate', active && 'font-medium')}>{l.title}</span>
                                {l.isPreview ? <span className="rounded bg-primary/10 px-1 text-[9px] font-bold text-primary">FREE</span> : null}
                                <span className={cn('size-1.5 shrink-0 rounded-full', l.status === 'published' ? 'bg-success' : l.status === 'archived' ? 'bg-ink-subtle' : 'bg-warning')} title={l.status} aria-label={l.status} />
                              </button>
                            </li>
                          );
                        })}
                        {canLessons ? (
                          <li>
                            <button type="button" onClick={() => setNewLessonIn(t)} className="flex w-full items-center gap-2 py-1.5 pl-9 pr-3 text-left text-xs font-medium text-primary hover:underline">
                              <Plus className="size-3.5" aria-hidden />
                              Add lesson
                            </button>
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </aside>

        <section className="min-w-0 rounded-lg border border-line bg-surface" aria-label="Lesson editor">
          {selected ? (
            <LessonEditor key={selected} lessonId={selected} topics={list} onSelect={setSelected} onArchived={() => setSelected(null)} />
          ) : (
            <EmptyState icon={<MousePointerClick className="size-5" aria-hidden />} title="Select a lesson" description="Choose a lesson from the outline to edit its details, content, video, attachments and publishing." />
          )}
        </section>
      </div>

      {list.some((t) => (t.lessons ?? []).some((l) => l.status === 'published')) && list.every((t) => t.status !== 'published') ? (
        <p className="text-xs text-warning">Published lessons stay hidden from learners until their topic is published.</p>
      ) : null}

      {topicDialog ? <TopicDialog courseId={course.id} topic={topicDialog.topic} onClose={() => setTopicDialog(null)} /> : null}
      {newLessonIn ? (
        <NewLessonDialog
          courseId={course.id}
          topic={newLessonIn}
          onClose={() => setNewLessonIn(null)}
          onCreated={(lesson) => {
            setNewLessonIn(null);
            setCollapsed((s) => {
              const next = new Set(s);
              next.delete(lesson.topicId);
              return next;
            });
            setSelected(lesson.id);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(archiving)}
        title="Archive this topic?"
        confirmLabel="Archive topic"
        loading={archiveTopic.isPending}
        onCancel={() => setArchiving(null)}
        onConfirm={() =>
          archiving &&
          archiveTopic.mutate(archiving.id, {
            onSuccess: () => {
              toast.success('Topic archived', archiving.title);
              if (selected && (archiving.lessons ?? []).some((l) => l.id === selected)) setSelected(null);
              setArchiving(null);
            },
            onError: (error) => {
              setArchiving(null);
              toast.error('Could not archive topic', normalizeApiError(error).message);
            },
          })
        }
        description={<p>“{archiving?.title}” and its {(archiving?.lessons ?? []).length} lesson(s) are soft-archived and removed from the outline. Lesson IDs and learner progress are preserved.</p>}
      />
    </div>
  );
}
