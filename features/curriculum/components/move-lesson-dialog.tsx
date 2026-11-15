'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/input';
import { normalizeApiError } from '@/lib/api-error';
import { useToast } from '@/providers/toast-provider';
import type { CourseTopic } from '@/types/courses';
import type { AdminLesson } from '@/types/curriculum';
import { useMoveLesson } from '../hooks';

/** Topics come from this course's outline only, so cross-course moves cannot be requested. */
export function MoveLessonDialog({ lesson, topics, onClose }: { lesson: AdminLesson; topics: CourseTopic[]; onClose: () => void }) {
  const toast = useToast();
  const move = useMoveLesson();
  const targets = topics.filter((t) => t.status !== 'archived');
  const [topicId, setTopicId] = useState(lesson.topicId);
  const target = targets.find((t) => t.id === topicId);
  // Every non-removed lesson counts toward position, because the reorder call must list them all
  const siblings = target?.lessons ?? [];
  const others = siblings.filter((l) => l.id !== lesson.id);
  const currentIndex = siblings.findIndex((l) => l.id === lesson.id);
  const [position, setPosition] = useState(currentIndex >= 0 ? currentIndex : others.length);

  function changeTopic(id: string) {
    setTopicId(id);
    const t = targets.find((x) => x.id === id);
    const list = (t?.lessons ?? []).filter((l) => l.id !== lesson.id);
    setPosition(id === lesson.topicId ? Math.max(0, currentIndex) : list.length);
  }

  function submit() {
    if (!target) return;
    move.mutate(
      { lesson, targetTopicId: target.id, position, targetOrder: (target.lessons ?? []).map((l) => l.id) },
      {
        onSuccess: () => {
          toast.success('Lesson moved', `${target.title} · position ${position + 1}`);
          onClose();
        },
        onError: (error) => toast.error('Could not move lesson', normalizeApiError(error).message),
      }
    );
  }

  const unchanged = topicId === lesson.topicId && position === currentIndex;

  return (
    <Dialog
      open
      onClose={onClose}
      busy={move.isPending}
      size="md"
      title="Move lesson"
      description="Lessons can move between topics of this course only."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={move.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={move.isPending} disabled={unchanged || !target}>
            Move lesson
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="mv-topic" label="Topic">
          <Select id="mv-topic" value={topicId} onChange={(e) => changeTopic(e.target.value)}>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
                {t.id === lesson.topicId ? ' (current)' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="mv-position" label="Position">
          <Select id="mv-position" value={position} onChange={(e) => setPosition(Number(e.target.value))}>
            {Array.from({ length: others.length + 1 }).map((_, i) => (
              <option key={i} value={i}>
                {i === 0 ? 'First' : `After “${others[i - 1].title}”`}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}
