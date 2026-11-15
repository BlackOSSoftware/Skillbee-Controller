'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { CourseTopic } from '@/types/courses';
import { LESSON_TYPES, type AdminLesson, type LessonType, type TopicInput, type TopicStatus } from '@/types/curriculum';
import { Toggle } from '@/features/courses/components/form-controls';
import { useCreateLesson, useCreateTopic, useUpdateTopic } from '../hooks';
import { fromLocalInput, LESSON_TYPE_META, toLocalInput } from '../display';

/** Create or edit a topic (`createTopicSchema` / `updateTopicSchema`). */
export function TopicDialog({ courseId, topic, onClose }: { courseId: string; topic?: CourseTopic; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateTopic(courseId);
  const update = useUpdateTopic(courseId);
  const inFlight = useRef(false);
  const [title, setTitle] = useState(topic?.title ?? '');
  const [description, setDescription] = useState(topic?.description ?? '');
  const [status, setStatus] = useState<TopicStatus>(topic?.status ?? 'draft');
  const [scheduled, setScheduled] = useState(topic?.availabilityType === 'scheduled');
  const [availableAt, setAvailableAt] = useState(toLocalInput(topic?.availableAt));
  const [isRequired, setIsRequired] = useState(topic?.isRequired ?? true);
  const [errors, setErrors] = useState<{ title?: string; description?: string; availableAt?: string }>({});
  const pending = create.isPending || update.isPending;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    const found: typeof errors = {};
    if (title.trim().length < 3 || title.trim().length > 200) found.title = 'Title must be 3–200 characters.';
    if (description.length > 5000) found.description = '5,000 characters or less.';
    if (scheduled && !availableAt) found.availableAt = 'Choose when the topic unlocks.';
    setErrors(found);
    if (Object.keys(found).length) return;
    const input: TopicInput & { title: string } = {
      title: title.trim(),
      description: description.trim(),
      status,
      isRequired,
      availabilityType: scheduled ? 'scheduled' : 'immediate',
      availableAt: scheduled ? fromLocalInput(availableAt) : null,
    };
    inFlight.current = true;
    const handlers = {
      onSuccess: () => {
        toast.success(topic ? 'Topic updated' : 'Topic added', input.title);
        onClose();
      },
      onError: (error: unknown) => toast.error('Could not save topic', normalizeApiError(error).message),
      onSettled: () => {
        inFlight.current = false;
      },
    };
    if (topic) update.mutate({ id: topic.id, input }, handlers);
    else create.mutate(input, handlers);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={pending}
      size="md"
      title={topic ? 'Edit topic' : 'Add topic'}
      description={topic ? topic.title : 'Topics group lessons; new topics are added at the end.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="topic-form" loading={pending}>
            {topic ? 'Save topic' : 'Add topic'}
          </Button>
        </>
      }
    >
      <form id="topic-form" onSubmit={submit} noValidate className="space-y-4">
        <Field id="tp-title" label="Title" required error={errors.title}>
          <Input id="tp-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={220} aria-invalid={Boolean(errors.title)} aria-describedby="tp-title-msg" />
        </Field>
        <Field id="tp-description" label="Description" error={errors.description}>
          <Textarea id="tp-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} aria-describedby="tp-description-msg" />
        </Field>
        <Field id="tp-status" label="Status" hint="Learners only see published topics.">
          <Select id="tp-status" value={status} onChange={(e) => setStatus(e.target.value as TopicStatus)} aria-describedby="tp-status-msg">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </Select>
        </Field>
        <Toggle id="tp-required" label="Required for completion" checked={isRequired} onChange={setIsRequired} />
        <Toggle id="tp-scheduled" label="Unlock on a date" description="Learners see the topic locked until then." checked={scheduled} onChange={setScheduled} />
        {scheduled ? (
          <Field id="tp-availableAt" label="Unlocks at" required error={errors.availableAt}>
            <Input id="tp-availableAt" type="datetime-local" value={availableAt} onChange={(e) => setAvailableAt(e.target.value)} aria-invalid={Boolean(errors.availableAt)} aria-describedby="tp-availableAt-msg" />
          </Field>
        ) : null}
      </form>
    </Dialog>
  );
}

/** POST /admin/topics/:topicId/lessons — the lesson opens in the editor once created. */
export function NewLessonDialog({ courseId, topic, onClose, onCreated }: { courseId: string; topic: CourseTopic; onClose: () => void; onCreated: (lesson: AdminLesson) => void }) {
  const toast = useToast();
  const create = useCreateLesson(courseId);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<LessonType>('video');
  const [error, setError] = useState<string>();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (create.isPending) return;
    if (title.trim().length < 3 || title.trim().length > 200) {
      setError('Title must be 3–200 characters.');
      return;
    }
    create.mutate(
      { topicId: topic.id, input: { title: title.trim(), type } },
      {
        onSuccess: (lesson) => {
          toast.success('Lesson created', 'Saved as a draft. Add content, then publish.');
          onCreated(lesson);
        },
        onError: (err) => toast.error('Could not create lesson', normalizeApiError(err).message),
      }
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={create.isPending}
      size="md"
      title="Add lesson"
      description={`In “${topic.title}”`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="lesson-create-form" loading={create.isPending}>
            Create lesson
          </Button>
        </>
      }
    >
      <form id="lesson-create-form" onSubmit={submit} noValidate className="space-y-4">
        <Field id="nl-title" label="Title" required error={error}>
          <Input
            id="nl-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(undefined);
            }}
            maxLength={220}
            aria-invalid={Boolean(error)}
            aria-describedby="nl-title-msg"
          />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-ink">Lesson type</legend>
          <div className="grid grid-cols-2 gap-2">
            {LESSON_TYPES.map((t) => {
              const meta = LESSON_TYPE_META[t];
              const Icon = meta.icon;
              return (
                <label key={t} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${type === t ? 'border-primary/50 bg-primary/[0.06] text-ink' : 'border-line text-ink-muted hover:border-field-border-hover'}`}>
                  <input type="radio" name="nl-type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                  <Icon className={`size-4 ${meta.tone}`} aria-hidden />
                  {meta.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
