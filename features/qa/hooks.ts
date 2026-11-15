'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeApiError } from '@/lib/api-error';
import { queryKeys } from '@/lib/query-keys';
import { dashboardService } from '@/services/dashboard.service';
import { qaService } from '@/services/qa.service';
import type { CourseQuestion, QuestionDetail, QuestionListParams, QuestionStatus } from '@/types/qa';

export const QA_STAT_KEYS = ['all', 'open', 'resolved', 'unanswered', 'answered'] as const;
export type QaStatKey = (typeof QA_STAT_KEYS)[number];

/** Count queries mirror the list filters so each card matches what clicking it shows. */
const STAT_PARAMS: Record<QaStatKey, Record<string, string>> = {
  all: {},
  open: { status: 'open' },
  resolved: { status: 'resolved' },
  unanswered: { answered: 'unanswered' },
  answered: { answered: 'answered' },
};

/** Totals from list pagination (the backend has no Q&A aggregate endpoint). */
export function useQuestionStats() {
  const results = useQueries({
    queries: QA_STAT_KEYS.map((key) => ({
      queryKey: queryKeys.qa.stat(key),
      queryFn: () => dashboardService.count('/admin/questions-answers', STAT_PARAMS[key]),
    })),
  });
  return QA_STAT_KEYS.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<QaStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

export function useQuestionList(params: QuestionListParams) {
  return useQuery({
    queryKey: queryKeys.qa.list(params),
    queryFn: () => qaService.list(params),
    placeholderData: keepPreviousData,
  });
}

/** Seeded from the list row; the detail adds replies and is re-read on open. */
export function useQuestion(id: string, seed?: CourseQuestion) {
  return useQuery({
    queryKey: queryKeys.qa.detail(id),
    queryFn: () => qaService.get(id),
    placeholderData: seed ? ({ ...seed, replies: [] } satisfies QuestionDetail) : undefined,
    staleTime: 0,
  });
}

function useInvalidateQuestions() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.qa.lists() });
    for (const key of QA_STAT_KEYS) queryClient.invalidateQueries({ queryKey: queryKeys.qa.stat(key) });
    queryClient.invalidateQueries({ queryKey: [...queryKeys.qa.all, 'detail'] });
  };
}

/** A 404 means another admin already deleted the question: refresh what still shows it. */
function useForgetMissingQuestion() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateQuestions();
  return (error: unknown, id: string) => {
    if (normalizeApiError(error).status !== 404) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.qa.detail(id) });
    invalidate();
  };
}

export function usePostReply() {
  const invalidate = useInvalidateQuestions();
  return useMutation({
    mutationFn: ({ id, message, idempotencyKey }: { id: string; message: string; idempotencyKey: string }) =>
      qaService.reply(id, { message, idempotencyKey }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateQuestionStatus() {
  const invalidate = useInvalidateQuestions();
  const forgetMissing = useForgetMissingQuestion();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuestionStatus }) => qaService.updateStatus(id, status),
    onError: (e, { id }) => forgetMissing(e, id),
    onSuccess: () => invalidate(),
  });
}

/** Soft-deleted questions return 404 afterwards, so the cached detail is dropped. */
export function useDeleteQuestion() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateQuestions();
  const forgetMissing = useForgetMissingQuestion();
  return useMutation({
    mutationFn: (id: string) => qaService.remove(id),
    onError: (e, id) => forgetMissing(e, id),
    onSuccess: (_r, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.qa.detail(id) });
      invalidate();
    },
  });
}
