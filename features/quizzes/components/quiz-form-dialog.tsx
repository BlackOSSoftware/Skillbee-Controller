'use client';

import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { hasPermissions } from '@/lib/roles';
import { useToast } from '@/providers/toast-provider';
import { SHOW_RESULTS_OPTIONS, type CreateQuizInput, type Quiz, type QuizShowResults, type UpdateQuizInput } from '@/types/quizzes';
import { Toggle } from '@/features/courses/components/form-controls';
import { useCourseOptions } from '@/features/enrollments/hooks';
import { useCreateQuiz, useUpdateQuiz } from '../hooks';
import { showResultsLabel } from '../display';

interface Values {
  title: string;
  description: string;
  instructions: string;
  courseId: string;
  timeLimitMinutes: string;
  passingPercentage: string;
  unlimitedAttempts: boolean;
  maximumAttempts: string;
  showResults: QuizShowResults;
  showCorrectAnswers: boolean;
  showExplanation: boolean;
  randomizeQuestions: boolean;
  randomizeAnswers: boolean;
  negativeMarkingEnabled: boolean;
  negativeMarksPerWrongAnswer: string;
  allowResume: boolean;
  allowBackNavigation: boolean;
  requireAllQuestions: boolean;
  allowPartialCreditMultiSelect: boolean;
  randomCount: boolean;
  questionsToSelect: string;
  tags: string;
  availabilityEnabled: boolean;
  startsAt: string;
  endsAt: string;
}

type Errors = Partial<Record<keyof Values, string>>;

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Defaults match the Quiz model so an untouched form creates the same quiz as the API would. */
function initialValues(q?: Quiz): Values {
  return {
    title: q?.title ?? '',
    description: q?.description ?? '',
    instructions: q?.instructions ?? '',
    courseId: q?.courseId ?? '',
    timeLimitMinutes: q ? String(Math.round((q.timeLimitSeconds / 60) * 100) / 100) : '0',
    passingPercentage: String(q?.passingPercentage ?? 50),
    unlimitedAttempts: q ? q.unlimitedAttempts : false,
    maximumAttempts: String(q?.maximumAttempts || 1),
    showResults: q?.showResults ?? 'after_submission',
    showCorrectAnswers: q?.showCorrectAnswers ?? false,
    showExplanation: q?.showExplanation ?? false,
    randomizeQuestions: q?.randomizeQuestions ?? false,
    randomizeAnswers: q?.randomizeAnswers ?? false,
    negativeMarkingEnabled: q?.negativeMarkingEnabled ?? false,
    negativeMarksPerWrongAnswer: String(q?.negativeMarksPerWrongAnswer ?? 0),
    allowResume: q?.allowResume ?? true,
    allowBackNavigation: q?.allowBackNavigation ?? true,
    requireAllQuestions: q?.requireAllQuestions ?? false,
    allowPartialCreditMultiSelect: q?.allowPartialCreditMultiSelect ?? false,
    randomCount: q?.questionSelectionMode === 'random_count',
    questionsToSelect: String(q?.questionsToSelect ?? 10),
    tags: (q?.tags ?? []).join(', '),
    availabilityEnabled: Boolean(q?.availability?.enabled),
    startsAt: toLocalInput(q?.availability?.startsAt),
    endsAt: toLocalInput(q?.availability?.endsAt),
  };
}

function parseTags(raw: string): string[] {
  return [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))];
}

/** Mirrors `createQuizSchema` and the service-level checks in quiz.service.js. */
function validate(v: Values, mode: 'create' | 'edit'): Errors {
  const e: Errors = {};
  const title = v.title.trim();
  if (title.length < 3 || title.length > 200) e.title = 'Title must be 3–200 characters.';
  if (mode === 'create' && !v.courseId) e.courseId = 'Choose a course.';
  if (v.description.length > 5000) e.description = '5,000 characters or less.';
  if (v.instructions.length > 10000) e.instructions = '10,000 characters or less.';
  const minutes = Number(v.timeLimitMinutes);
  if (!Number.isFinite(minutes) || minutes < 0) e.timeLimitMinutes = 'Enter 0 (no limit) or more.';
  const pass = Number(v.passingPercentage);
  if (v.passingPercentage.trim() === '' || !Number.isFinite(pass) || pass < 0 || pass > 100) e.passingPercentage = 'Between 0 and 100.';
  if (!v.unlimitedAttempts) {
    const n = Number(v.maximumAttempts);
    if (!Number.isInteger(n) || n < 1) e.maximumAttempts = 'Whole number, 1 or more.';
  }
  if (v.negativeMarkingEnabled) {
    const n = Number(v.negativeMarksPerWrongAnswer);
    if (!Number.isFinite(n) || n < 0) e.negativeMarksPerWrongAnswer = 'Enter 0 or more.';
  }
  if (v.randomCount) {
    const n = Number(v.questionsToSelect);
    if (!Number.isInteger(n) || n < 1) e.questionsToSelect = 'Whole number, 1 or more.';
  }
  const tags = parseTags(v.tags);
  if (tags.length > 30) e.tags = 'Up to 30 tags.';
  else if (tags.some((t) => t.length > 50)) e.tags = 'Each tag must be 50 characters or less.';
  if (v.availabilityEnabled && v.startsAt && v.endsAt && new Date(v.startsAt) >= new Date(v.endsAt)) e.endsAt = 'Must be after the start.';
  return e;
}

function toInput(v: Values): CreateQuizInput {
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    instructions: v.instructions.trim(),
    courseId: v.courseId,
    timeLimitSeconds: Math.round(Number(v.timeLimitMinutes) * 60),
    passingPercentage: Number(v.passingPercentage),
    maximumAttempts: v.unlimitedAttempts ? null : Number(v.maximumAttempts),
    showResults: v.showResults,
    showCorrectAnswers: v.showCorrectAnswers,
    showExplanation: v.showExplanation,
    randomizeQuestions: v.randomizeQuestions,
    randomizeAnswers: v.randomizeAnswers,
    negativeMarkingEnabled: v.negativeMarkingEnabled,
    negativeMarksPerWrongAnswer: v.negativeMarkingEnabled ? Number(v.negativeMarksPerWrongAnswer) : 0,
    allowResume: v.allowResume,
    allowBackNavigation: v.allowBackNavigation,
    requireAllQuestions: v.requireAllQuestions,
    allowPartialCreditMultiSelect: v.allowPartialCreditMultiSelect,
    questionSelectionMode: v.randomCount ? 'random_count' : 'all',
    questionsToSelect: v.randomCount ? Number(v.questionsToSelect) : null,
    tags: parseTags(v.tags),
    availability: {
      enabled: v.availabilityEnabled,
      startsAt: v.availabilityEnabled && v.startsAt ? new Date(v.startsAt).toISOString() : null,
      endsAt: v.availabilityEnabled && v.endsAt ? new Date(v.endsAt).toISOString() : null,
    },
  };
}

/** PATCH only what changed. */
function diff(q: Quiz, next: CreateQuizInput): UpdateQuizInput {
  const current: UpdateQuizInput = {
    title: q.title,
    description: q.description,
    instructions: q.instructions,
    timeLimitSeconds: q.timeLimitSeconds,
    passingPercentage: q.passingPercentage,
    maximumAttempts: q.unlimitedAttempts ? null : q.maximumAttempts,
    showResults: q.showResults,
    showCorrectAnswers: q.showCorrectAnswers,
    showExplanation: q.showExplanation,
    randomizeQuestions: q.randomizeQuestions,
    randomizeAnswers: q.randomizeAnswers,
    negativeMarkingEnabled: q.negativeMarkingEnabled,
    negativeMarksPerWrongAnswer: q.negativeMarkingEnabled ? q.negativeMarksPerWrongAnswer : 0,
    allowResume: q.allowResume,
    allowBackNavigation: q.allowBackNavigation,
    requireAllQuestions: q.requireAllQuestions,
    allowPartialCreditMultiSelect: q.allowPartialCreditMultiSelect,
    questionSelectionMode: q.questionSelectionMode,
    questionsToSelect: q.questionSelectionMode === 'random_count' ? q.questionsToSelect : null,
    tags: q.tags,
    availability: {
      enabled: Boolean(q.availability?.enabled),
      startsAt: q.availability?.enabled && q.availability.startsAt ? new Date(q.availability.startsAt).toISOString() : null,
      endsAt: q.availability?.enabled && q.availability.endsAt ? new Date(q.availability.endsAt).toISOString() : null,
    },
  };
  const out: UpdateQuizInput = {};
  const { courseId: _course, ...rest } = next;
  void _course;
  for (const key of Object.keys(rest) as Array<keyof UpdateQuizInput>) {
    if (JSON.stringify(rest[key]) !== JSON.stringify(current[key])) Object.assign(out, { [key]: rest[key] });
  }
  return out;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{title}</h3>
      {children}
    </section>
  );
}

interface QuizFormDialogProps {
  mode: 'create' | 'edit';
  quiz?: Quiz;
  onClose: () => void;
  onSaved: (quiz: Quiz) => void;
}

export function QuizFormDialog({ mode, quiz, onClose, onSaved }: QuizFormDialogProps) {
  const { user } = useAuth();
  const toast = useToast();
  const create = useCreateQuiz();
  const update = useUpdateQuiz();
  const inFlight = useRef(false);
  const [values, setValues] = useState<Values>(() => initialValues(quiz));
  const [errors, setErrors] = useState<Errors>({});
  const courses = useCourseOptions('', mode === 'create' && hasPermissions(user, ['courses.read']), 100);
  const pending = create.isPending || update.isPending;

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    const found = validate(values, mode);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`qf-${first}`)?.focus();
      return;
    }
    const input = toInput(values);
    const onError = (error: unknown) => {
      const { message, fieldErrors } = normalizeApiError(error);
      const mapped: Errors = {};
      for (const issue of fieldErrors) {
        const key = issue.path.split('.')[0] as keyof Values;
        if (key in values) mapped[key] = issue.message;
      }
      setErrors(mapped);
      toast.error(mode === 'create' ? 'Could not create quiz' : 'Could not save quiz', message);
    };
    const settle = () => {
      inFlight.current = false;
    };
    inFlight.current = true;
    if (mode === 'create') {
      create.mutate(input, {
        onSuccess: (q) => {
          toast.success('Quiz created', 'Saved as a draft. Add questions, then publish.');
          onSaved(q);
        },
        onError,
        onSettled: settle,
      });
      return;
    }
    if (!quiz) return settle();
    const changes = diff(quiz, input);
    if (!Object.keys(changes).length) {
      settle();
      toast.notify({ tone: 'info', title: 'No changes to save' });
      onClose();
      return;
    }
    update.mutate(
      { id: quiz.id, input: changes },
      {
        onSuccess: (q) => {
          toast.success('Quiz updated', q.title);
          onSaved(q);
        },
        onError,
        onSettled: settle,
      }
    );
  }

  const num = (key: keyof Values, label: string, props: { min?: number; max?: number; step?: string | number; hint?: string; required?: boolean; className?: string }) => (
    <Field id={`qf-${key}`} label={label} required={props.required} error={errors[key]} hint={props.hint}>
      <Input
        id={`qf-${key}`}
        type="number"
        min={props.min}
        max={props.max}
        step={props.step ?? 'any'}
        value={values[key] as string}
        onChange={(e) => set(key, e.target.value as Values[typeof key])}
        className={props.className}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={`qf-${key}-msg`}
      />
    </Field>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      busy={pending}
      size="lg"
      title={mode === 'create' ? 'New quiz' : 'Quiz settings'}
      description={mode === 'create' ? 'New quizzes are saved as drafts.' : quiz?.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="quiz-form" loading={pending}>
            {mode === 'create' ? 'Create quiz' : 'Save settings'}
          </Button>
        </>
      }
    >
      <form id="quiz-form" onSubmit={submit} noValidate className="space-y-7">
        <Section title="Basics">
          <Field id="qf-title" label="Title" required error={errors.title} hint={`${values.title.trim().length}/200`}>
            <Input id="qf-title" value={values.title} onChange={(e) => set('title', e.target.value)} maxLength={220} placeholder="e.g. GMP fundamentals check" aria-invalid={Boolean(errors.title)} aria-describedby="qf-title-msg" />
          </Field>
          {mode === 'create' ? (
            <Field id="qf-courseId" label="Course" required error={errors.courseId}>
              <Select id="qf-courseId" value={values.courseId} onChange={(e) => set('courseId', e.target.value)} disabled={courses.isPending} aria-invalid={Boolean(errors.courseId)} aria-describedby="qf-courseId-msg">
                <option value="">{courses.isPending ? 'Loading courses…' : 'Choose a course'}</option>
                {(courses.data?.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field id="qf-description" label="Description" error={errors.description}>
            <Textarea id="qf-description" rows={2} value={values.description} onChange={(e) => set('description', e.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby="qf-description-msg" />
          </Field>
          <Field id="qf-instructions" label="Instructions for learners" error={errors.instructions}>
            <Textarea id="qf-instructions" rows={3} value={values.instructions} onChange={(e) => set('instructions', e.target.value)} aria-invalid={Boolean(errors.instructions)} aria-describedby="qf-instructions-msg" />
          </Field>
          <Field id="qf-tags" label="Tags" error={errors.tags} hint="Comma separated">
            <Input id="qf-tags" value={values.tags} onChange={(e) => set('tags', e.target.value)} placeholder="gmp, basics" aria-invalid={Boolean(errors.tags)} aria-describedby="qf-tags-msg" />
          </Field>
        </Section>

        <Section title="Scoring & attempts">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {num('passingPercentage', 'Pass mark (%)', { min: 0, max: 100, required: true })}
            {num('timeLimitMinutes', 'Time limit (minutes)', { min: 0, hint: '0 means no time limit' })}
          </div>
          <Toggle id="qf-unlimited" label="Unlimited attempts" checked={values.unlimitedAttempts} onChange={(v) => set('unlimitedAttempts', v)} />
          {!values.unlimitedAttempts ? num('maximumAttempts', 'Attempts allowed', { min: 1, step: 1, required: true, className: 'w-32' }) : null}
          <Toggle id="qf-negative" label="Negative marking" description="Deduct marks for wrong answers (questions can override)." checked={values.negativeMarkingEnabled} onChange={(v) => set('negativeMarkingEnabled', v)} />
          {values.negativeMarkingEnabled ? num('negativeMarksPerWrongAnswer', 'Marks deducted per wrong answer', { min: 0, className: 'w-32' }) : null}
          <Toggle id="qf-partial" label="Partial credit on multi-select" checked={values.allowPartialCreditMultiSelect} onChange={(v) => set('allowPartialCreditMultiSelect', v)} />
        </Section>

        <Section title="Questions & delivery">
          <Toggle id="qf-random-count" label="Draw a random subset" description="Each attempt gets a random selection instead of every question." checked={values.randomCount} onChange={(v) => set('randomCount', v)} />
          {values.randomCount ? num('questionsToSelect', 'Questions per attempt', { min: 1, step: 1, required: true, className: 'w-32' }) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Toggle id="qf-rq" label="Shuffle questions" checked={values.randomizeQuestions} onChange={(v) => set('randomizeQuestions', v)} />
            <Toggle id="qf-ra" label="Shuffle answers" checked={values.randomizeAnswers} onChange={(v) => set('randomizeAnswers', v)} />
            <Toggle id="qf-resume" label="Allow resume" checked={values.allowResume} onChange={(v) => set('allowResume', v)} />
            <Toggle id="qf-back" label="Allow back navigation" checked={values.allowBackNavigation} onChange={(v) => set('allowBackNavigation', v)} />
          </div>
          <Toggle id="qf-required" label="Require every required question" description="Learners cannot submit until required questions are answered." checked={values.requireAllQuestions} onChange={(v) => set('requireAllQuestions', v)} />
        </Section>

        <Section title="Results">
          <Field id="qf-showResults" label="Show results">
            <Select id="qf-showResults" value={values.showResults} onChange={(e) => set('showResults', e.target.value as QuizShowResults)}>
              {SHOW_RESULTS_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {showResultsLabel(o)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Toggle id="qf-correct" label="Show correct answers" checked={values.showCorrectAnswers} onChange={(v) => set('showCorrectAnswers', v)} />
            <Toggle id="qf-explain" label="Show explanations" checked={values.showExplanation} onChange={(v) => set('showExplanation', v)} />
          </div>
        </Section>

        <Section title="Availability">
          <Toggle id="qf-availability" label="Limit when learners can start" checked={values.availabilityEnabled} onChange={(v) => set('availabilityEnabled', v)} />
          {values.availabilityEnabled ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="qf-startsAt" label="Opens" error={errors.startsAt}>
                <Input id="qf-startsAt" type="datetime-local" value={values.startsAt} onChange={(e) => set('startsAt', e.target.value)} aria-describedby="qf-startsAt-msg" />
              </Field>
              <Field id="qf-endsAt" label="Closes" error={errors.endsAt}>
                <Input id="qf-endsAt" type="datetime-local" value={values.endsAt} onChange={(e) => set('endsAt', e.target.value)} aria-invalid={Boolean(errors.endsAt)} aria-describedby="qf-endsAt-msg" />
              </Field>
            </div>
          ) : null}
        </Section>
      </form>
    </Dialog>
  );
}
