'use client';

import { Archive, ArrowRight, Copy, FilePen, Megaphone, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import type { Quiz, QuizStatus } from '@/types/quizzes';
import { formatDateTime } from '@/features/assignments/display';
import { quizPolicy, useDeleteQuiz, useDuplicateQuiz, useQuizAnalytics, useQuizDetail, useQuizQuestions, useQuizStatus } from '../hooks';
import { formatDuration, formatElapsed, formatMarks, formatPercent, isManualQuestion, QuizStatusBadge, quizStatusLabel, showResultsLabel } from '../display';
import { QuizAttemptsTab } from './quiz-attempts-tab';
import { QuizFormDialog } from './quiz-form-dialog';
import { QuizQuestionsTab } from './quiz-questions-tab';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-ink">{value}</p>
      {hint ? <p className="truncate text-[11px] text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

const yesNo = (v: boolean) => (v ? 'Yes' : 'No');

type Tab = 'overview' | 'questions' | 'attempts';
type StatusAction = { status: QuizStatus; label: string; icon: typeof Megaphone; confirm?: string; danger?: boolean };

function statusActions(status: QuizStatus): StatusAction[] {
  const archive: StatusAction = { status: 'archived', label: 'Archive', icon: Archive, confirm: 'Learners can no longer start this quiz. Attempts and results are kept.', danger: true };
  if (status === 'draft') return [{ status: 'published', label: 'Publish', icon: Megaphone }, archive];
  if (status === 'published') return [{ status: 'draft', label: 'Unpublish', icon: FilePen, confirm: 'Learners will no longer see this quiz until it is published again.' }, archive];
  return [{ status: 'draft', label: 'Restore to draft', icon: RotateCcw }];
}

interface QuizWorkspaceProps {
  quiz: Quiz;
  courseTitle?: string;
  onClose: () => void;
  /** Opens another quiz in place (used after duplicating). */
  onOpenQuiz: (quiz: Quiz) => void;
}

export function QuizWorkspace({ quiz: seed, courseTitle, onClose, onOpenQuiz }: QuizWorkspaceProps) {
  const { user } = useAuth();
  const toast = useToast();
  const detail = useQuizDetail(seed.id, seed);
  const q = detail.data ?? seed;
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<StatusAction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = useQuizStatus();
  const duplicate = useDuplicateQuiz();
  const remove = useDeleteQuiz();
  const canAnalytics = quizPolicy.canReadAnalytics(user);
  const questions = useQuizQuestions(q.id, quizPolicy.canReadQuestions(user));
  const analytics = useQuizAnalytics(q.id, canAnalytics && tab === 'overview');
  const a = analytics.data;
  const questionMarks = questions.data ? questions.data.reduce((sum, item) => sum + (Number(item.marks) || 0), 0) : null;
  const window = q.availability?.enabled ? q.availability : null;
  const busy = status.isPending || duplicate.isPending || remove.isPending;
  const actions = quizPolicy.canPublish(user) ? statusActions(q.status) : [];

  function applyStatus(action: StatusAction) {
    status.mutate(
      { id: q.id, status: action.status },
      {
        onSuccess: (updated) => {
          setPendingStatus(null);
          toast.success(updated.status === 'draft' ? 'Moved to draft' : `Quiz ${quizStatusLabel(updated.status).toLowerCase()}`, updated.title);
        },
        onError: (error) => {
          setPendingStatus(null);
          toast.error('Could not change status', normalizeApiError(error).message);
        },
      }
    );
  }

  function runDuplicate() {
    duplicate.mutate(q.id, {
      onSuccess: (copy) => {
        toast.success('Quiz duplicated', `“${copy.title}” was created as a draft.`);
        onOpenQuiz(copy);
      },
      onError: (error) => toast.error('Could not duplicate quiz', normalizeApiError(error).message),
    });
  }

  function runDelete() {
    remove.mutate(q.id, {
      onSuccess: () => {
        toast.success('Quiz deleted', 'It was archived and removed. Attempts and results are preserved.');
        onClose();
      },
      onError: (error) => {
        setConfirmDelete(false);
        toast.error('Could not delete quiz', normalizeApiError(error).message);
      },
    });
  }

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'questions', label: 'Questions', count: questions.data?.length },
    ...(quizPolicy.canReadAttempts(user) ? [{ id: 'attempts' as const, label: 'Attempts', count: a?.totalAttempts }] : []),
  ];

  const toolbar = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <QuizStatusBadge status={q.status} />
        {detail.isError ? <span className="text-[11px] text-danger">Could not refresh details</span> : null}
        <span className="flex-1" />
        {quizPolicy.canUpdate(user) ? (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)} disabled={busy}>
            <Pencil className="size-3.5" aria-hidden />
            Settings
          </Button>
        ) : null}
        {actions.map((action) => (
          <Button
            key={action.status}
            size="sm"
            variant={action.status === 'published' ? 'primary' : action.danger ? 'danger' : 'secondary'}
            onClick={() => (action.confirm ? setPendingStatus(action) : applyStatus(action))}
            loading={status.isPending && status.variables?.status === action.status}
            disabled={busy}
          >
            <action.icon className="size-3.5" aria-hidden />
            {action.label}
          </Button>
        ))}
        {quizPolicy.canCreate(user) ? (
          <Button size="sm" variant="secondary" onClick={runDuplicate} loading={duplicate.isPending} disabled={busy}>
            <Copy className="size-3.5" aria-hidden />
            Duplicate
          </Button>
        ) : null}
        {quizPolicy.canDelete(user) ? (
          <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
            <Trash2 className="size-3.5" aria-hidden />
            Delete
          </Button>
        ) : null}
      </div>
      <div role="tablist" aria-label="Quiz workspace" className="-mb-3 flex gap-1 overflow-x-auto [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn('-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors', tab === t.id ? 'border-primary font-semibold text-ink' : 'border-transparent text-ink-muted hover:text-ink')}
          >
            {t.label}
            {t.count !== undefined ? <span className={cn('rounded px-1.5 text-[11px] tabular-nums', tab === t.id ? 'bg-primary/10 text-primary' : 'bg-surface-2 text-ink-muted')}>{t.count}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <Dialog open onClose={onClose} busy={busy} size="full" title={q.title} description={courseTitle ?? 'Quiz'} toolbar={toolbar}>
        {tab === 'questions' ? (
          <QuizQuestionsTab quiz={q} />
        ) : tab === 'attempts' ? (
          <QuizAttemptsTab quiz={q} courseTitle={courseTitle} />
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
              <div className="rounded-lg border border-line p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Configuration</p>
                <dl className="divide-y divide-line">
                  <Fact label="Total marks">
                    {formatMarks(q.totalMarks)}
                    {questionMarks !== null && Math.abs(questionMarks - q.totalMarks) > 0.001 ? (
                      <span className="block text-[11px] text-warning" title="The stored total is recalculated when the quiz is published">
                        Questions add up to {formatMarks(questionMarks)}
                      </span>
                    ) : null}
                  </Fact>
                  <Fact label="Pass mark">{q.passingPercentage}%</Fact>
                  <Fact label="Time limit">{formatDuration(q.timeLimitSeconds)}</Fact>
                  <Fact label="Attempts allowed">{q.unlimitedAttempts ? 'Unlimited' : q.maximumAttempts}</Fact>
                  <Fact label="Questions">{q.questionSelectionMode === 'random_count' && q.questionsToSelect ? `${q.questionsToSelect} drawn at random` : 'All'}</Fact>
                  <Fact label="Shuffle">{[q.randomizeQuestions && 'questions', q.randomizeAnswers && 'answers'].filter(Boolean).join(' & ') || 'Off'}</Fact>
                  <Fact label="Negative marking">{q.negativeMarkingEnabled ? `${formatMarks(q.negativeMarksPerWrongAnswer)} per wrong answer` : 'Off'}</Fact>
                  <Fact label="Results shown">{showResultsLabel(q.showResults)}</Fact>
                  <Fact label="Correct answers / explanations">
                    {yesNo(q.showCorrectAnswers)} / {yesNo(q.showExplanation)}
                  </Fact>
                  <Fact label="Resume / back navigation">
                    {yesNo(q.allowResume)} / {yesNo(q.allowBackNavigation)}
                  </Fact>
                  <Fact label="Required questions enforced">{yesNo(q.requireAllQuestions)}</Fact>
                  <Fact label="Partial credit (multi-select)">{yesNo(q.allowPartialCreditMultiSelect)}</Fact>
                  <Fact label="Availability">{window ? `${formatDateTime(window.startsAt ?? null)} → ${formatDateTime(window.endsAt ?? null)}` : 'Always'}</Fact>
                  <Fact label="Published">{formatDateTime(q.publishedAt)}</Fact>
                  <Fact label="Version">v{q.version}</Fact>
                </dl>
                {q.tags.length ? (
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-3">
                    {q.tags.map((t) => (
                      <span key={t} className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </aside>

            <div className="min-w-0 space-y-5">
              {canAnalytics ? (
                <section aria-label="Quiz performance" className="overflow-hidden rounded-lg border border-line">
                  {analytics.isError ? (
                    <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />
                  ) : (
                    <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4 [&>*]:bg-surface">
                      {analytics.isPending || !a ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="px-4 py-3">
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="mt-2 h-5 w-12" />
                          </div>
                        ))
                      ) : (
                        <>
                          <Metric label="Attempts" value={formatNumber(a.totalAttempts)} hint={`${formatNumber(a.uniqueStudents)} learner${a.uniqueStudents === 1 ? '' : 's'} · ${formatNumber(a.inProgressAttempts)} in progress`} />
                          <Metric label="Average score" value={formatPercent(a.averageScore)} hint={a.highestScore !== null ? `High ${formatPercent(a.highestScore)} · low ${formatPercent(a.lowestScore)}` : 'No scored attempts'} />
                          <Metric label="Pass rate" value={formatPercent(a.passPercentage)} hint={`${formatNumber(a.passCount)} passed · ${formatNumber(a.failCount)} failed`} />
                          <Metric label="Pending grading" value={formatNumber(a.pendingManualEvaluations)} hint={`Avg. time ${formatElapsed(a.averageTimeTaken)}`} />
                        </>
                      )}
                    </div>
                  )}
                </section>
              ) : null}

              <section className="rounded-lg border border-line p-4" aria-label="Questions summary">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Questions</h3>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {questions.isPending ? 'Loading…' : questions.data ? `${questions.data.length} active · ${formatMarks(questionMarks ?? 0)} marks · ${questions.data.filter(isManualQuestion).length} graded manually` : 'Questions are unavailable.'}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setTab('questions')}>
                    Manage
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Button>
                </div>
                {questions.data && !questions.data.length && q.status === 'draft' ? <p className="mt-3 text-xs text-warning">Add at least one question before publishing.</p> : null}
              </section>

              {q.description || q.instructions ? (
                <section className="space-y-3 rounded-lg border border-line p-4">
                  {q.description ? (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Description</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{q.description}</p>
                    </div>
                  ) : null}
                  {q.instructions ? (
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Instructions</p>
                      <p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-ink">{q.instructions}</p>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          </div>
        )}
      </Dialog>

      {editing ? <QuizFormDialog mode="edit" quiz={q} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} /> : null}
      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title={`${pendingStatus?.label ?? ''}?`}
        confirmLabel={pendingStatus?.label ?? 'Confirm'}
        tone={pendingStatus?.danger ? 'danger' : 'primary'}
        loading={status.isPending}
        onCancel={() => setPendingStatus(null)}
        onConfirm={() => pendingStatus && applyStatus(pendingStatus)}
        description={<p>{pendingStatus?.confirm}</p>}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this quiz?"
        confirmLabel="Delete quiz"
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={runDelete}
        description={<p>“{q.title}” is archived and removed from the console and from learners. Existing attempts, scores and grades are preserved.</p>}
      />
    </>
  );
}
