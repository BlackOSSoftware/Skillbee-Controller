'use client';

import { CheckCircle2, CircleDot, Eye, MessageSquareText, Search, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ActionMenu, type MenuItem } from '@/components/ui/menu';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { RefreshButton } from '@/components/ui/refresh-button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/cn';
import { formatDate, formatRelative } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { useCourseCatalog } from '@/features/shared/lookups';
import { formatDateTime } from '@/features/assignments/display';
import type { AnsweredFilter, CourseQuestion, QuestionListParams, QuestionSort, QuestionStatus } from '@/types/qa';
import { LearnerAvatar } from '@/features/reviews/display';
import { qaStudentName, QUESTION_SORT_LABEL, QuestionStatusBadge } from '../display';
import { QA_STAT_KEYS, useQuestionList, useQuestionStats, type QaStatKey } from '../hooks';
import { QuestionDrawer } from './question-drawer';
import { DeleteQuestionDialog, QuestionStatusDialog } from './question-actions';

const PAGE_SIZES = [10, 20, 50];

const STAT_CARD: Record<QaStatKey, { label: string; hint: string; icon: typeof MessageSquareText; tone: 'purple' | 'sky' | 'teal' | 'amber' | 'coral' }> = {
  all: { label: 'Total questions', hint: 'Excludes deleted', icon: MessageSquareText, tone: 'purple' },
  open: { label: 'Open', hint: 'Awaiting an answer', icon: CircleDot, tone: 'sky' },
  resolved: { label: 'Resolved', hint: 'Closed by staff', icon: CheckCircle2, tone: 'teal' },
  unanswered: { label: 'Unanswered', hint: 'No replies yet', icon: MessageSquareText, tone: 'amber' },
  answered: { label: 'Answered', hint: 'Has at least one reply', icon: MessageSquareText, tone: 'coral' },
};

function ReplyCount({ count }: { count: number }) {
  return count === 0 ? (
    <Badge tone="warning">No replies</Badge>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink">
      <MessageSquareText className="size-3.5 text-ink-subtle" aria-hidden />
      {count}
    </span>
  );
}

export function QuestionsManagement() {
  const catalog = useCourseCatalog();
  const stats = useQuestionStats();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<QuestionStatus | ''>('');
  const [answered, setAnswered] = useState<Exclude<AnsweredFilter, 'all'> | ''>('');
  const [courseId, setCourseId] = useState('');
  const [sort, setSort] = useState<QuestionSort>('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [viewing, setViewing] = useState<CourseQuestion | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ question: CourseQuestion; target: QuestionStatus } | null>(null);
  const [deleting, setDeleting] = useState<CourseQuestion | null>(null);

  const debounced = useDebouncedValue(search.trim(), 350);
  const params: QuestionListParams = {
    page,
    limit,
    search: debounced || undefined,
    status: status || undefined,
    answered: answered || undefined,
    courseId: courseId || undefined,
    sort: sort === 'newest' ? undefined : sort,
  };
  const list = useQuestionList(params);
  const rows = list.data?.questions ?? [];
  const filtered = Boolean(debounced || status || answered || courseId);

  const resetPage =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  function applyStat(key: QaStatKey) {
    setStatus(key === 'open' || key === 'resolved' ? key : '');
    setAnswered(key === 'unanswered' || key === 'answered' ? key : '');
    setPage(1);
  }

  const statActive = (key: QaStatKey) =>
    key === 'all' ? !status && !answered : key === 'open' || key === 'resolved' ? status === key && !answered : !status && answered === key;

  function clearAll() {
    setSearch('');
    setStatus('');
    setAnswered('');
    setCourseId('');
    setSort('newest');
    setPage(1);
  }

  const menu = (q: CourseQuestion): MenuItem[] => [
    { key: 'view', label: 'View conversation', icon: <Eye className="size-4" />, onSelect: () => setViewing(q) },
    ...(q.status === 'open'
      ? [{ key: 'resolve', label: 'Mark as resolved…', icon: <CheckCircle2 className="size-4" />, onSelect: () => setStatusDialog({ question: q, target: 'resolved' }) }]
      : [{ key: 'reopen', label: 'Reopen…', icon: <CircleDot className="size-4" />, onSelect: () => setStatusDialog({ question: q, target: 'open' }) }]),
    { key: 'delete', label: 'Delete…', icon: <Trash2 className="size-4" />, tone: 'danger', onSelect: () => setDeleting(q) },
  ];

  return (
    <>
      <PageHeader title="Questions & Answers" description="Student questions across courses — answer, resolve and moderate." actions={<RefreshButton queryKeys={[queryKeys.qa.all]} />} />

      <section aria-label="Question overview" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {QA_STAT_KEYS.map((key) => {
          const meta = STAT_CARD[key];
          const Icon = meta.icon;
          return (
            <KpiCard
              key={key}
              label={meta.label}
              hint={meta.hint}
              icon={Icon}
              tone={meta.tone}
              value={stats[key].value}
              isLoading={stats[key].isLoading}
              error={stats[key].error}
              active={statActive(key)}
              onClick={() => applyStat(key)}
            />
          );
        })}
      </section>

      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line p-3 sm:p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{filtered ? 'Filtered questions' : 'All questions'}</h2>
            <p className="text-xs text-ink-muted">Search matches the question text or the student&apos;s name and email.</p>
          </div>
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <div className="flex min-w-0 gap-2 xl:w-72 xl:shrink-0">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
                <Input type="search" value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} placeholder="Search questions" className="pl-9" aria-label="Search questions" />
              </div>
              {filtered || sort !== 'newest' ? (
                <span className="shrink-0 xl:hidden">
                  <Button variant="ghost" onClick={clearAll}>
                    <X className="size-4" aria-hidden />
                    Clear
                  </Button>
                </span>
              ) : null}
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 md:grid-cols-4">
              <Select value={status} onChange={(e) => resetPage(setStatus)(e.target.value as QuestionStatus | '')} aria-label="Filter by status">
                <option value="">Any status</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </Select>
              <Select
                value={answered}
                onChange={(e) => resetPage(setAnswered)(e.target.value as Exclude<AnsweredFilter, 'all'> | '')}
                aria-label="Filter by answered state"
              >
                <option value="">Any answers</option>
                <option value="unanswered">Unanswered</option>
                <option value="answered">Answered</option>
              </Select>
              <Select value={courseId} onChange={(e) => resetPage(setCourseId)(e.target.value)} className="min-w-0" aria-label="Filter by course" disabled={catalog.query.isPending || catalog.query.isError}>
                <option value="">{catalog.query.isError ? 'Courses unavailable' : 'All courses'}</option>
                {catalog.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {c.status !== 'published' ? ` (${c.status})` : ''}
                  </option>
                ))}
              </Select>
              <Select value={sort} onChange={(e) => resetPage(setSort)(e.target.value as QuestionSort)} aria-label="Sort questions">
                {Object.entries(QUESTION_SORT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            {filtered || sort !== 'newest' ? (
              <span className="hidden shrink-0 xl:block">
                <Button variant="ghost" onClick={clearAll}>
                  <X className="size-4" aria-hidden />
                  Clear
                </Button>
              </span>
            ) : null}
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isPending && !rows.length ? (
          <EmptyState
            icon={<MessageSquareText className="size-5" aria-hidden />}
            title={filtered ? 'No questions match these filters' : 'No questions yet'}
            description={filtered ? 'Try another search, status, answer state or course.' : 'Student questions appear here when enrolled learners ask on a course.'}
            action={
              filtered ? (
                <Button size="sm" variant="secondary" onClick={clearAll}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="relative hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="whitespace-nowrap border-b border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2.5 pl-5 pr-3">Student</th>
                    <th scope="col" className="px-3 py-2.5">Question</th>
                    <th scope="col" className="px-3 py-2.5">Replies</th>
                    <th scope="col" className="px-3 py-2.5">Status</th>
                    <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Asked</th>
                    <th scope="col" className="py-2.5 pl-3 pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
                  {list.isPending
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="py-3.5 pl-5 pr-3">
                            <div className="flex items-center gap-3">
                              <Skeleton className="size-8 rounded-full" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-3.5 w-28" />
                                <Skeleton className="h-3 w-36" />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-3.5 w-48" />
                            <Skeleton className="mt-1.5 h-3 w-64" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-3.5 w-16" />
                          </td>
                          <td className="px-3 py-3.5">
                            <Skeleton className="h-5 w-16" />
                          </td>
                          <td className="hidden px-3 py-3.5 lg:table-cell">
                            <Skeleton className="h-3.5 w-20" />
                          </td>
                          <td className="py-3.5 pl-3 pr-5" />
                        </tr>
                      ))
                    : rows.map((q) => (
                        <tr key={q.id} className="group align-top transition-colors hover:bg-surface-2/50">
                          <td className="py-3.5 pl-5 pr-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <LearnerAvatar student={q.student ?? null} />
                              <div className="min-w-0 max-w-44">
                                <p className="truncate font-medium text-ink">{qaStudentName(q.student)}</p>
                                <p className="truncate text-xs text-ink-muted">{q.student?.email ?? '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="w-full min-w-64 max-w-0 px-3 py-3.5">
                            <button type="button" onClick={() => setViewing(q)} className="block w-full text-left">
                              <span className="block truncate font-medium text-ink group-hover:text-primary">{q.title}</span>
                              <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">{q.description}</span>
                              <span className="mt-1 block truncate text-[11px] text-ink-subtle">{q.course?.title ?? 'Course unavailable'}</span>
                            </button>
                          </td>
                          <td className="w-px whitespace-nowrap px-3 py-3.5">
                            <ReplyCount count={q.replyCount} />
                          </td>
                          <td className="w-px px-3 py-3.5">
                            <QuestionStatusBadge status={q.status} />
                          </td>
                          <td className="hidden w-px whitespace-nowrap px-3 py-3.5 text-xs text-ink-muted lg:table-cell" title={formatDateTime(q.createdAt)}>
                            {formatDate(q.createdAt)}
                            <span className="block text-[11px] text-ink-subtle">{formatRelative(q.lastActivityAt)}</span>
                          </td>
                          <td className="w-px py-3 pl-3 pr-5 text-right">
                            <ActionMenu label={`Actions for question by ${qaStudentName(q.student)}`} items={menu(q)} />
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
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </li>
                  ))
                : rows.map((q) => (
                    <li key={q.id} className="flex items-start gap-3 p-4">
                      <LearnerAvatar student={q.student ?? null} />
                      <button type="button" onClick={() => setViewing(q)} className="min-w-0 flex-1 space-y-1 text-left">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-ink">{qaStudentName(q.student)}</span>
                          <QuestionStatusBadge status={q.status} />
                        </span>
                        <span className="flex items-center gap-2 text-[11px] text-ink-subtle">
                          <ReplyCount count={q.replyCount} />
                          <span>{formatDate(q.createdAt)}</span>
                        </span>
                        <span className="block truncate text-sm text-ink">{q.title}</span>
                        <span className="line-clamp-2 text-xs text-ink-muted">{q.description}</span>
                        <span className="block truncate text-[11px] text-ink-subtle">{q.course?.title ?? 'Course unavailable'}</span>
                      </button>
                      <ActionMenu label={`Actions for question by ${qaStudentName(q.student)}`} items={menu(q)} />
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

      {viewing ? <QuestionDrawer key={viewing.id} seed={viewing} onClose={() => setViewing(null)} /> : null}
      {statusDialog ? <QuestionStatusDialog question={statusDialog.question} target={statusDialog.target} onClose={() => setStatusDialog(null)} /> : null}
      {deleting ? <DeleteQuestionDialog question={deleting} onClose={() => setDeleting(null)} /> : null}
    </>
  );
}
