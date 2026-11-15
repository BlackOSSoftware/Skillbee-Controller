'use client';

import { Archive, Copy, ExternalLink, Eye, FileText, FolderInput, Info, Megaphone, Paperclip, PlayCircle, Rocket, Settings2, Trash2, Undo2, type LucideIcon } from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import type { CourseTopic } from '@/types/courses';
import { LESSON_TYPES, type AdminLesson, type LessonStatus, type LessonType, type LiveSession, type UpdateLessonInput } from '@/types/curriculum';
import { Toggle } from '@/features/courses/components/form-controls';
import { formatDateTime } from '@/features/assignments/display';
import { curriculumPolicy, useAdminLesson, useArchiveLesson, useDuplicateLesson, useLessonAttachments, useLessonPreview, useLessonStatus, useUpdateLesson } from '../hooks';
import { formatClock, fromLocalInput, LESSON_TYPE_META, LessonStatusBadge, lessonStatusLabel, toLocalInput, VideoStatusBadge } from '../display';
import { LessonAttachmentsPanel } from './lesson-attachments-panel';
import { LessonVideoPanel } from './lesson-video-panel';
import { MoveLessonDialog } from './move-lesson-dialog';

type Section = 'basics' | 'content' | 'video' | 'attachments' | 'publishing' | 'preview';

const SECTIONS: Array<{ id: Section; label: string; icon: LucideIcon }> = [
  { id: 'basics', label: 'Basic information', icon: Settings2 },
  { id: 'content', label: 'Lesson content', icon: FileText },
  { id: 'video', label: 'Video', icon: PlayCircle },
  { id: 'attachments', label: 'Attachments', icon: Paperclip },
  { id: 'publishing', label: 'Publishing', icon: Rocket },
  { id: 'preview', label: 'Preview', icon: Eye },
];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function useSave(lesson: AdminLesson, success: string) {
  const toast = useToast();
  const update = useUpdateLesson();
  const inFlight = useRef(false);
  const save = (input: UpdateLessonInput, onDone?: () => void) => {
    if (inFlight.current) return;
    if (!Object.keys(input).length) {
      toast.notify({ tone: 'info', title: 'No changes to save' });
      return;
    }
    inFlight.current = true;
    update.mutate(
      { id: lesson.id, input },
      {
        onSuccess: (l) => {
          toast.success(success, l.title);
          onDone?.();
        },
        onError: (error) => toast.error('Could not save lesson', normalizeApiError(error).message),
        onSettled: () => {
          inFlight.current = false;
        },
      }
    );
  };
  return { save, pending: update.isPending };
}

function SaveBar({ dirty, pending, onReset, form }: { dirty: boolean; pending: boolean; onReset: () => void; form: string }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-6 flex items-center justify-end gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
      {dirty ? <span className="mr-auto text-xs text-warning">Unsaved changes</span> : <span className="mr-auto text-xs text-ink-subtle">All changes saved</span>}
      <Button variant="ghost" onClick={onReset} disabled={!dirty || pending}>
        Reset
      </Button>
      <Button type="submit" form={form} loading={pending} disabled={!dirty}>
        Save
      </Button>
    </div>
  );
}

function BasicsPanel({ lesson, canWrite }: { lesson: AdminLesson; canWrite: boolean }) {
  const initial = {
    title: lesson.title,
    slug: lesson.slug,
    description: lesson.description,
    type: lesson.type,
    minutes: String(Math.floor((lesson.durationSeconds || 0) / 60)),
    seconds: String(Math.round((lesson.durationSeconds || 0) % 60)),
    isRequired: lesson.isRequired,
    isPreview: lesson.isPreview,
    scheduledAt: toLocalInput(lesson.scheduledAt),
  };
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { save, pending } = useSave(lesson, 'Lesson details saved');
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  function set<K extends keyof typeof v>(key: K, value: (typeof v)[K]) {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (v.title.trim().length < 3 || v.title.trim().length > 200) found.title = 'Title must be 3–200 characters.';
    if (!SLUG_RE.test(v.slug.trim().toLowerCase())) found.slug = 'Lowercase letters, numbers and single hyphens only.';
    if (v.description.length > 20000) found.description = '20,000 characters or less.';
    const min = Number(v.minutes);
    const sec = Number(v.seconds);
    if (!Number.isFinite(min) || min < 0 || !Number.isFinite(sec) || sec < 0 || sec > 59) found.duration = 'Minutes 0 or more, seconds 0–59.';
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    const input: UpdateLessonInput = {};
    if (v.title.trim() !== lesson.title) input.title = v.title.trim();
    if (v.slug.trim().toLowerCase() !== lesson.slug) input.slug = v.slug.trim().toLowerCase();
    if (v.description !== lesson.description) input.description = v.description;
    if (v.type !== lesson.type) input.type = v.type;
    const duration = Math.round(min * 60 + sec);
    if (duration !== Math.round(lesson.durationSeconds || 0)) input.durationSeconds = duration;
    if (v.isRequired !== lesson.isRequired) input.isRequired = v.isRequired;
    if (v.isPreview !== lesson.isPreview) input.isPreview = v.isPreview;
    if (v.scheduledAt !== initial.scheduledAt) input.scheduledAt = fromLocalInput(v.scheduledAt);
    save(input);
  }

  return (
    <form id="lesson-basics" onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={!canWrite || pending} className="space-y-4">
        <Field id="lb-title" label="Title" required error={errors.title}>
          <Input id="lb-title" value={v.title} onChange={(e) => set('title', e.target.value)} maxLength={220} aria-invalid={Boolean(errors.title)} aria-describedby="lb-title-msg" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="lb-slug" label="Slug" required error={errors.slug} hint="Unique within the course">
            <Input id="lb-slug" value={v.slug} onChange={(e) => set('slug', e.target.value)} aria-invalid={Boolean(errors.slug)} aria-describedby="lb-slug-msg" />
          </Field>
          <Field id="lb-type" label="Lesson type" hint={v.type !== lesson.type ? 'Content saved for other types is kept but not shown.' : undefined}>
            <Select id="lb-type" value={v.type} onChange={(e) => set('type', e.target.value as LessonType)} aria-describedby="lb-type-msg">
              {LESSON_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LESSON_TYPE_META[t].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id="lb-description" label="Description" error={errors.description} hint={`${v.description.length.toLocaleString('en-IN')}/20,000 · shown above the lesson`}>
          <Textarea id="lb-description" rows={4} value={v.description} onChange={(e) => set('description', e.target.value)} aria-describedby="lb-description-msg" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="lb-minutes" label="Duration" error={errors.duration} hint="Minutes and seconds">
            <div className="flex items-center gap-2">
              <Input id="lb-minutes" type="number" min={0} value={v.minutes} onChange={(e) => set('minutes', e.target.value)} className="w-24" aria-label="Minutes" aria-describedby="lb-minutes-msg" />
              <span className="text-ink-subtle">:</span>
              <Input type="number" min={0} max={59} value={v.seconds} onChange={(e) => set('seconds', e.target.value)} className="w-24" aria-label="Seconds" />
            </div>
          </Field>
          <Field id="lb-scheduled" label="Release at" hint="Leave empty to release immediately">
            <Input id="lb-scheduled" type="datetime-local" value={v.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} aria-describedby="lb-scheduled-msg" />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Toggle id="lb-required" label="Required for completion" checked={v.isRequired} onChange={(c) => set('isRequired', c)} />
          <Toggle id="lb-preview" label="Free preview" description="Published preview lessons open without enrollment." checked={v.isPreview} onChange={(c) => set('isPreview', c)} />
        </div>
      </fieldset>
      {canWrite ? <SaveBar dirty={dirty} pending={pending} onReset={() => setV(initial)} form="lesson-basics" /> : null}
    </form>
  );
}

function TextContentForm({ lesson, canWrite }: { lesson: AdminLesson; canWrite: boolean }) {
  const initial = { body: lesson.content.textContent?.body ?? '', format: lesson.content.textContent?.format ?? 'html' };
  const [v, setV] = useState(initial);
  const { save, pending } = useSave(lesson, 'Lesson content saved');
  const dirty = v.body !== initial.body || v.format !== initial.format;
  const tooLong = v.body.length > 200000;
  return (
    <form
      id="lesson-text"
      onSubmit={(e) => {
        e.preventDefault();
        if (!tooLong) save({ textContent: { body: v.body, format: v.format } });
      }}
      noValidate
      className="space-y-4"
    >
      <fieldset disabled={!canWrite || pending} className="space-y-4">
        <Field id="lc-format" label="Format">
          <Select id="lc-format" value={v.format} onChange={(e) => setV((s) => ({ ...s, format: e.target.value as 'html' | 'markdown' }))} className="sm:w-48">
            <option value="html">HTML</option>
            <option value="markdown">Markdown</option>
          </Select>
        </Field>
        <Field id="lc-body" label="Lesson text" error={tooLong ? 'Content must be 200,000 characters or less.' : undefined} hint={`${v.body.length.toLocaleString('en-IN')} characters · HTML is sanitized by the server. Publishing needs non-empty text.`}>
          <Textarea id="lc-body" rows={16} value={v.body} onChange={(e) => setV((s) => ({ ...s, body: e.target.value }))} className="font-mono text-[13px]" aria-describedby="lc-body-msg" />
        </Field>
      </fieldset>
      {canWrite ? <SaveBar dirty={dirty} pending={pending} onReset={() => setV(initial)} form="lesson-text" /> : null}
    </form>
  );
}

function LiveContentForm({ lesson, canWrite }: { lesson: AdminLesson; canWrite: boolean }) {
  const l = lesson.content.liveSession ?? {};
  const initial = { meetingProvider: l.meetingProvider ?? '', meetingUrl: l.meetingUrl ?? '', startsAt: toLocalInput(l.startsAt), endsAt: toLocalInput(l.endsAt), timezone: l.timezone ?? '', instructions: l.instructions ?? '' };
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { save, pending } = useSave(lesson, 'Live session saved');
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const set = (key: keyof typeof v, value: string) => {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (v.meetingUrl) {
      try {
        new URL(v.meetingUrl);
      } catch {
        found.meetingUrl = 'Enter a full URL, e.g. https://meet.example.com/abc.';
      }
    }
    if (v.startsAt && v.endsAt && new Date(v.startsAt) >= new Date(v.endsAt)) found.endsAt = 'Must be after the start.';
    if (v.instructions.length > 2000) found.instructions = '2,000 characters or less.';
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    const live: LiveSession = {};
    if (v.meetingProvider.trim()) live.meetingProvider = v.meetingProvider.trim();
    if (v.meetingUrl.trim()) live.meetingUrl = v.meetingUrl.trim();
    const starts = fromLocalInput(v.startsAt);
    const ends = fromLocalInput(v.endsAt);
    if (starts) live.startsAt = starts;
    if (ends) live.endsAt = ends;
    if (v.timezone.trim()) live.timezone = v.timezone.trim();
    if (v.instructions.trim()) live.instructions = v.instructions.trim();
    save({ liveSession: live });
  }

  return (
    <form id="lesson-live" onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={!canWrite || pending} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="lv-provider" label="Provider" hint="e.g. Zoom, Google Meet">
            <Input id="lv-provider" value={v.meetingProvider} onChange={(e) => set('meetingProvider', e.target.value)} aria-describedby="lv-provider-msg" />
          </Field>
          <Field id="lv-timezone" label="Timezone" hint="e.g. Asia/Kolkata">
            <Input id="lv-timezone" value={v.timezone} onChange={(e) => set('timezone', e.target.value)} aria-describedby="lv-timezone-msg" />
          </Field>
        </div>
        <Field id="lv-url" label="Meeting URL" error={errors.meetingUrl} hint="Shown only to enrolled learners and staff">
          <Input id="lv-url" type="url" value={v.meetingUrl} onChange={(e) => set('meetingUrl', e.target.value)} aria-invalid={Boolean(errors.meetingUrl)} aria-describedby="lv-url-msg" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="lv-start" label="Starts">
            <Input id="lv-start" type="datetime-local" value={v.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </Field>
          <Field id="lv-end" label="Ends" error={errors.endsAt}>
            <Input id="lv-end" type="datetime-local" value={v.endsAt} onChange={(e) => set('endsAt', e.target.value)} aria-invalid={Boolean(errors.endsAt)} aria-describedby="lv-end-msg" />
          </Field>
        </div>
        <Field id="lv-instructions" label="Joining instructions" error={errors.instructions}>
          <Textarea id="lv-instructions" rows={3} value={v.instructions} onChange={(e) => set('instructions', e.target.value)} aria-describedby="lv-instructions-msg" />
        </Field>
        <p className="flex items-start gap-1.5 text-xs text-ink-subtle">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Publishing requires a meeting URL, a start and an end time.
        </p>
      </fieldset>
      {canWrite ? <SaveBar dirty={dirty} pending={pending} onReset={() => setV(initial)} form="lesson-live" /> : null}
    </form>
  );
}

function ResourceContentForm({ lesson, canWrite, onGoAttachments }: { lesson: AdminLesson; canWrite: boolean; onGoAttachments: () => void }) {
  const ids = lesson.content.resourceContent?.resourceIds ?? [];
  const initial = lesson.content.resourceContent?.instructions ?? '';
  const [instructions, setInstructions] = useState(initial);
  const attachments = useLessonAttachments(lesson.id, true);
  const byId = new Map((attachments.data ?? []).map((a) => [a.id, a]));
  // Archiving a file does not unlink it; the backend refuses to publish while any linked file is inactive
  const activeIds = attachments.data ? ids.filter((id) => byId.get(id)?.status === 'active') : ids;
  const stale = ids.length - activeIds.length;
  const { save, pending } = useSave(lesson, 'Resource lesson saved');
  return (
    <form
      id="lesson-resource"
      onSubmit={(e) => {
        e.preventDefault();
        if (instructions.length <= 2000) save({ resourceContent: { resourceIds: activeIds, instructions: instructions.trim() } });
      }}
      noValidate
      className="space-y-4"
    >
      <fieldset disabled={!canWrite || pending} className="space-y-4">
        <Field id="lr-instructions" label="Instructions for learners" error={instructions.length > 2000 ? '2,000 characters or less.' : undefined}>
          <Textarea id="lr-instructions" rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} aria-describedby="lr-instructions-msg" />
        </Field>
      </fieldset>
      <div className="rounded-lg border border-line">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <p className="text-xs font-medium text-ink">Linked resources ({ids.length})</p>
          <Button size="sm" variant="ghost" onClick={onGoAttachments}>
            Manage files
          </Button>
        </div>
        {ids.length ? (
          <ul className="divide-y divide-line">
            {ids.map((id) => {
              const file = byId.get(id);
              const unavailable = attachments.data && file?.status !== 'active';
              return (
                <li key={id} className={cn('flex items-center justify-between gap-2 px-3 py-2 text-sm', unavailable ? 'text-ink-subtle line-through' : 'text-ink')}>
                  <span className="truncate">{file?.title ?? (attachments.isPending ? 'Loading…' : 'Archived file')}</span>
                  {unavailable ? <span className="shrink-0 text-[11px] font-medium text-warning no-underline">Unavailable</span> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-3 py-3 text-xs text-ink-subtle">Files uploaded in Attachments are linked here automatically. Publishing needs at least one.</p>
        )}
        {stale ? (
          <p className="border-t border-line bg-warning/[0.06] px-3 py-2 text-xs text-warning">
            {stale} linked file{stale === 1 ? ' is' : 's are'} archived. Saving unlinks {stale === 1 ? 'it' : 'them'}; publishing is blocked until then.
          </p>
        ) : null}
      </div>
      {canWrite ? <SaveBar dirty={instructions !== initial || stale > 0} pending={pending} onReset={() => setInstructions(initial)} form="lesson-resource" /> : null}
    </form>
  );
}

/** Client hints only; the backend runs the authoritative checks when publishing. */
function readiness(lesson: AdminLesson): Array<{ ok: boolean; label: string }> {
  const c = lesson.content;
  if (lesson.type === 'video') {
    const v = c.video;
    return [
      { ok: Boolean(v), label: 'A video is uploaded or linked' },
      { ok: !v || v.source === 'external' || v.processingStatus === 'ready', label: 'Uploaded video has finished processing' },
    ];
  }
  if (lesson.type === 'text') return [{ ok: Boolean(c.textContent?.body.replace(/<[^>]+>/g, '').trim()), label: 'Lesson text is not empty' }];
  if (lesson.type === 'live') {
    const l = c.liveSession;
    return [
      { ok: Boolean(l?.meetingUrl), label: 'Meeting URL is set' },
      { ok: Boolean(l?.startsAt && l?.endsAt && new Date(l.startsAt) < new Date(l.endsAt)), label: 'Start and end time are set' },
    ];
  }
  return [{ ok: Boolean(c.resourceContent?.resourceIds.length), label: 'At least one resource is linked (archived files must be unlinked in Lesson content)' }];
}

function PublishingPanel({ lesson, topics, onArchived, onSelect }: { lesson: AdminLesson; topics: CourseTopic[]; onArchived: () => void; onSelect: (id: string) => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const status = useLessonStatus();
  const duplicate = useDuplicateLesson();
  const archive = useArchiveLesson();
  const [confirm, setConfirm] = useState<'archive-status' | 'remove' | null>(null);
  const [moving, setMoving] = useState(false);
  const canPublish = curriculumPolicy.canPublishLessons(user);
  const canWrite = curriculumPolicy.canWriteLessons(user);
  const canDelete = curriculumPolicy.canDeleteLessons(user);
  const checks = readiness(lesson);
  const [publishError, setPublishError] = useState<string | null>(null);

  function setStatus(next: LessonStatus) {
    setPublishError(null);
    status.mutate(
      { id: lesson.id, status: next },
      {
        onSuccess: (l) => {
          setConfirm(null);
          toast.success(next === 'published' ? 'Lesson published' : next === 'draft' ? 'Moved to draft' : 'Lesson archived', l.title);
        },
        onError: (error) => {
          setConfirm(null);
          const { message } = normalizeApiError(error);
          setPublishError(message);
          toast.error('Could not change status', message);
        },
      }
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Status</p>
            <p className="mt-0.5 text-xs text-ink-muted">Learners only see published lessons in published topics.</p>
          </div>
          <LessonStatusBadge status={lesson.status} />
        </div>
        <ul className="mt-3 space-y-1.5">
          {checks.map((c) => (
            <li key={c.label} className={cn('flex items-center gap-2 text-xs', c.ok ? 'text-success' : 'text-ink-muted')}>
              <span className={cn('flex size-4 items-center justify-center rounded-full text-[10px] font-bold', c.ok ? 'bg-success/15' : 'bg-surface-2')}>{c.ok ? '✓' : '·'}</span>
              {c.label}
            </li>
          ))}
        </ul>
        {publishError ? <p className="mt-3 rounded-md border border-danger/25 bg-danger/[0.06] px-3 py-2 text-xs text-danger" role="alert">{publishError}</p> : null}
        {canPublish ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {lesson.status !== 'published' ? (
              <Button size="sm" onClick={() => setStatus('published')} loading={status.isPending && status.variables?.status === 'published'} disabled={status.isPending}>
                <Megaphone className="size-3.5" aria-hidden />
                Publish
              </Button>
            ) : null}
            {lesson.status !== 'draft' ? (
              <Button size="sm" variant="secondary" onClick={() => setStatus('draft')} loading={status.isPending && status.variables?.status === 'draft'} disabled={status.isPending}>
                <Undo2 className="size-3.5" aria-hidden />
                Move to draft
              </Button>
            ) : null}
            {lesson.status !== 'archived' ? (
              <Button size="sm" variant="danger" onClick={() => setConfirm('archive-status')} disabled={status.isPending}>
                <Archive className="size-3.5" aria-hidden />
                Archive
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      {canWrite || canDelete ? (
        <section className="rounded-lg border border-line p-4">
          <p className="text-sm font-semibold text-ink">Organize</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canWrite ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={duplicate.isPending}
                  onClick={() =>
                    duplicate.mutate(lesson.id, {
                      onSuccess: (copy) => {
                        toast.success('Lesson duplicated', `“${copy.title}” was created as a draft.`);
                        onSelect(copy.id);
                      },
                      onError: (error) => toast.error('Could not duplicate lesson', normalizeApiError(error).message),
                    })
                  }
                >
                  <Copy className="size-3.5" aria-hidden />
                  Duplicate
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setMoving(true)}>
                  <FolderInput className="size-3.5" aria-hidden />
                  Move to topic
                </Button>
              </>
            ) : null}
            {canDelete ? (
              <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setConfirm('remove')}>
                <Trash2 className="size-3.5" aria-hidden />
                Remove from curriculum
              </Button>
            ) : null}
          </div>
          <p className="mt-3 text-[11px] text-ink-subtle">Removing soft-archives the lesson. Its ID and learner progress history are preserved.</p>
        </section>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line p-4 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-ink-subtle">Created</dt>
          <dd className="mt-0.5 text-ink">{formatDate(lesson.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-ink-subtle">Updated</dt>
          <dd className="mt-0.5 text-ink">{formatDateTime(lesson.updatedAt)}</dd>
        </div>
        <div>
          <dt className="text-ink-subtle">Position</dt>
          <dd className="mt-0.5 text-ink">#{lesson.sortOrder + 1}</dd>
        </div>
        <div>
          <dt className="text-ink-subtle">Release</dt>
          <dd className="mt-0.5 text-ink">{lesson.scheduledAt ? formatDateTime(lesson.scheduledAt) : 'Immediately'}</dd>
        </div>
      </dl>

      {moving ? <MoveLessonDialog lesson={lesson} topics={topics} onClose={() => setMoving(false)} /> : null}
      <ConfirmDialog
        open={confirm === 'archive-status'}
        title="Archive this lesson?"
        confirmLabel="Archive"
        loading={status.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => setStatus('archived')}
        description={<p>Learners will no longer see it. It stays in the curriculum so you can move it back to draft.</p>}
      />
      <ConfirmDialog
        open={confirm === 'remove'}
        title="Remove from curriculum?"
        confirmLabel="Remove lesson"
        loading={archive.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          archive.mutate(lesson.id, {
            onSuccess: () => {
              toast.success('Lesson removed', 'It was soft-archived; progress history is preserved.');
              setConfirm(null);
              onArchived();
            },
            onError: (error) => {
              setConfirm(null);
              toast.error('Could not remove lesson', normalizeApiError(error).message);
            },
          })
        }
        description={<p>“{lesson.title}” is soft-archived and removed from this course outline. Learner progress that references it is kept.</p>}
      />
    </div>
  );
}

function PreviewPanel({ lesson }: { lesson: AdminLesson }) {
  const preview = useLessonPreview(lesson.id, true);
  const p = preview.data;
  const meta = LESSON_TYPE_META[lesson.type];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">Staff preview, including draft content. Learners see published lessons only.</p>
        <a href={`/learn/courses/${lesson.courseId}?lesson=${lesson.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          Open in learner view
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
      {preview.isError ? (
        <ErrorState error={preview.error} onRetry={() => preview.refetch()} />
      ) : !p ? (
        <div className="space-y-2 rounded-lg border border-line p-5">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <article className="overflow-hidden rounded-lg border border-line">
          <header className="border-b border-line bg-surface-2/50 px-5 py-4">
            <p className={cn('flex items-center gap-1.5 text-xs font-medium', meta.tone)}>
              <meta.icon className="size-3.5" aria-hidden />
              {meta.label} · {formatClock(p.durationSeconds)} · {lessonStatusLabel(p.status)}
              {p.isPreview ? ' · free preview' : ''}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-ink">{p.title}</h3>
            {p.description ? <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{p.description}</p> : null}
          </header>
          <div className="px-5 py-4 text-sm text-ink">
            {p.type === 'text' ? (
              p.content.textContent?.body ? (
                p.content.textContent.format === 'markdown' ? (
                  <pre className="whitespace-pre-wrap font-sans leading-relaxed">{p.content.textContent.body}</pre>
                ) : (
                  // Body is sanitized server-side (sanitizeRichText) before it is stored
                  <div className="lesson-html leading-relaxed" dangerouslySetInnerHTML={{ __html: p.content.textContent.body }} />
                )
              ) : (
                <p className="text-ink-subtle">No lesson text yet.</p>
              )
            ) : p.type === 'video' ? (
              p.content.video ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2/40 px-4 py-3">
                  <PlayCircle className="size-5 text-primary" aria-hidden />
                  <span>{p.content.video.source === 'external' ? `External video (${p.content.video.provider})` : p.content.video.originalFileName ?? 'Uploaded video'}</span>
                  <VideoStatusBadge status={p.content.video.processingStatus} />
                  <span className="text-xs text-ink-subtle">Playback is available in the learner view.</span>
                </div>
              ) : (
                <p className="text-ink-subtle">No video yet.</p>
              )
            ) : p.type === 'live' ? (
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink-subtle">Starts</dt>
                  <dd>{formatDateTime(p.content.liveSession?.startsAt ?? null)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-subtle">Ends</dt>
                  <dd>{formatDateTime(p.content.liveSession?.endsAt ?? null)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-ink-subtle">Meeting</dt>
                  <dd className="break-all">{p.content.liveSession?.meetingUrl ?? '—'}</dd>
                </div>
              </dl>
            ) : (
              <p>{p.content.resourceContent?.instructions || 'Resource lesson'} · {p.content.resourceContent?.resourceIds.length ?? 0} linked file(s)</p>
            )}
          </div>
        </article>
      )}
    </div>
  );
}

interface LessonEditorProps {
  lessonId: string;
  topics: CourseTopic[];
  onSelect: (id: string) => void;
  onArchived: () => void;
}

export function LessonEditor({ lessonId, topics, onSelect, onArchived }: LessonEditorProps) {
  const { user } = useAuth();
  const query = useAdminLesson(lessonId);
  const [section, setSection] = useState<Section>('basics');
  const canWrite = curriculumPolicy.canWriteLessons(user);

  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const lesson = query.data;
  if (!lesson) {
    return (
      <div className="space-y-3 p-5">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  const meta = LESSON_TYPE_META[lesson.type];
  const topic = topics.find((t) => t.id === lesson.topicId);

  let body: ReactNode;
  if (section === 'basics') body = <BasicsPanel key={lesson.updatedAt} lesson={lesson} canWrite={canWrite} />;
  else if (section === 'content') {
    body =
      lesson.type === 'text' ? (
        <TextContentForm key={lesson.updatedAt} lesson={lesson} canWrite={canWrite} />
      ) : lesson.type === 'live' ? (
        <LiveContentForm key={lesson.updatedAt} lesson={lesson} canWrite={canWrite} />
      ) : lesson.type === 'resource' ? (
        <ResourceContentForm key={lesson.updatedAt} lesson={lesson} canWrite={canWrite} onGoAttachments={() => setSection('attachments')} />
      ) : (
        <EmptyState icon={<PlayCircle className="size-5" aria-hidden />} title="Video lessons use the Video section" description="Upload a file or link an external video there." action={<Button size="sm" variant="secondary" onClick={() => setSection('video')}>Open video</Button>} />
      );
  } else if (section === 'video') body = <LessonVideoPanel lesson={lesson} />;
  else if (section === 'attachments') body = <LessonAttachmentsPanel lesson={lesson} />;
  else if (section === 'publishing') body = <PublishingPanel lesson={lesson} topics={topics} onArchived={onArchived} onSelect={onSelect} />;
  else body = <PreviewPanel lesson={lesson} />;

  return (
    <div className="min-w-0">
      <header className="border-b border-line px-4 py-4 sm:px-5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
          <span className={cn('inline-flex items-center gap-1 font-medium', meta.tone)}>
            <meta.icon className="size-3.5" aria-hidden />
            {meta.label}
          </span>
          <span aria-hidden>·</span>
          <span className="truncate">{topic?.title ?? 'Topic'}</span>
          {lesson.durationSeconds ? (
            <>
              <span aria-hidden>·</span>
              <span>{formatClock(lesson.durationSeconds)}</span>
            </>
          ) : null}
          {lesson.isPreview ? <span className="rounded bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">PREVIEW</span> : null}
        </p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-lg font-semibold tracking-tight text-ink">{lesson.title}</h3>
          <LessonStatusBadge status={lesson.status} />
        </div>
      </header>
      <nav aria-label="Lesson editor sections" className="flex gap-1 overflow-x-auto border-b border-line px-2 [scrollbar-width:none] sm:px-3">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            aria-current={section === s.id ? 'page' : undefined}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-[13px] transition-colors',
              section === s.id ? 'border-primary font-semibold text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            )}
          >
            <s.icon className="size-3.5" aria-hidden />
            {s.label}
          </button>
        ))}
      </nav>
      <div className="px-4 py-5 sm:px-5">{body}</div>
    </div>
  );
}
