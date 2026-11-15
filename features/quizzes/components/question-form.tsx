'use client';

import type { ReactNode } from 'react';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { DIFFICULTIES, QUESTION_TYPES, type AnswerMatchingMode, type BankQuestion, type Difficulty, type QuestionInput, type QuestionType } from '@/types/quizzes';
import { ListEditor } from '@/features/courses/components/form-controls';
import { difficultyLabel, formatMarks, questionTypeLabel } from '../display';

/** Option and blank ids are client-chosen so `correctOptionIds` can reference them in the same request. */
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

interface OptionRow {
  id: string;
  text: string;
  correct: boolean;
}
interface RubricRow {
  criterion: string;
  maximumMarks: string;
  description: string;
}
interface BlankRow {
  id: string;
  accepted: string;
  marks: string;
  caseSensitive: boolean;
}

export interface QuestionValues {
  questionType: QuestionType;
  questionText: string;
  description: string;
  marks: string;
  negativeMarks: string;
  difficulty: Difficulty;
  explanation: string;
  tags: string;
  options: OptionRow[];
  correctAnswer: boolean | null;
  acceptedAnswers: string;
  answerMatchingMode: AnswerMatchingMode;
  rubric: RubricRow[];
  blanks: BlankRow[];
}

export type QuestionErrors = Record<string, string>;

/** Content shared by quiz questions and bank items (`marks` is the bank's `defaultMarks`). */
export type QuestionSource = Pick<
  BankQuestion,
  | 'questionType'
  | 'questionText'
  | 'description'
  | 'negativeMarks'
  | 'difficulty'
  | 'explanation'
  | 'tags'
  | 'options'
  | 'correctOptionIds'
  | 'correctAnswer'
  | 'acceptedAnswers'
  | 'answerMatchingMode'
  | 'gradingRubric'
  | 'blanks'
> & { marks: number };

/** `createQuestionSchema` content fields; quiz-only flags such as `isRequired` are added by the caller. */
export type QuestionPayload = Omit<QuestionInput, 'isRequired'>;

const MATCHING: Array<{ value: AnswerMatchingMode; label: string }> = [
  { value: 'case_insensitive', label: 'Ignore case' },
  { value: 'normalized', label: 'Ignore case and extra spaces' },
  { value: 'exact', label: 'Exact match' },
];

export function initialQuestionValues(q?: QuestionSource): QuestionValues {
  const options = q?.options?.length
    ? [...q.options].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((o) => ({ id: o.id, text: o.text, correct: q.correctOptionIds.includes(o.id) }))
    : [
        { id: newId('opt'), text: '', correct: true },
        { id: newId('opt'), text: '', correct: false },
      ];
  return {
    questionType: q?.questionType ?? 'multiple_choice',
    questionText: q?.questionText ?? '',
    description: q?.description ?? '',
    marks: String(q?.marks ?? 1),
    negativeMarks: String(q?.negativeMarks ?? 0),
    difficulty: q?.difficulty ?? 'medium',
    explanation: q?.explanation ?? '',
    tags: (q?.tags ?? []).join(', '),
    options,
    correctAnswer: typeof q?.correctAnswer === 'boolean' ? q.correctAnswer : null,
    acceptedAnswers: (q?.acceptedAnswers ?? []).join('\n'),
    answerMatchingMode: q?.answerMatchingMode ?? 'case_insensitive',
    rubric: (q?.gradingRubric ?? []).map((r) => ({ criterion: r.criterion, maximumMarks: String(r.maximumMarks), description: r.description ?? '' })),
    blanks: q?.blanks?.length
      ? q.blanks.map((b) => ({ id: b.id, accepted: (b.acceptedAnswers ?? []).join(', '), marks: String(b.marks), caseSensitive: Boolean(b.caseSensitive) }))
      : [{ id: newId('blank'), accepted: '', marks: '1', caseSensitive: false }],
  };
}

const lines = (raw: string, sep: RegExp) => raw.split(sep).map((s) => s.trim()).filter(Boolean);
const blankSum = (v: QuestionValues) => v.blanks.reduce((s, b) => s + (Number(b.marks) || 0), 0);

/** Mirrors `createQuestionSchema` and `validateQuestionPayload`. */
export function validateQuestion(v: QuestionValues): QuestionErrors {
  const e: QuestionErrors = {};
  if (!v.questionText.trim()) e.questionText = 'Enter the question.';
  else if (v.questionText.length > 5000) e.questionText = '5,000 characters or less.';
  if (v.description.length > 5000) e.description = '5,000 characters or less.';
  if (v.explanation.length > 5000) e.explanation = '5,000 characters or less.';
  const marks = v.questionType === 'fill_in_the_blanks' ? blankSum(v) : Number(v.marks);
  if (!Number.isFinite(marks) || marks < 0) e.marks = 'Enter 0 or more.';
  const neg = Number(v.negativeMarks);
  if (!Number.isFinite(neg) || neg < 0) e.negativeMarks = 'Enter 0 or more.';
  const tags = lines(v.tags, /,/);
  if (tags.length > 30 || tags.some((t) => t.length > 50)) e.tags = 'Up to 30 tags, 50 characters each.';

  if (v.questionType === 'multiple_choice' || v.questionType === 'multiple_select') {
    if (v.options.length < 2) e.options = 'Add at least two options.';
    else if (v.options.some((o) => !o.text.trim() || o.text.length > 2000)) e.options = 'Every option needs text (up to 2,000 characters).';
    else {
      const correct = v.options.filter((o) => o.correct).length;
      if (v.questionType === 'multiple_choice' && correct !== 1) e.options = 'Mark exactly one correct option.';
      if (v.questionType === 'multiple_select' && correct < 1) e.options = 'Mark at least one correct option.';
    }
  }
  if (v.questionType === 'true_false' && v.correctAnswer === null) e.correctAnswer = 'Choose the correct answer.';
  if (v.questionType === 'short_answer') {
    const accepted = lines(v.acceptedAnswers, /\n/);
    if (!accepted.length) e.acceptedAnswers = 'Add at least one accepted answer.';
    else if (accepted.some((a) => a.length > 500)) e.acceptedAnswers = 'Each answer must be 500 characters or less.';
  }
  if (v.questionType === 'long_answer') {
    if (v.rubric.some((r) => !r.criterion.trim() || r.criterion.length > 500)) e.rubric = 'Every criterion needs a name (up to 500 characters).';
    else if (v.rubric.some((r) => !Number.isFinite(Number(r.maximumMarks)) || Number(r.maximumMarks) < 0)) e.rubric = 'Criterion marks must be 0 or more.';
    else if (v.rubric.reduce((s, r) => s + Number(r.maximumMarks), 0) > marks) e.rubric = 'Rubric marks cannot exceed the question marks.';
  }
  if (v.questionType === 'fill_in_the_blanks') {
    if (!v.blanks.length) e.blanks = 'Add at least one blank.';
    else if (v.blanks.some((b) => !lines(b.accepted, /,/).length)) e.blanks = 'Each blank needs at least one accepted answer.';
    else if (v.blanks.some((b) => !Number.isFinite(Number(b.marks)) || Number(b.marks) < 0)) e.blanks = 'Blank marks must be 0 or more.';
  }
  return e;
}

export function toQuestionPayload(v: QuestionValues): QuestionPayload {
  const base: QuestionPayload = {
    questionText: v.questionText.trim(),
    questionType: v.questionType,
    description: v.description.trim(),
    marks: v.questionType === 'fill_in_the_blanks' ? blankSum(v) : Number(v.marks),
    negativeMarks: Number(v.negativeMarks) || 0,
    explanation: v.explanation.trim(),
    difficulty: v.difficulty,
    tags: lines(v.tags, /,/),
  };
  switch (v.questionType) {
    case 'multiple_choice':
    case 'multiple_select':
      return { ...base, options: v.options.map((o, i) => ({ id: o.id, text: o.text.trim(), sortOrder: i })), correctOptionIds: v.options.filter((o) => o.correct).map((o) => o.id) };
    case 'true_false':
      return { ...base, correctAnswer: Boolean(v.correctAnswer) };
    case 'short_answer':
      return { ...base, acceptedAnswers: lines(v.acceptedAnswers, /\n/), answerMatchingMode: v.answerMatchingMode };
    case 'long_answer':
      return {
        ...base,
        gradingRubric: v.rubric.map((r) => ({ criterion: r.criterion.trim(), maximumMarks: Number(r.maximumMarks), ...(r.description.trim() ? { description: r.description.trim() } : {}) })),
      };
    case 'fill_in_the_blanks':
      return { ...base, blanks: v.blanks.map((b) => ({ id: b.id, acceptedAnswers: lines(b.accepted, /,/), caseSensitive: b.caseSensitive, marks: Number(b.marks) })) };
  }
}

/**
 * The backend keeps answer-key fields it is sent and merges PATCH bodies with stored values, so a
 * type change must clear the previous type's key explicitly.
 */
export const EMPTY_ANSWER_KEY = { options: [], correctOptionIds: [], acceptedAnswers: [], gradingRubric: [], blanks: [] } satisfies Partial<QuestionPayload>;

interface QuestionFormFieldsProps {
  idPrefix: string;
  values: QuestionValues;
  errors: QuestionErrors;
  onChange: <K extends keyof QuestionValues>(key: K, value: QuestionValues[K]) => void;
  marksLabel?: string;
  /** Third cell of the marks row (quiz: Required toggle, bank: category). */
  aside?: ReactNode;
}

export function QuestionFormFields({ idPrefix: p, values: v, errors, onChange: set, marksLabel = 'Marks', aside }: QuestionFormFieldsProps) {
  const choice = v.questionType === 'multiple_choice' || v.questionType === 'multiple_select';
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id={`${p}-type`} label="Question type" required>
          <Select id={`${p}-type`} value={v.questionType} onChange={(e) => set('questionType', e.target.value as QuestionType)}>
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {questionTypeLabel(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${p}-difficulty`} label="Difficulty">
          <Select id={`${p}-difficulty`} value={v.difficulty} onChange={(e) => set('difficulty', e.target.value as Difficulty)}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {difficultyLabel(d)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id={`${p}-text`} label="Question" required error={errors.questionText} hint={v.questionType === 'fill_in_the_blanks' ? 'Mark each blank with _____ in the text.' : undefined}>
        <Textarea id={`${p}-text`} rows={3} value={v.questionText} onChange={(e) => set('questionText', e.target.value)} aria-invalid={Boolean(errors.questionText)} aria-describedby={`${p}-text-msg`} />
      </Field>
      <Field id={`${p}-description`} label="Supporting text" error={errors.description} hint="Optional context shown under the question">
        <Textarea id={`${p}-description`} rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} aria-describedby={`${p}-description-msg`} />
      </Field>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field id={`${p}-marks`} label={marksLabel} required error={errors.marks} hint={v.questionType === 'fill_in_the_blanks' ? 'Sum of blank marks' : undefined}>
          <Input
            id={`${p}-marks`}
            type="number"
            min={0}
            step="any"
            value={v.questionType === 'fill_in_the_blanks' ? String(blankSum(v)) : v.marks}
            onChange={(e) => set('marks', e.target.value)}
            readOnly={v.questionType === 'fill_in_the_blanks'}
            aria-invalid={Boolean(errors.marks)}
            aria-describedby={`${p}-marks-msg`}
          />
        </Field>
        <Field id={`${p}-negative`} label="Negative marks" error={errors.negativeMarks} hint="Applies when the quiz uses negative marking">
          <Input id={`${p}-negative`} type="number" min={0} step="any" value={v.negativeMarks} onChange={(e) => set('negativeMarks', e.target.value)} aria-describedby={`${p}-negative-msg`} />
        </Field>
        {aside ? <div className="col-span-2 sm:col-span-1">{aside}</div> : null}
      </div>

      <section className="rounded-lg border border-line bg-surface-2/40 p-3 sm:p-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Answer key</h3>
        {choice ? (
          <>
            <ListEditor
              label="option"
              rows={v.options}
              onChange={(rows) => set('options', rows)}
              createRow={() => ({ id: newId('opt'), text: '', correct: false })}
              max={20}
              addLabel="Add option"
              emptyText="No options yet."
              error={errors.options}
              renderRow={(row, i, upd) => (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role={v.questionType === 'multiple_choice' ? 'radio' : 'checkbox'}
                    aria-checked={row.correct}
                    aria-label={`Mark option ${i + 1} correct`}
                    onClick={() =>
                      v.questionType === 'multiple_choice'
                        ? set('options', v.options.map((o) => ({ ...o, correct: o.id === row.id })))
                        : upd({ ...row, correct: !row.correct })
                    }
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center border transition-colors',
                      v.questionType === 'multiple_choice' ? 'rounded-full' : 'rounded',
                      row.correct ? 'border-success bg-success text-white' : 'border-field-border bg-field hover:border-success'
                    )}
                  >
                    {row.correct ? <span className="text-[10px] font-bold">✓</span> : null}
                  </button>
                  <Input value={row.text} onChange={(e) => upd({ ...row, text: e.target.value })} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`} />
                </div>
              )}
            />
            <p className="mt-1 text-[11px] text-ink-subtle">{v.questionType === 'multiple_choice' ? 'Select the one correct option.' : 'Tick every correct option.'}</p>
          </>
        ) : v.questionType === 'true_false' ? (
          <div role="radiogroup" aria-label="Correct answer" className="grid grid-cols-2 gap-2">
            {[true, false].map((val) => (
              <button
                key={String(val)}
                type="button"
                role="radio"
                aria-checked={v.correctAnswer === val}
                onClick={() => set('correctAnswer', val)}
                className={cn('rounded-md border px-3 py-2 text-sm font-medium transition-colors', v.correctAnswer === val ? 'border-success bg-success/10 text-success' : 'border-line text-ink-muted hover:border-field-border-hover')}
              >
                {val ? 'True' : 'False'}
              </button>
            ))}
            {errors.correctAnswer ? <p className="col-span-2 text-xs text-danger">{errors.correctAnswer}</p> : null}
          </div>
        ) : v.questionType === 'short_answer' ? (
          <div className="space-y-3">
            <Field id={`${p}-accepted`} label="Accepted answers" required error={errors.acceptedAnswers} hint="One per line">
              <Textarea id={`${p}-accepted`} rows={3} value={v.acceptedAnswers} onChange={(e) => set('acceptedAnswers', e.target.value)} aria-invalid={Boolean(errors.acceptedAnswers)} aria-describedby={`${p}-accepted-msg`} />
            </Field>
            <Field id={`${p}-matching`} label="Matching">
              <Select id={`${p}-matching`} value={v.answerMatchingMode} onChange={(e) => set('answerMatchingMode', e.target.value as AnswerMatchingMode)}>
                {MATCHING.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : v.questionType === 'long_answer' ? (
          <>
            <p className="mb-2 text-xs text-ink-muted">Long answers are graded manually. A rubric is optional; its total cannot exceed {formatMarks(Number(v.marks) || 0)} marks.</p>
            <ListEditor
              label="criterion"
              rows={v.rubric}
              onChange={(rows) => set('rubric', rows)}
              createRow={() => ({ criterion: '', maximumMarks: '1', description: '' })}
              max={20}
              addLabel="Add criterion"
              emptyText="No rubric. Graders assign marks freely."
              error={errors.rubric}
              renderRow={(row, i, upd) => (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_90px]">
                  <Input value={row.criterion} onChange={(e) => upd({ ...row, criterion: e.target.value })} placeholder="Criterion" aria-label={`Criterion ${i + 1}`} />
                  <Input type="number" min={0} step="any" value={row.maximumMarks} onChange={(e) => upd({ ...row, maximumMarks: e.target.value })} aria-label={`Criterion ${i + 1} marks`} />
                  <Input className="sm:col-span-2" value={row.description} onChange={(e) => upd({ ...row, description: e.target.value })} placeholder="What earns these marks (optional)" aria-label={`Criterion ${i + 1} description`} />
                </div>
              )}
            />
          </>
        ) : (
          <ListEditor
            label="blank"
            rows={v.blanks}
            onChange={(rows) => set('blanks', rows)}
            createRow={() => ({ id: newId('blank'), accepted: '', marks: '1', caseSensitive: false })}
            max={20}
            addLabel="Add blank"
            emptyText="No blanks yet."
            error={errors.blanks}
            renderRow={(row, i, upd) => (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_80px]">
                <Input value={row.accepted} onChange={(e) => upd({ ...row, accepted: e.target.value })} placeholder="Accepted answers, comma separated" aria-label={`Blank ${i + 1} accepted answers`} />
                <Input type="number" min={0} step="any" value={row.marks} onChange={(e) => upd({ ...row, marks: e.target.value })} aria-label={`Blank ${i + 1} marks`} />
                <label className="flex items-center gap-2 text-xs text-ink-muted sm:col-span-2">
                  <input type="checkbox" checked={row.caseSensitive} onChange={(e) => upd({ ...row, caseSensitive: e.target.checked })} className="size-3.5 accent-[var(--primary)]" />
                  Case-sensitive
                </label>
              </div>
            )}
          />
        )}
      </section>

      <Field id={`${p}-explanation`} label="Explanation" error={errors.explanation} hint="Shown with results when the quiz allows it">
        <Textarea id={`${p}-explanation`} rows={2} value={v.explanation} onChange={(e) => set('explanation', e.target.value)} aria-describedby={`${p}-explanation-msg`} />
      </Field>
      <Field id={`${p}-tags`} label="Tags" error={errors.tags} hint="Comma separated">
        <Input id={`${p}-tags`} value={v.tags} onChange={(e) => set('tags', e.target.value)} aria-describedby={`${p}-tags-msg`} />
      </Field>
    </>
  );
}
