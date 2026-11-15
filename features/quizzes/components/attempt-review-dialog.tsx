'use client';

import { CircleAlert, Hourglass, Save } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { useToast } from '@/providers/toast-provider';
import type { AttemptQuestion, Quiz, QuizAttemptRow, RubricCriterion } from '@/types/quizzes';
import { formatDateTime } from '@/features/assignments/display';
import { Initials } from '@/features/enrollments/display';
import { quizPolicy, useAttemptReview, useGradeAttempt, type Learner } from '../hooks';
import { AttemptStatusBadge, formatElapsed, formatMarks, formatPercent, GRADABLE_ATTEMPTS, isManualQuestion, QuestionTypeTag, ResultBadge, ScoreBar } from '../display';
import { CorrectnessIcon, QuestionView } from './question-view';

const FEEDBACK_MAX = 5000;

type View = 'all' | 'manual' | 'incorrect' | 'correct';

interface Draft {
  marks: string;
  feedback: string;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  );
}

function initialDraft(q: AttemptQuestion): Draft {
  return { marks: q.marksAwarded !== null && q.marksAwarded !== undefined && !q.needsManualGrading ? String(q.marksAwarded) : '', feedback: q.feedback ?? '' };
}

function validateDraft(d: Draft, max: number): { marks?: string; feedback?: string } {
  const out: { marks?: string; feedback?: string } = {};
  const value = Number(d.marks);
  if (d.marks.trim() === '' || !Number.isFinite(value)) out.marks = 'Enter the marks awarded.';
  else if (value < 0) out.marks = 'Marks cannot be negative.';
  else if (value > max) out.marks = `Cannot exceed ${formatMarks(max)}.`;
  if (d.feedback.length > FEEDBACK_MAX) out.feedback = `Feedback must be ${FEEDBACK_MAX.toLocaleString('en-IN')} characters or less.`;
  return out;
}

interface AttemptReviewDialogProps {
  attempt: QuizAttemptRow;
  learner?: Learner;
  quiz?: Quiz;
  courseTitle?: string;
  onClose: () => void;
}

export function AttemptReviewDialog({ attempt, learner, quiz, courseTitle, onClose }: AttemptReviewDialogProps) {
  const { user } = useAuth();
  const toast = useToast();
  const canGrade = quizPolicy.canGrade(user);
  const review = useAttemptReview(attempt.id, canGrade, quizPolicy.canReadResult(user), quizPolicy.canReadResults(user));
  const grade = useGradeAttempt();
  const inFlight = useRef(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [errors, setErrors] = useState<Record<string, { marks?: string; feedback?: string }>>({});
  const [view, setView] = useState<View>('all');
  const [confirmRegrade, setConfirmRegrade] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const r = review.result;
  const questions = r?.questions ?? [];
  const manual = questions.filter(isManualQuestion);
  const pendingCount = manual.filter((q) => q.needsManualGrading).length;
  const gradable = canGrade && Boolean(r) && GRADABLE_ATTEMPTS.includes(r?.status ?? attempt.status) && manual.length > 0;
  const passMark = quiz?.passingPercentage;

  const draftOf = (q: AttemptQuestion) => drafts[q.id] ?? initialDraft(q);
  const dirtyIds = manual
    .filter((q) => {
      const d = drafts[q.id];
      if (!d) return false;
      const init = initialDraft(q);
      return d.marks !== init.marks || d.feedback !== init.feedback;
    })
    .map((q) => q.id);
  const dirty = dirtyIds.length > 0;

  function edit(q: AttemptQuestion, patch: Partial<Draft>) {
    setDrafts((all) => ({ ...all, [q.id]: { ...draftOf(q), ...patch } }));
    setErrors((e) => ({ ...e, [q.id]: { ...e[q.id], ...(patch.marks !== undefined ? { marks: undefined } : {}), ...(patch.feedback !== undefined ? { feedback: undefined } : {}) } }));
  }

  function requestSave() {
    const found: typeof errors = {};
    for (const q of manual.filter((m) => dirtyIds.includes(m.id))) {
      const e = validateDraft(draftOf(q), q.marks);
      if (e.marks || e.feedback) found[q.id] = e;
    }
    setErrors(found);
    if (Object.keys(found).length) {
      setView('all');
      document.getElementById(`grade-${Object.keys(found)[0]}-marks`)?.focus();
      return;
    }
    const regrading = manual.some((q) => dirtyIds.includes(q.id) && !q.needsManualGrading && q.marksAwarded !== null && q.marksAwarded !== undefined);
    if (regrading) setConfirmRegrade(true);
    else save();
  }

  function save() {
    if (inFlight.current || !dirty) return;
    inFlight.current = true;
    const grades = manual
      .filter((q) => dirtyIds.includes(q.id))
      .map((q) => {
        const d = draftOf(q);
        return { questionId: q.id, marksAwarded: Number(d.marks), ...(d.feedback.trim() ? { feedback: d.feedback.trim() } : {}) };
      });
    grade.mutate(
      { id: attempt.id, input: { grades } },
      {
        onSuccess: (result) => {
          setDrafts({});
          setConfirmRegrade(false);
          const still = (result.questions ?? []).filter((q) => isManualQuestion(q) && q.needsManualGrading).length;
          toast.success(
            still ? `Saved · ${still} question${still === 1 ? '' : 's'} left to grade` : 'Grading complete',
            `${formatMarks(result.obtainedMarks)} / ${formatMarks(result.totalMarks)} (${formatPercent(result.percentage)}) · ${result.passed ? 'Passed' : 'Failed'}`
          );
        },
        onError: (error) => {
          setConfirmRegrade(false);
          toast.error('Could not save grades', normalizeApiError(error).message);
        },
        onSettled: () => {
          inFlight.current = false;
        },
      }
    );
  }

  function requestClose() {
    if (grade.isPending) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  const counts: Record<View, number> = {
    all: questions.length,
    manual: manual.length,
    incorrect: questions.filter((q) => !isManualQuestion(q) && q.isCorrect === false).length,
    correct: questions.filter((q) => q.isCorrect === true).length,
  };
  const visible = questions.filter((q) =>
    view === 'manual' ? isManualQuestion(q) : view === 'incorrect' ? !isManualQuestion(q) && q.isCorrect === false : view === 'correct' ? q.isCorrect === true : true
  );
  const name = learner?.name ?? `Learner ${attempt.studentId.slice(-6)}`;
  const status = r?.status ?? attempt.status;

  return (
    <>
      <Dialog
        open
        onClose={requestClose}
        busy={grade.isPending}
        size="full"
        title={name}
        description={`${r?.quizTitle ?? quiz?.title ?? 'Quiz'} · attempt ${attempt.attemptNumber}${courseTitle ? ` · ${courseTitle}` : ''}`}
        footer={
          gradable ? (
            <>
              <p className="mr-auto flex items-center gap-1.5 self-center text-xs text-ink-muted">
                {dirty ? (
                  <>
                    <span className="size-1.5 rounded-full bg-warning" aria-hidden />
                    {dirtyIds.length} unsaved change{dirtyIds.length === 1 ? '' : 's'}
                  </>
                ) : pendingCount ? (
                  `${pendingCount} of ${manual.length} manual question${manual.length === 1 ? '' : 's'} awaiting marks`
                ) : (
                  'All manual questions graded'
                )}
              </p>
              {dirty ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDrafts({});
                    setErrors({});
                  }}
                  disabled={grade.isPending}
                >
                  Discard
                </Button>
              ) : null}
              <Button onClick={requestSave} loading={grade.isPending} disabled={!dirty}>
                <Save className="size-4" aria-hidden />
                Save grades
              </Button>
            </>
          ) : undefined
        }
      >
        {review.error ? (
          <ErrorState error={review.error} onRetry={() => review.refetch()} />
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
              <div className="rounded-lg border border-line p-4">
                <div className="flex items-center gap-3">
                  <Initials firstName={learner?.name.split(' ')[0]} lastName={learner?.name.split(' ').slice(1).join(' ')} email={learner?.email} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{name}</p>
                    <p className="truncate text-xs text-ink-muted">{learner?.email ?? 'Email unavailable'}</p>
                  </div>
                </div>
                <div className="mt-4 border-t border-line pt-4">
                  {review.isPending ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-28" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ) : r ? (
                    <>
                      <div className="flex items-end justify-between gap-3">
                        <p className="tabular-nums">
                          <span className="text-3xl font-semibold tracking-tight text-ink">{status === 'in_progress' ? '—' : formatMarks(r.obtainedMarks)}</span>
                          <span className="text-sm text-ink-muted"> / {formatMarks(r.totalMarks)}</span>
                        </p>
                        <p className="pb-1 text-sm font-medium tabular-nums text-ink-muted">{status === 'in_progress' ? '' : formatPercent(r.percentage)}</p>
                      </div>
                      <ScoreBar percentage={status === 'in_progress' ? null : r.percentage} passMark={passMark} className="mt-2.5 h-2" />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <AttemptStatusBadge status={status} />
                        {status !== 'in_progress' ? <ResultBadge passed={r.passed} pending={pendingCount > 0} /> : null}
                      </div>
                      {pendingCount && status !== 'in_progress' ? (
                        <p className="mt-3 flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/[0.06] px-2.5 py-2 text-xs text-ink">
                          <Hourglass className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
                          Provisional score. {pendingCount} manual question{pendingCount === 1 ? '' : 's'} not graded yet.
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>

              {r ? (
                <div className="rounded-lg border border-line p-4">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Attempt</p>
                  <dl className="divide-y divide-line">
                    <Fact label="Started">{formatDateTime(r.startedAt)}</Fact>
                    <Fact label="Submitted">{formatDateTime(r.submittedAt)}</Fact>
                    <Fact label="Time taken">{formatElapsed(r.timeTakenSeconds)}</Fact>
                    {r.expiresAt ? <Fact label="Time limit ends">{formatDateTime(r.expiresAt)}</Fact> : null}
                    <Fact label="Correct / incorrect">
                      <span className="text-success">{r.correctCount ?? 0}</span> / <span className="text-danger">{r.incorrectCount ?? 0}</span>
                    </Fact>
                    <Fact label="Negative marks">{r.negativeMarks ? `−${formatMarks(r.negativeMarks)}` : 'None'}</Fact>
                    {passMark !== undefined ? <Fact label="Pass mark">{passMark}%</Fact> : null}
                    <Fact label="Visible to learner">{r.resultPublished ? 'Yes' : 'Not yet'}</Fact>
                  </dl>
                </div>
              ) : null}

              {!canGrade && manual.length ? <p className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-xs text-ink-muted">Grading needs the quizzes.grade permission.</p> : null}
            </aside>

            <section className="min-w-0" aria-label="Answers">
              <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter questions">
                {(
                  [
                    ['all', 'All'],
                    ['manual', 'Manual grading'],
                    ['incorrect', 'Incorrect'],
                    ['correct', 'Correct'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={view === id}
                    onClick={() => setView(id)}
                    disabled={review.isPending}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60',
                      view === id ? 'border-primary/50 bg-primary/[0.06] text-ink' : 'border-line text-ink-muted hover:border-field-border-hover hover:text-ink'
                    )}
                  >
                    {label}
                    <span className="tabular-nums text-ink-subtle">{review.isPending ? '' : counts[id]}</span>
                  </button>
                ))}
              </div>

              {review.isPending ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-2 rounded-lg border border-line p-4">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ))}
                </div>
              ) : status === 'in_progress' ? (
                <EmptyState icon={<Hourglass className="size-5" aria-hidden />} title="Attempt in progress" description="Answers and scores appear once the learner submits or the time limit runs out." />
              ) : !visible.length ? (
                <EmptyState title="No questions in this view" />
              ) : (
                <ol className="space-y-3">
                  {visible.map((q) => {
                    const index = questions.indexOf(q);
                    const isManual = isManualQuestion(q);
                    const d = draftOf(q);
                    const err = errors[q.id] ?? {};
                    const rubric: RubricCriterion[] = review.rubrics.get(q.id) ?? [];
                    const awaiting = isManual && q.needsManualGrading;
                    return (
                      <li key={q.id} className={cn('rounded-lg border bg-surface', awaiting ? 'border-warning/40' : 'border-line')}>
                        <div className="flex items-start gap-3 p-4">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-[11px] font-semibold tabular-nums text-ink-muted">{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="whitespace-pre-wrap text-sm font-medium text-ink">{q.questionText}</p>
                              <span className="flex shrink-0 items-center gap-2">
                                <span className="text-sm tabular-nums">
                                  <span className="font-semibold text-ink">{awaiting ? '—' : formatMarks(q.marksAwarded ?? 0)}</span>
                                  <span className="text-ink-subtle">/{formatMarks(q.marks)}</span>
                                </span>
                                <CorrectnessIcon isCorrect={q.isCorrect} manual={isManual} />
                              </span>
                            </div>
                            {q.description ? <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-muted">{q.description}</p> : null}
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <QuestionTypeTag type={q.questionType} />
                              {isManual ? <span className={cn('text-xs font-medium', awaiting ? 'text-warning' : 'text-ink-muted')}>{awaiting ? 'Awaiting marks' : 'Graded manually'}</span> : null}
                              {q.negativeApplied ? <span className="text-xs text-danger">−{formatMarks(q.negativeApplied)} negative</span> : null}
                            </div>
                          </div>
                        </div>
                        <div className="px-4 pb-4 sm:pl-13">
                          <QuestionView question={{ ...q, gradingRubric: rubric }} answer={q.studentAnswer ?? {}} />
                          {q.explanation ? (
                            <p className="mt-2.5 border-l-2 border-line pl-3 text-xs leading-relaxed text-ink-muted">
                              <span className="font-medium text-ink">Explanation. </span>
                              {q.explanation}
                            </p>
                          ) : null}

                          {isManual && gradable ? (
                            <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-line bg-surface-2/40 p-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                              <Field id={`grade-${q.id}-marks`} label={`Marks (0–${formatMarks(q.marks)})`} required error={err.marks}>
                                <div className="flex items-center gap-2">
                                  <Input
                                    id={`grade-${q.id}-marks`}
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    max={q.marks}
                                    step="any"
                                    value={d.marks}
                                    onChange={(e) => edit(q, { marks: e.target.value })}
                                    className="w-24"
                                    aria-invalid={Boolean(err.marks)}
                                    aria-describedby={`grade-${q.id}-marks-msg`}
                                    disabled={grade.isPending}
                                  />
                                  <span className="text-sm text-ink-muted">/ {formatMarks(q.marks)}</span>
                                </div>
                                <div className="mt-1.5 flex gap-1">
                                  {[0, q.marks / 2, q.marks].map((v, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => edit(q, { marks: String(Number(v.toFixed(2))) })}
                                      disabled={grade.isPending}
                                      className="rounded border border-line px-1.5 py-0.5 text-[11px] tabular-nums text-ink-muted hover:border-field-border-hover hover:text-ink"
                                    >
                                      {i === 2 ? 'Full' : formatMarks(Number(v.toFixed(2)))}
                                    </button>
                                  ))}
                                </div>
                              </Field>
                              <Field id={`grade-${q.id}-feedback`} label="Feedback" error={err.feedback} hint={`Visible to the learner with results · ${d.feedback.length}/${FEEDBACK_MAX}`}>
                                <Textarea
                                  id={`grade-${q.id}-feedback`}
                                  rows={3}
                                  value={d.feedback}
                                  onChange={(e) => edit(q, { feedback: e.target.value })}
                                  placeholder="Strengths, gaps, and how to improve"
                                  aria-invalid={Boolean(err.feedback)}
                                  aria-describedby={`grade-${q.id}-feedback-msg`}
                                  disabled={grade.isPending}
                                />
                              </Field>
                            </div>
                          ) : isManual && q.feedback ? (
                            <p className="mt-3 rounded-md border border-line bg-surface-2/40 px-3 py-2 text-sm text-ink-muted">
                              <span className="font-medium text-ink">Feedback. </span>
                              {q.feedback}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {r && !manual.length && status !== 'in_progress' ? (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-subtle">
                  <CircleAlert className="size-3.5" aria-hidden />
                  Every question in this attempt is auto-graded, so there is nothing to grade manually.
                </p>
              ) : null}
            </section>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmRegrade}
        title="Replace existing grades?"
        confirmLabel="Save grades"
        tone="primary"
        loading={grade.isPending}
        onCancel={() => setConfirmRegrade(false)}
        onConfirm={save}
        description={<p>Some of these questions were already graded. Saving replaces those marks and recalculates the learner&apos;s score and result.</p>}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard unsaved grades?"
        confirmLabel="Discard"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        description={<p>You have {dirtyIds.length} unsaved change{dirtyIds.length === 1 ? '' : 's'} for this attempt.</p>}
      />
    </>
  );
}
