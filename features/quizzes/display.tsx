import { CheckSquare, CircleDot, PenLine, TextCursorInput, ToggleLeft, Type, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AttemptStatus, Difficulty, QuestionType, QuizShowResults, QuizStatus } from '@/types/quizzes';

function Pill({ label, dot, text }: { label: string; dot: string; text: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium', text)}>
      <span className={cn('size-1.5 rounded-full', dot)} aria-hidden />
      {label}
    </span>
  );
}

const QUIZ_STYLE: Record<QuizStatus, { label: string; dot: string; text: string }> = {
  draft: { label: 'Draft', dot: 'bg-warning', text: 'text-warning' },
  published: { label: 'Published', dot: 'bg-success', text: 'text-success' },
  archived: { label: 'Archived', dot: 'bg-ink-subtle', text: 'text-ink-subtle' },
};

export function QuizStatusBadge({ status }: { status: QuizStatus }) {
  return <Pill {...(QUIZ_STYLE[status] ?? QUIZ_STYLE.draft)} />;
}

export function quizStatusLabel(status: QuizStatus): string {
  return QUIZ_STYLE[status]?.label ?? status;
}

const ATTEMPT_STYLE: Record<AttemptStatus, { label: string; dot: string; text: string }> = {
  in_progress: { label: 'In progress', dot: 'bg-info', text: 'text-info' },
  submitted: { label: 'Submitted', dot: 'bg-warning', text: 'text-warning' },
  evaluating: { label: 'Needs grading', dot: 'bg-warning', text: 'text-warning' },
  evaluated: { label: 'Evaluated', dot: 'bg-success', text: 'text-success' },
  expired: { label: 'Expired', dot: 'bg-ink-subtle', text: 'text-ink-muted' },
  abandoned: { label: 'Abandoned', dot: 'bg-ink-subtle', text: 'text-ink-subtle' },
};

export function AttemptStatusBadge({ status }: { status: AttemptStatus }) {
  return <Pill {...(ATTEMPT_STYLE[status] ?? ATTEMPT_STYLE.submitted)} />;
}

export function attemptStatusLabel(status: AttemptStatus): string {
  return ATTEMPT_STYLE[status]?.label ?? status;
}

/** Statuses `gradeAttempt` accepts. */
export const GRADABLE_ATTEMPTS: AttemptStatus[] = ['submitted', 'evaluating', 'evaluated', 'expired'];

/** `pending` covers attempts whose pass/fail is still provisional (manual grading outstanding). */
export function ResultBadge({ passed, pending = false }: { passed: boolean | null | undefined; pending?: boolean }) {
  if (pending) return <span className="text-xs text-ink-subtle" title="Final result is set once manual grading is complete">Pending</span>;
  if (passed === true) return <span className="text-xs font-medium text-success">Passed</span>;
  if (passed === false) return <span className="text-xs font-medium text-danger">Failed</span>;
  return <span className="text-xs text-ink-subtle">—</span>;
}

const TYPE_META: Record<QuestionType, { label: string; short: string; icon: LucideIcon }> = {
  multiple_choice: { label: 'Multiple choice', short: 'MCQ', icon: CircleDot },
  multiple_select: { label: 'Multiple select', short: 'Multi', icon: CheckSquare },
  true_false: { label: 'True / false', short: 'T/F', icon: ToggleLeft },
  short_answer: { label: 'Short answer', short: 'Short', icon: Type },
  long_answer: { label: 'Long answer', short: 'Essay', icon: PenLine },
  fill_in_the_blanks: { label: 'Fill in the blanks', short: 'Blanks', icon: TextCursorInput },
};

export function questionTypeLabel(type: QuestionType): string {
  return TYPE_META[type]?.label ?? type;
}

export function QuestionTypeTag({ type, compact = false }: { type: QuestionType; compact?: boolean }) {
  const meta = TYPE_META[type];
  if (!meta) return <span className="text-xs text-ink-muted">{type}</span>;
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-muted" title={meta.label}>
      <Icon className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
      {compact ? meta.short : meta.label}
    </span>
  );
}

const DIFFICULTY_STYLE: Record<Difficulty, { label: string; bars: number; text: string }> = {
  easy: { label: 'Easy', bars: 1, text: 'text-success' },
  medium: { label: 'Medium', bars: 2, text: 'text-warning' },
  hard: { label: 'Hard', bars: 3, text: 'text-danger' },
};

export function DifficultyTag({ value }: { value: Difficulty }) {
  const s = DIFFICULTY_STYLE[value] ?? DIFFICULTY_STYLE.medium;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink-muted">
      <span className="flex items-end gap-px" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn('w-[3px] rounded-sm', n <= s.bars ? cn('bg-current', s.text) : 'bg-line')} style={{ height: 4 + n * 2 }} />
        ))}
      </span>
      {s.label}
    </span>
  );
}

export function difficultyLabel(value: Difficulty): string {
  return DIFFICULTY_STYLE[value]?.label ?? value;
}

const SHOW_RESULTS_LABELS: Record<QuizShowResults, string> = {
  immediate: 'Immediately',
  after_submission: 'After submission',
  after_manual_grading: 'After manual grading',
  scheduled: 'Scheduled',
};

export function showResultsLabel(value: QuizShowResults): string {
  return SHOW_RESULTS_LABELS[value] ?? value;
}

/** Backend treats long answers and `gradingMode: manual` as manually graded (`gradeAttempt`). */
export function isManualQuestion(q: { questionType: QuestionType; gradingMode?: string }): boolean {
  return q.questionType === 'long_answer' || q.gradingMode === 'manual';
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds <= 0) return 'No limit';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h) return `${h}h ${m ? `${m}m` : ''}`.trim();
  if (m) return `${m}m${s ? ` ${s}s` : ''}`;
  return `${s}s`;
}

/** Elapsed time (time taken), as opposed to a configured limit where 0 means none. */
export function formatElapsed(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 1) return 'Under 1s';
  return formatDuration(Math.round(seconds));
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

export function formatMarks(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** Thin score bar; colour follows the pass mark when one is known. */
export function ScoreBar({ percentage, passMark, className }: { percentage: number | null | undefined; passMark?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, percentage ?? 0));
  const tone = percentage === null || percentage === undefined ? 'bg-line' : passMark !== undefined ? (pct >= passMark ? 'bg-success' : 'bg-danger/80') : 'bg-primary';
  return (
    <div className={cn('relative h-1.5 overflow-hidden rounded-full bg-surface-2', className)} aria-hidden>
      <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      {passMark !== undefined ? <span className="absolute inset-y-0 w-px bg-ink/30" style={{ left: `${passMark}%` }} /> : null}
    </div>
  );
}
