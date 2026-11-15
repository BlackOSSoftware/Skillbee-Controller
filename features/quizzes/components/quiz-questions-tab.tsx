'use client';

import { ArrowDown, ArrowUp, GripVertical, Library, ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useAuth } from '@/hooks/use-auth';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { useToast } from '@/providers/toast-provider';
import type { Quiz, QuizQuestion } from '@/types/quizzes';
import { move } from '@/features/courses/components/form-controls';
import { quizPolicy, useDeleteQuestion, useQuizQuestions, useReorderQuestions } from '../hooks';
import { DifficultyTag, formatMarks, isManualQuestion, QuestionTypeTag } from '../display';
import { BankImportDialog } from './bank-import-dialog';
import { QuestionEditorDialog } from './question-editor-dialog';
import { QuestionView } from './question-view';

export function QuizQuestionsTab({ quiz }: { quiz: Quiz }) {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = quizPolicy.canManageQuestions(user);
  const canBank = canManage && quizPolicy.canReadBank(user);
  const questions = useQuizQuestions(quiz.id, quizPolicy.canReadQuestions(user));
  const reorder = useReorderQuestions(quiz.id);
  const remove = useDeleteQuestion(quiz.id);
  const [order, setOrder] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<QuizQuestion | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<QuizQuestion | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const server = questions.data ?? [];
  const byId = new Map(server.map((q) => [q.id, q]));
  /** A local order only applies while it still covers exactly the server's questions. */
  const validOrder = order && order.length === server.length && order.every((id) => byId.has(id)) ? order : null;
  const list = validOrder ? validOrder.map((id) => byId.get(id) as QuizQuestion) : server;
  const dirty = Boolean(validOrder) && validOrder?.join() !== server.map((q) => q.id).join();
  const total = server.reduce((s, q) => s + (Number(q.marks) || 0), 0);

  function moveTo(from: number, to: number) {
    setOrder(move(list.map((q) => q.id), from, to));
  }

  function saveOrder() {
    if (!validOrder) return;
    reorder.mutate(validOrder, {
      onSuccess: () => {
        setOrder(null);
        toast.success('Question order saved');
      },
      onError: (error) => toast.error('Could not save order', normalizeApiError(error).message),
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Question removed', 'Past attempts keep their own copy of it.');
        setDeleting(null);
      },
      onError: (error) => {
        toast.error('Could not remove question', normalizeApiError(error).message);
        setDeleting(null);
      },
    });
  }

  return (
    <section className="min-w-0 rounded-lg border border-line" aria-label="Questions">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">Questions</h3>
          <p className="text-xs text-ink-muted">
            {questions.data
              ? `${server.length} active · ${formatMarks(total)} marks · ${server.filter(isManualQuestion).length} graded manually · ${server.filter((q) => q.questionBankId).length} from the bank`
              : 'Answer keys are visible to staff only.'}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {dirty ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setOrder(null)} disabled={reorder.isPending}>
                  Reset order
                </Button>
                <Button size="sm" onClick={saveOrder} loading={reorder.isPending}>
                  Save order
                </Button>
              </>
            ) : null}
            {canBank ? (
              <Button size="sm" variant="secondary" onClick={() => setImporting(true)} disabled={dirty}>
                <Library className="size-3.5" aria-hidden />
                Import from bank
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setEditing('new')} disabled={dirty}>
              <Plus className="size-3.5" aria-hidden />
              Add question
            </Button>
          </div>
        ) : null}
      </div>

      {questions.isError ? (
        <ErrorState error={questions.error} onRetry={() => questions.refetch()} />
      ) : questions.isPending ? (
        <ul className="divide-y divide-line">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="space-y-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-40" />
            </li>
          ))}
        </ul>
      ) : !list.length ? (
        <EmptyState
          icon={<ListOrdered className="size-5" aria-hidden />}
          title="No questions yet"
          description="A quiz needs at least one active question before it can be published."
          action={canManage ? <Button size="sm" onClick={() => setEditing('new')}>Add the first question</Button> : undefined}
        />
      ) : (
        <ol className="divide-y divide-line">
          {list.map((q, i) => (
            <li
              key={q.id}
              draggable={canManage && !reorder.isPending}
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                if (dragIndex === null || dragIndex === i) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null && dragIndex !== i) moveTo(dragIndex, i);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn('group p-4 transition-colors', dragIndex === i && 'bg-primary/[0.05] opacity-70', reorder.isPending && 'opacity-60')}
            >
              <div className="flex items-start gap-3">
                {canManage ? <GripVertical className="mt-1 size-4 shrink-0 cursor-grab text-ink-subtle" aria-hidden /> : null}
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-[11px] font-semibold tabular-nums text-ink-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm font-medium text-ink">{q.questionText}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <QuestionTypeTag type={q.questionType} />
                    <DifficultyTag value={q.difficulty} />
                    <span className="text-xs tabular-nums text-ink-muted">
                      {formatMarks(q.marks)} mark{q.marks === 1 ? '' : 's'}
                      {q.negativeMarks ? ` · −${formatMarks(q.negativeMarks)}` : ''}
                    </span>
                    {!q.isRequired ? <span className="text-xs text-ink-subtle">Optional</span> : null}
                    {q.questionBankId ? (
                      <span className="inline-flex items-center gap-1 rounded border border-primary/25 bg-primary/10 px-1.5 py-px text-[11px] font-medium text-primary" title="Copied from the question bank; bank edits do not change this copy">
                        <Library className="size-3" aria-hidden />
                        Bank copy
                      </span>
                    ) : null}
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer select-none text-xs font-medium text-primary hover:underline">Answer key</summary>
                    <div className="mt-2">
                      <QuestionView question={q} />
                      {q.explanation ? <p className="mt-2 border-l-2 border-line pl-3 text-xs text-ink-muted">{q.explanation}</p> : null}
                    </div>
                  </details>
                </div>
                {canManage ? (
                  <div className="flex shrink-0 items-center">
                    <button type="button" onClick={() => moveTo(i, i - 1)} disabled={i === 0 || reorder.isPending} className="rounded-md p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink disabled:opacity-30" aria-label={`Move question ${i + 1} up`}>
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button type="button" onClick={() => moveTo(i, i + 1)} disabled={i === list.length - 1 || reorder.isPending} className="rounded-md p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink disabled:opacity-30" aria-label={`Move question ${i + 1} down`}>
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button type="button" onClick={() => setEditing(q)} disabled={dirty} className="rounded-md p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink disabled:opacity-30" aria-label={`Edit question ${i + 1}`}>
                      <Pencil className="size-3.5" />
                    </button>
                    <button type="button" onClick={() => setDeleting(q)} disabled={dirty} className="rounded-md p-1.5 text-ink-subtle hover:bg-danger/10 hover:text-danger disabled:opacity-30" aria-label={`Remove question ${i + 1}`}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      {dirty ? <p className="border-t border-line px-4 py-2 text-xs text-warning">Unsaved order. Save it before adding, editing or removing questions.</p> : null}

      {editing ? <QuestionEditorDialog quizId={quiz.id} question={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} /> : null}
      {importing ? (
        <BankImportDialog quizId={quiz.id} importedIds={new Set(server.flatMap((q) => (q.questionBankId ? [q.questionBankId] : [])))} onClose={() => setImporting(false)} />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Remove this question?"
        confirmLabel="Remove question"
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        description={<p>It is archived and no longer used in new attempts. Learners&apos; past attempts and grades keep their own copy.</p>}
      />
    </section>
  );
}
