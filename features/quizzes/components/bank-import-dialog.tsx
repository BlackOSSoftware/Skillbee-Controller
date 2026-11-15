'use client';

import { Library, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { normalizeApiError } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import { useToast } from '@/providers/toast-provider';
import { DIFFICULTIES, QUESTION_TYPES, type BankListParams, type Difficulty, type QuestionType } from '@/types/quizzes';
import { useBankCategories, useBankList, useImportFromBank } from '../hooks';
import { DifficultyTag, difficultyLabel, formatMarks, QuestionTypeTag, questionTypeLabel } from '../display';
import { QuestionView } from './question-view';

/** `fromBankSchema` accepts 1–50 ids per request. */
const MAX_IMPORT = 50;

interface BankImportDialogProps {
  quizId: string;
  /** Bank ids this quiz already holds copies of (`questionBankId` on its questions). */
  importedIds: Set<string>;
  onClose: () => void;
}

export function BankImportDialog({ quizId, importedIds, onClose }: BankImportDialogProps) {
  const toast = useToast();
  const importer = useImportFromBank(quizId);
  const categories = useBankCategories(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<QuestionType | ''>('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const debounced = useDebouncedValue(search.trim(), 400);
  const params: BankListParams = {
    page,
    limit: 10,
    search: debounced || undefined,
    questionType: type || undefined,
    difficulty: difficulty || undefined,
    category: category || undefined,
  };
  const list = useBankList(params, true);
  const rows = list.data?.questions ?? [];
  const filtered = Boolean(debounced || type || difficulty || category);
  const repeats = [...selected].filter((id) => importedIds.has(id)).length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_IMPORT) next.add(id);
      return next;
    });
  }

  function filter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function runImport() {
    importer.mutate([...selected], {
      onSuccess: (questions) => {
        toast.success(`${questions.length} question${questions.length === 1 ? '' : 's'} imported`, 'Copies were added to the end of the quiz; later bank edits do not change them.');
        onClose();
      },
      onError: (error) => toast.error('Import failed', normalizeApiError(error).message),
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={importer.isPending}
      size="xl"
      title="Import from question bank"
      description="Selected questions are copied into this quiz. Existing attempts are never changed."
      toolbar={
        <div className="flex flex-col gap-2 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input type="search" value={search} onChange={(e) => filter(setSearch)(e.target.value)} placeholder="Search question text or tags" className="pl-9" aria-label="Search question bank" maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
            <Select value={type} onChange={(e) => filter(setType)(e.target.value as QuestionType | '')} className="lg:w-44" aria-label="Filter by question type">
              <option value="">All types</option>
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {questionTypeLabel(t)}
                </option>
              ))}
            </Select>
            <Select value={category} onChange={(e) => filter(setCategory)(e.target.value)} className="lg:w-40" aria-label="Filter by category" disabled={categories.isPending || categories.isError}>
              <option value="">{categories.isError ? 'Categories unavailable' : 'All categories'}</option>
              {(categories.data ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select value={difficulty} onChange={(e) => filter(setDifficulty)(e.target.value as Difficulty | '')} className="col-span-2 sm:col-span-1 lg:w-36" aria-label="Filter by difficulty">
              <option value="">Any difficulty</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {difficultyLabel(d)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      }
      footer={
        <>
          <p className="mr-auto self-center text-xs text-ink-muted">
            {selected.size} selected
            {selected.size >= MAX_IMPORT ? ` · maximum ${MAX_IMPORT} per import` : ''}
            {repeats ? <span className="text-warning"> · {repeats} already in this quiz and will be added again</span> : null}
          </p>
          <Button variant="secondary" onClick={onClose} disabled={importer.isPending}>
            Cancel
          </Button>
          <Button onClick={runImport} disabled={!selected.size} loading={importer.isPending}>
            Import {selected.size || ''}
          </Button>
        </>
      }
    >
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.isPending && !rows.length ? (
        <EmptyState icon={<Library className="size-5" aria-hidden />} title={filtered ? 'No bank questions match' : 'The question bank is empty'} description={filtered ? undefined : 'Add questions in Quizzes & Results → Question bank.'} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          <ul className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
            {list.isPending
              ? Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="size-4" />
                    <Skeleton className="h-4 w-2/3" />
                  </li>
                ))
              : rows.map((q) => {
                  const checked = selected.has(q.id);
                  const inQuiz = importedIds.has(q.id);
                  return (
                    <li key={q.id} className={cn('px-4 py-3 transition-colors', checked && 'bg-primary/[0.05]')}>
                      <div className="flex items-start gap-3">
                        <input
                          id={`bank-pick-${q.id}`}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(q.id)}
                          disabled={!checked && selected.size >= MAX_IMPORT}
                          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--primary)]"
                        />
                        <div className="min-w-0 flex-1">
                          <label htmlFor={`bank-pick-${q.id}`} className="line-clamp-2 cursor-pointer text-sm font-medium text-ink">
                            {q.questionText}
                          </label>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <QuestionTypeTag type={q.questionType} />
                            <DifficultyTag value={q.difficulty} />
                            <span className="text-xs text-ink-muted">{q.category}</span>
                            {inQuiz ? <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-px text-[11px] font-medium text-primary">In this quiz</span> : null}
                          </div>
                          <details className="mt-1.5">
                            <summary className="cursor-pointer select-none text-xs font-medium text-primary hover:underline">Preview answer key</summary>
                            <div className="mt-2">
                              <QuestionView question={q} />
                            </div>
                          </details>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-ink-muted">{formatMarks(q.defaultMarks)} marks</span>
                      </div>
                    </li>
                  );
                })}
          </ul>
          <Pagination meta={list.data?.pagination} onPageChange={setPage} disabled={list.isFetching} />
        </div>
      )}
    </Dialog>
  );
}
