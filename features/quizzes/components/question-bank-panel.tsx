'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Archive, Eye, Library, Pencil, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { ActionMenu } from '@/components/ui/menu';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { useToast } from '@/providers/toast-provider';
import { DIFFICULTIES, QUESTION_TYPES, type BankListParams, type BankQuestion, type Difficulty, type QuestionType } from '@/types/quizzes';
import { useArchiveBankQuestion, useBankCategories, useBankList, useBankQuestion } from '../hooks';
import { DifficultyTag, difficultyLabel, formatMarks, isManualQuestion, QuestionTypeTag, questionTypeLabel } from '../display';
import { BankQuestionDialog } from './bank-question-dialog';
import { QuestionView } from './question-view';

const PAGE_SIZES = [10, 20, 50];

interface Filters {
  search: string;
  questionType: QuestionType | '';
  difficulty: Difficulty | '';
  category: string;
}

/** The list defaults to active items; archived items are soft-deleted and never listed. */
const EMPTY: Filters = { search: '', questionType: '', difficulty: '', category: '' };

type Modal = { kind: 'view'; item: BankQuestion } | { kind: 'edit'; item: BankQuestion } | { kind: 'create' } | null;

export function BankQuestionBody({ question: q }: { question: BankQuestion }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-ink">{q.questionText}</p>
        {q.description ? <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{q.description}</p> : null}
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line text-sm sm:grid-cols-4 [&>div]:bg-surface [&>div]:px-3 [&>div]:py-2">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">Default marks</dt>
          <dd className="mt-0.5 tabular-nums text-ink">{formatMarks(q.defaultMarks)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">Negative</dt>
          <dd className="mt-0.5 tabular-nums text-ink">{q.negativeMarks ? `−${formatMarks(q.negativeMarks)}` : 'None'}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">Difficulty</dt>
          <dd className="mt-0.5">
            <DifficultyTag value={q.difficulty} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">Grading</dt>
          <dd className="mt-0.5 text-ink">{isManualQuestion(q) ? 'Manual' : 'Automatic'}</dd>
        </div>
      </dl>
      <QuestionView question={q} />
      {q.explanation ? (
        <p className="border-l-2 border-line pl-3 text-sm leading-relaxed text-ink-muted">
          <span className="font-medium text-ink">Explanation. </span>
          {q.explanation}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-subtle">
        <span className="flex flex-wrap gap-1">
          {q.tags.length
            ? q.tags.map((t) => (
                <span key={t} className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-muted">
                  {t}
                </span>
              ))
            : 'No tags'}
        </span>
        <span>
          Added {formatDate(q.createdAt)} · updated {formatDate(q.updatedAt)}
        </span>
      </div>
    </div>
  );
}

function BankDetailDialog({ seed, onClose, onEdit, onArchive }: { seed: BankQuestion; onClose: () => void; onEdit: (q: BankQuestion) => void; onArchive: (q: BankQuestion) => void }) {
  const detail = useBankQuestion(seed.id, seed);
  const q = detail.data ?? seed;
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Bank question"
      description={`${q.category} · ${questionTypeLabel(q.questionType)}`}
      footer={
        detail.isError ? undefined : (
          <>
            <Button variant="danger" onClick={() => onArchive(q)} className="mr-auto" disabled={detail.isPlaceholderData}>
              <Archive className="size-4" aria-hidden />
              Archive
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => onEdit(q)} disabled={detail.isPlaceholderData}>
              <Pencil className="size-4" aria-hidden />
              Edit
            </Button>
          </>
        )
      }
    >
      {detail.isError ? <ErrorState error={detail.error} onRetry={() => detail.refetch()} /> : <BankQuestionBody question={q} />}
    </Dialog>
  );
}

export function QuestionBankPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [modal, setModal] = useState<Modal>(null);
  const [archiving, setArchiving] = useState<BankQuestion | null>(null);
  const debounced = useDebouncedValue(filters.search.trim(), 400);
  const categories = useBankCategories(true);
  const archive = useArchiveBankQuestion();

  const params: BankListParams = {
    page,
    limit,
    search: debounced || undefined,
    questionType: filters.questionType || undefined,
    difficulty: filters.difficulty || undefined,
    category: filters.category || undefined,
  };
  const list = useBankList(params, true);
  const rows = list.data?.questions ?? [];
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY);
  const categoryOptions = [...new Set([...(categories.data ?? []), ...(filters.category ? [filters.category] : [])])];

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function retryFailed() {
    void queryClient.refetchQueries({ queryKey: queryKeys.quizzes.bank(), type: 'active', predicate: (q) => q.state.status === 'error' });
  }

  function confirmArchive() {
    if (!archiving) return;
    archive.mutate(archiving.id, {
      onSuccess: () => {
        toast.success('Question archived', 'It can no longer be imported. Quizzes that already use it keep their copy.');
        if (rows.length === 1 && page > 1) setPage(page - 1);
        setArchiving(null);
        setModal(null);
      },
      onError: (error) => {
        toast.error('Could not archive question', normalizeApiError(error).message);
        setArchiving(null);
      },
    });
  }

  const actionsFor = (q: BankQuestion) => [
    { key: 'view', label: 'View details', icon: <Eye className="size-4" />, onSelect: () => setModal({ kind: 'view', item: q }) },
    { key: 'edit', label: 'Edit', icon: <Pencil className="size-4" />, onSelect: () => setModal({ kind: 'edit', item: q }) },
    { key: 'archive', label: 'Archive', icon: <Archive className="size-4" />, tone: 'danger' as const, onSelect: () => setArchiving(q) },
  ];

  return (
    <>
      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Question bank</h2>
              <p className="text-xs text-ink-muted">Reusable questions. Importing copies them into a quiz, so attempts never change when the bank does.</p>
            </div>
            <Button size="sm" onClick={() => setModal({ kind: 'create' })}>
              <Plus className="size-4" aria-hidden />
              New question
            </Button>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <Input type="search" value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Search question text or tags" className="pl-9" aria-label="Search question bank" maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Select value={filters.questionType} onChange={(e) => setFilter('questionType', e.target.value as Filters['questionType'])} className="sm:w-44" aria-label="Filter by question type">
                <option value="">All types</option>
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {questionTypeLabel(t)}
                  </option>
                ))}
              </Select>
              <Select value={filters.category} onChange={(e) => setFilter('category', e.target.value)} className="sm:w-44" aria-label="Filter by category" disabled={categories.isPending || categories.isError}>
                <option value="">{categories.isError ? 'Categories unavailable' : 'All categories'}</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select value={filters.difficulty} onChange={(e) => setFilter('difficulty', e.target.value as Filters['difficulty'])} className="sm:w-36" aria-label="Filter by difficulty">
                <option value="">Any difficulty</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {difficultyLabel(d)}
                  </option>
                ))}
              </Select>
              {filtersActive ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFilters(EMPTY);
                    setPage(1);
                  }}
                >
                  <X className="size-4" aria-hidden />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={retryFailed} />
        ) : !list.isPending && rows.length === 0 ? (
          <EmptyState
            icon={<Library className="size-5" aria-hidden />}
            title={filtersActive ? 'No questions match these filters' : 'The question bank is empty'}
            description={filtersActive ? 'Try a different search, type or category.' : 'Add reusable questions here, then import them into any quiz.'}
            action={
              filtersActive ? undefined : (
                <Button size="sm" onClick={() => setModal({ kind: 'create' })}>
                  Add the first question
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-4 pr-3 sm:pl-5">Question</th>
                    <th scope="col" className="px-3 py-2.5">Type</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Category</th>
                    <th scope="col" className="hidden px-3 py-2.5 xl:table-cell">Difficulty</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Marks</th>
                    <th scope="col" className="hidden px-3 py-2.5 2xl:table-cell">Updated</th>
                    <th scope="col" className="py-2.5 pl-3 pr-4 sm:pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3 pl-4 pr-3 sm:pl-5">
                            <Skeleton className="h-4 w-72" />
                            <Skeleton className="mt-1.5 h-3 w-32" />
                          </td>
                          <td className="px-3 py-3">
                            <Skeleton className="h-4 w-24" />
                          </td>
                          <td className="hidden px-3 py-3 lg:table-cell">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="hidden px-3 py-3 xl:table-cell">
                            <Skeleton className="h-4 w-16" />
                          </td>
                          <td className="px-3 py-3">
                            <Skeleton className="ml-auto h-4 w-6" />
                          </td>
                          <td className="hidden px-3 py-3 2xl:table-cell">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="py-3 pl-3 pr-4 sm:pr-5" />
                        </tr>
                      ))
                    : rows.map((q) => (
                        <tr key={q.id} className="group transition-colors hover:bg-surface-2/50">
                          <td className="w-full max-w-0 py-3 pl-4 pr-3 sm:pl-5">
                            <button type="button" onClick={() => setModal({ kind: 'view', item: q })} className="block w-full min-w-0 text-left">
                              <span className="line-clamp-2 font-medium text-ink group-hover:text-primary">{q.questionText}</span>
                              <span className="mt-0.5 block truncate text-xs text-ink-muted">
                                <span className="lg:hidden">{q.category} · </span>
                                {q.tags.length ? q.tags.join(', ') : 'No tags'}
                              </span>
                            </button>
                          </td>
                          <td className="w-px px-3 py-3">
                            <QuestionTypeTag type={q.questionType} />
                          </td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3 text-ink-muted lg:table-cell">{q.category}</td>
                          <td className="hidden w-px px-3 py-3 xl:table-cell">
                            <DifficultyTag value={q.difficulty} />
                          </td>
                          <td className="w-px whitespace-nowrap px-3 py-3 text-right tabular-nums text-ink">{formatMarks(q.defaultMarks)}</td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3 text-xs text-ink-muted 2xl:table-cell">{formatDate(q.updatedAt)}</td>
                          <td className="w-px py-3 pl-3 pr-4 text-right sm:pr-5">
                            <ActionMenu label={`Actions for ${q.questionText.slice(0, 40)}`} items={actionsFor(q)} />
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            <ul className={cn('divide-y divide-line md:hidden', list.isPlaceholderData && 'opacity-60')}>
              {list.isPending
                ? Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="space-y-2 p-4">
                      <Skeleton className="h-4 w-56" />
                      <Skeleton className="h-3 w-32" />
                    </li>
                  ))
                : rows.map((q) => (
                    <li key={q.id} className="flex items-start gap-2 p-3 sm:p-4">
                      <button type="button" onClick={() => setModal({ kind: 'view', item: q })} className="block min-w-0 flex-1 space-y-2 text-left">
                        <span className="line-clamp-2 font-medium text-ink">{q.questionText}</span>
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <QuestionTypeTag type={q.questionType} compact />
                          <DifficultyTag value={q.difficulty} />
                          <span className="text-xs text-ink-muted">{q.category}</span>
                          <span className="text-xs tabular-nums text-ink-muted">{formatMarks(q.defaultMarks)} marks</span>
                        </span>
                      </button>
                      <ActionMenu label={`Actions for ${q.questionText.slice(0, 40)}`} items={actionsFor(q)} />
                    </li>
                  ))}
            </ul>
          </>
        )}

        <Pagination
          meta={list.data?.pagination}
          onPageChange={setPage}
          disabled={list.isFetching}
          pageSizeOptions={PAGE_SIZES}
          onPageSizeChange={(size) => {
            setLimit(size);
            setPage(1);
          }}
        />
      </Card>

      {modal?.kind === 'view' ? (
        <BankDetailDialog key={modal.item.id} seed={modal.item} onClose={() => setModal(null)} onEdit={(q) => setModal({ kind: 'edit', item: q })} onArchive={setArchiving} />
      ) : null}
      {modal?.kind === 'edit' ? (
        <BankQuestionDialog key={modal.item.id} question={modal.item} onClose={() => setModal(null)} onSaved={(q) => setModal({ kind: 'view', item: q })} />
      ) : null}
      {modal?.kind === 'create' ? <BankQuestionDialog onClose={() => setModal(null)} onSaved={(q) => setModal({ kind: 'view', item: q })} /> : null}
      <ConfirmDialog
        open={Boolean(archiving)}
        title="Archive this question?"
        confirmLabel="Archive question"
        loading={archive.isPending}
        onCancel={() => setArchiving(null)}
        onConfirm={confirmArchive}
        description={
          <p>
            It leaves the bank and can no longer be imported. Quizzes that already imported it keep their own copy, and learners&apos; attempts and grades are not affected.
          </p>
        }
      />
    </>
  );
}
