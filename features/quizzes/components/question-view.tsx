import { Check, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AnswerMatchingMode, AttemptQuestion, QuestionBlank, QuestionOption, QuestionType, RubricCriterion } from '@/types/quizzes';
import { formatMarks } from '../display';

export interface ViewableQuestion {
  questionType: QuestionType;
  options?: QuestionOption[];
  correctOptionIds?: string[];
  correctAnswer?: boolean | null;
  acceptedAnswers?: string[];
  answerMatchingMode?: AnswerMatchingMode;
  blanks?: QuestionBlank[];
  gradingRubric?: RubricCriterion[];
}

const MATCHING_LABELS: Record<AnswerMatchingMode, string> = {
  exact: 'exact match',
  case_insensitive: 'case-insensitive',
  normalized: 'normalized spacing',
};

function Chips({ values }: { values: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {values.map((v, i) => (
        <span key={`${v}-${i}`} className="rounded border border-success/30 bg-success/[0.06] px-1.5 py-0.5 text-xs text-ink">
          {v}
        </span>
      ))}
    </span>
  );
}

function ChoiceRow({ label, correct, selected, showKey, multi }: { label: string; correct: boolean; selected: boolean; showKey: boolean; multi: boolean }) {
  const wrongPick = selected && showKey && !correct;
  return (
    <li
      className={cn(
        'flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm',
        showKey && correct ? 'border-success/35 bg-success/[0.05]' : wrongPick ? 'border-danger/35 bg-danger/[0.05]' : 'border-line'
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center border',
          multi ? 'rounded' : 'rounded-full',
          selected ? (wrongPick ? 'border-danger bg-danger text-white' : 'border-primary bg-primary text-primary-fg') : 'border-field-border bg-field'
        )}
        aria-hidden
      >
        {selected ? multi ? <Check className="size-3" /> : <span className="size-1.5 rounded-full bg-current" /> : null}
      </span>
      <span className="min-w-0 flex-1 text-ink">{label}</span>
      <span className="flex shrink-0 items-center gap-2 text-[11px] font-medium">
        {selected ? <span className={wrongPick ? 'text-danger' : 'text-ink-muted'}>Selected</span> : null}
        {showKey && correct ? (
          <span className="inline-flex items-center gap-0.5 text-success">
            <Check className="size-3" aria-hidden />
            Correct
          </span>
        ) : null}
      </span>
    </li>
  );
}

function AnswerBox({ text, empty = 'No answer given.' }: { text?: string; empty?: string }) {
  return text ? (
    <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-line bg-surface-2/50 px-3 py-2.5 text-sm leading-relaxed text-ink">{text}</div>
  ) : (
    <p className="rounded-md border border-dashed border-line px-3 py-2.5 text-sm text-ink-subtle">{empty}</p>
  );
}

function Label({ children }: { children: string }) {
  return <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{children}</p>;
}

/** Renders options, answer keys and (optionally) a learner's answer for any backend question type. */
export function QuestionView({ question: q, answer, showKey = true }: { question: ViewableQuestion; answer?: AttemptQuestion['studentAnswer']; showKey?: boolean }) {
  const withAnswer = answer !== undefined;
  const correctIds = new Set(q.correctOptionIds ?? []);
  const picked = new Set(answer?.selectedOptionIds ?? []);

  if (q.questionType === 'multiple_choice' || q.questionType === 'multiple_select') {
    const options = [...(q.options ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return (
      <div>
        <ul className="space-y-1.5">
          {options.map((o) => (
            <ChoiceRow key={o.id} label={o.text} correct={correctIds.has(o.id)} selected={picked.has(o.id)} showKey={showKey} multi={q.questionType === 'multiple_select'} />
          ))}
        </ul>
        {withAnswer && picked.size === 0 ? <p className="mt-2 text-xs text-ink-subtle">No option selected.</p> : null}
      </div>
    );
  }

  if (q.questionType === 'true_false') {
    const given = answer?.booleanAnswer;
    return (
      <div>
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {[true, false].map((v) => (
            <ChoiceRow key={String(v)} label={v ? 'True' : 'False'} correct={q.correctAnswer === v} selected={given === v} showKey={showKey && q.correctAnswer !== null && q.correctAnswer !== undefined} multi={false} />
          ))}
        </ul>
        {withAnswer && given === undefined ? <p className="mt-2 text-xs text-ink-subtle">Not answered.</p> : null}
      </div>
    );
  }

  if (q.questionType === 'fill_in_the_blanks') {
    const blanks = q.blanks ?? [];
    return (
      <ol className="space-y-1.5">
        {blanks.map((b, i) => {
          const value = answer?.blankAnswers?.find((x) => x.blankId === b.id)?.value;
          return (
            <li key={b.id} className="rounded-md border border-line px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink-muted">Blank {i + 1}</span>
                <span className="text-[11px] text-ink-subtle">
                  {formatMarks(b.marks)} mark{b.marks === 1 ? '' : 's'}
                  {b.caseSensitive ? ' · case-sensitive' : ''}
                </span>
              </div>
              {withAnswer ? <p className={cn('mt-1', value ? 'text-ink' : 'text-ink-subtle')}>{value || 'Not answered'}</p> : null}
              {showKey && b.acceptedAnswers?.length ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-subtle">
                  Accepts <Chips values={b.acceptedAnswers} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    );
  }

  const accepted = q.acceptedAnswers ?? [];
  const rubric = q.gradingRubric ?? [];
  return (
    <div className="space-y-3">
      {withAnswer ? (
        <div>
          <Label>Learner answer</Label>
          <AnswerBox text={answer?.text} />
        </div>
      ) : null}
      {q.questionType === 'short_answer' && showKey ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
          <span>Accepted answers{q.answerMatchingMode ? ` (${MATCHING_LABELS[q.answerMatchingMode]})` : ''}:</span>
          {accepted.length ? <Chips values={accepted} /> : <span className="text-ink-subtle">none set</span>}
        </div>
      ) : null}
      {q.questionType === 'long_answer' && !withAnswer && !rubric.length ? <p className="text-xs text-ink-subtle">Open response, graded manually.</p> : null}
      {rubric.length ? (
        <div>
          <Label>Rubric</Label>
          <ul className="divide-y divide-line rounded-md border border-line">
            {rubric.map((r, i) => (
              <li key={`${r.criterion}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block text-ink">{r.criterion}</span>
                  {r.description ? <span className="block text-xs text-ink-muted">{r.description}</span> : null}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ink-muted">{formatMarks(r.maximumMarks)} pts</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function CorrectnessIcon({ isCorrect, manual }: { isCorrect: boolean | null | undefined; manual: boolean }) {
  if (manual && (isCorrect === null || isCorrect === undefined)) return null;
  return isCorrect ? (
    <span className="flex size-5 items-center justify-center rounded-full bg-success/12 text-success" title="Correct">
      <Check className="size-3" aria-hidden />
    </span>
  ) : (
    <span className="flex size-5 items-center justify-center rounded-full bg-danger/10 text-danger" title="Incorrect">
      <X className="size-3" aria-hidden />
    </span>
  );
}
