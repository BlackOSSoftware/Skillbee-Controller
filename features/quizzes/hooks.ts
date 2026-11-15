'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { PERSIST_META } from '@/lib/query-persist';
import { hasPermissions } from '@/lib/roles';
import { dashboardService } from '@/services/dashboard.service';
import { enrollmentsService } from '@/services/enrollments.service';
import { questionBankService, quizAttemptsService, quizzesService } from '@/services/quizzes.service';
import { usersService } from '@/services/users.service';
import type { AuthUser } from '@/types/auth';
import type { EnrollmentListParams } from '@/types/enrollments';
import type {
  AttemptGradingView,
  AttemptListParams,
  AttemptResult,
  BankListParams,
  BankQuestion,
  BankQuestionInput,
  CreateQuizInput,
  GradeAttemptInput,
  QuestionInput,
  Quiz,
  QuizAttemptRow,
  QuizListParams,
  QuizStatus,
  UpdateBankQuestionInput,
  UpdateQuizInput,
} from '@/types/quizzes';

const any = (u: AuthUser | null, codes: string[]) => codes.some((c) => hasPermissions(u, [c]));

/** Mirrors the route guards in adminQuiz.routes.js and quizQuestionBank.routes.js. */
export const quizPolicy = {
  canCreate: (u: AuthUser | null) => hasPermissions(u, ['quizzes.create']),
  canUpdate: (u: AuthUser | null) => hasPermissions(u, ['quizzes.update']),
  canDelete: (u: AuthUser | null) => hasPermissions(u, ['quizzes.delete']),
  canPublish: (u: AuthUser | null) => hasPermissions(u, ['quizzes.publish']),
  canManageQuestions: (u: AuthUser | null) => hasPermissions(u, ['quizzes.questions.manage']),
  canReadResults: (u: AuthUser | null) => hasPermissions(u, ['quizzes.results.read']),
  canReadQuestions: (u: AuthUser | null) => any(u, ['quizzes.questions.manage', 'quizzes.read']),
  canReadAnalytics: (u: AuthUser | null) => hasPermissions(u, ['quizzes.analytics.read']),
  canReadAttempts: (u: AuthUser | null) => hasPermissions(u, ['quizzes.attempts.read']),
  canReadResult: (u: AuthUser | null) => any(u, ['quizzes.attempts.read', 'quizzes.results.read']),
  canGrade: (u: AuthUser | null) => hasPermissions(u, ['quizzes.grade']),
  /** Every bank route (read and write) sits behind this one permission. */
  canReadBank: (u: AuthUser | null) => hasPermissions(u, ['quizzes.question-bank.manage']),
};

export function useQuizList(params: QuizListParams) {
  return useQuery({
    queryKey: queryKeys.quizzes.list(params),
    queryFn: () => quizzesService.list(params),
    placeholderData: keepPreviousData,
  });
}

/** One title-sorted page backs the quiz filter and resolves quiz titles on attempt rows. */
export const QUIZ_CATALOG_PARAMS: QuizListParams = { page: 1, limit: 100, sortBy: 'title', sortOrder: 'asc' };

export function useQuizCatalog(enabled: boolean) {
  const query = useQuery({
    queryKey: queryKeys.quizzes.list(QUIZ_CATALOG_PARAMS),
    queryFn: () => quizzesService.list(QUIZ_CATALOG_PARAMS),
    enabled,
    staleTime: 5 * 60_000,
  });
  const byId = new Map<string, Quiz>((query.data?.quizzes ?? []).map((q) => [q.id, q]));
  return { query, byId };
}

/** Quizzes beyond the catalog page (rare) are looked up individually. */
export function useQuizLookup(ids: string[], catalog: Map<string, Quiz>, ready: boolean) {
  const missing = ready ? [...new Set(ids)].filter((id) => !catalog.has(id)).slice(0, 10) : [];
  const results = useQueries({
    queries: missing.map((id) => ({
      queryKey: queryKeys.quizzes.detail(id),
      queryFn: () => quizzesService.get(id),
      staleTime: 10 * 60_000,
      retry: false,
    })),
  });
  const byId = new Map(catalog);
  results.forEach((r) => {
    if (r.data) byId.set(r.data.id, r.data);
  });
  return byId;
}

/** Fresh quiz record for the workspace; the list row shows until it settles. */
export function useQuizDetail(id: string, seed: Quiz) {
  return useQuery({ queryKey: queryKeys.quizzes.detail(id), queryFn: () => quizzesService.get(id), placeholderData: seed });
}

function useApplyQuiz() {
  const queryClient = useQueryClient();
  return (quiz: Quiz, { removed = false }: { removed?: boolean } = {}) => {
    if (removed) queryClient.removeQueries({ queryKey: queryKeys.quizzes.detail(quiz.id) });
    else queryClient.setQueryData(queryKeys.quizzes.detail(quiz.id), quiz);
    queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.lists() });
    for (const key of ['quizzes', 'published'] satisfies QuizStatKey[]) queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.stat(key) });
  };
}

export function useCreateQuiz() {
  const apply = useApplyQuiz();
  return useMutation({ mutationFn: (input: CreateQuizInput) => quizzesService.create(input), onSuccess: (q) => apply(q) });
}

export function useUpdateQuiz() {
  const apply = useApplyQuiz();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateQuizInput }) => quizzesService.update(id, input), onSuccess: (q) => apply(q) });
}

export function useQuizStatus() {
  const apply = useApplyQuiz();
  return useMutation({ mutationFn: ({ id, status }: { id: string; status: QuizStatus }) => quizzesService.changeStatus(id, status), onSuccess: (q) => apply(q) });
}

export function useDuplicateQuiz() {
  const apply = useApplyQuiz();
  return useMutation({ mutationFn: (id: string) => quizzesService.duplicate(id), onSuccess: (q) => apply(q) });
}

export function useDeleteQuiz() {
  const apply = useApplyQuiz();
  return useMutation({ mutationFn: (id: string) => quizzesService.remove(id), onSuccess: (q) => apply(q, { removed: true }) });
}

/** Question changes alter the quiz total, so the quiz record and lists refresh too. */
function useInvalidateQuestions(quizId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.questions(quizId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.detail(quizId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.lists() });
  };
}

export function useAddQuestion(quizId: string) {
  const invalidate = useInvalidateQuestions(quizId);
  return useMutation({ mutationFn: (input: QuestionInput) => quizzesService.addQuestion(quizId, input), onSuccess: invalidate });
}

export function useUpdateQuestion(quizId: string) {
  const invalidate = useInvalidateQuestions(quizId);
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<QuestionInput> }) => quizzesService.updateQuestion(id, input), onSuccess: invalidate });
}

export function useDeleteQuestion(quizId: string) {
  const invalidate = useInvalidateQuestions(quizId);
  return useMutation({ mutationFn: (questionId: string) => quizzesService.deleteQuestion(questionId), onSuccess: invalidate });
}

export function useReorderQuestions(quizId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questionIds: string[]) => quizzesService.reorderQuestions(quizId, questionIds),
    onSuccess: (questions) => queryClient.setQueryData(queryKeys.quizzes.questions(quizId), questions),
  });
}

export function useImportFromBank(quizId: string) {
  const invalidate = useInvalidateQuestions(quizId);
  return useMutation({ mutationFn: (ids: string[]) => quizzesService.importFromBank(quizId, ids), onSuccess: invalidate });
}

export function useQuizAttempts(quizId: string, params: Omit<AttemptListParams, 'quizId'>, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.quizzes.quizAttempts(quizId, params),
    queryFn: () => quizzesService.attempts(quizId, params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useQuizQuestions(id: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.quizzes.questions(id), queryFn: () => quizzesService.questions(id), enabled });
}

export function useQuizAnalytics(id: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.quizzes.analytics(id), queryFn: () => quizzesService.analytics(id), enabled });
}

export const QUIZ_STAT_KEYS = ['quizzes', 'published', 'attempts', 'pending', 'evaluated', 'bank'] as const;
export type QuizStatKey = (typeof QUIZ_STAT_KEYS)[number];

const STAT_SOURCES: Record<QuizStatKey, { path: string; params: Record<string, string> }> = {
  quizzes: { path: '/admin/quizzes', params: {} },
  published: { path: '/admin/quizzes', params: { status: 'published' } },
  attempts: { path: '/admin/quiz-attempts', params: {} },
  pending: { path: '/admin/quiz-attempts', params: { status: 'evaluating' } },
  evaluated: { path: '/admin/quiz-attempts', params: { status: 'evaluated' } },
  bank: { path: '/admin/question-bank', params: {} },
};

/** Totals from list pagination (no aggregate endpoint); persisted across reloads. */
export function useQuizStats(user: AuthUser | null) {
  const allowed: Record<QuizStatKey, boolean> = {
    quizzes: true,
    published: true,
    attempts: quizPolicy.canReadAttempts(user),
    pending: quizPolicy.canReadAttempts(user),
    evaluated: quizPolicy.canReadAttempts(user),
    bank: quizPolicy.canReadBank(user),
  };
  const results = useQueries({
    queries: QUIZ_STAT_KEYS.map((key) => ({
      queryKey: queryKeys.quizzes.stat(key),
      queryFn: () => dashboardService.count(STAT_SOURCES[key].path, STAT_SOURCES[key].params),
      enabled: allowed[key],
      meta: PERSIST_META,
    })),
  });
  return QUIZ_STAT_KEYS.reduce(
    (acc, key, i) => {
      acc[key] = { allowed: allowed[key], value: results[i].data ?? null, isLoading: results[i].isPending && allowed[key], error: results[i].error };
      return acc;
    },
    {} as Record<QuizStatKey, { allowed: boolean; value: number | null; isLoading: boolean; error: unknown }>
  );
}

export function useAttemptsList(params: AttemptListParams, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.quizzes.attemptList(params),
    queryFn: () => quizAttemptsService.list(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export interface Learner {
  name: string;
  email: string;
}

/**
 * Attempt rows only carry `studentId`. Learners are enrolled in the attempt's course, so one
 * course-filtered enrollment page per course (shared enrollments cache) resolves most names;
 * anyone left over is looked up individually when the viewer can read users.
 */
export function useAttemptLearners(rows: QuizAttemptRow[], canReadUsers: boolean) {
  const courseIds = [...new Set(rows.map((r) => r.courseId))].slice(0, 5);
  const enrollmentQueries = useQueries({
    queries: courseIds.map((courseId) => {
      const params: EnrollmentListParams = { page: 1, limit: 100, courseId };
      return { queryKey: queryKeys.enrollments.list(params), queryFn: () => enrollmentsService.list(params), staleTime: 5 * 60_000 };
    }),
  });
  const byId = new Map<string, Learner>();
  for (const q of enrollmentQueries) {
    for (const e of q.data?.enrollments ?? []) {
      if (e.student) byId.set(e.studentId, { name: [e.student.firstName, e.student.lastName].filter(Boolean).join(' ') || e.student.email, email: e.student.email });
    }
  }
  const settled = enrollmentQueries.every((q) => !q.isPending);
  const missing = settled && canReadUsers ? [...new Set(rows.map((r) => r.studentId))].filter((id) => !byId.has(id)).slice(0, 10) : [];
  const userQueries = useQueries({
    queries: missing.map((id) => ({ queryKey: queryKeys.users.detail(id), queryFn: () => usersService.get(id), staleTime: 10 * 60_000, retry: false })),
  });
  userQueries.forEach((q, i) => {
    const u = q.data;
    if (u) byId.set(missing[i], { name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email, email: u.email });
  });
  return { byId, isPending: !settled || userQueries.some((q) => q.isPending) };
}

/**
 * Graders load the grading view (admin result + rubrics) in one request. Read-only viewers use
 * the results endpoint when they hold quizzes.results.read, otherwise the attempt detail.
 */
export function useAttemptReview(id: string, canGrade: boolean, canRead: boolean, canReadResults: boolean) {
  const grading = useQuery({
    queryKey: [...queryKeys.quizzes.attempt(id), 'grading'],
    queryFn: () => quizAttemptsService.grading(id),
    enabled: canGrade,
  });
  const result = useQuery({
    queryKey: [...queryKeys.quizzes.attempt(id), 'result'],
    queryFn: () => (canReadResults ? quizAttemptsService.result(id) : quizAttemptsService.detail(id)),
    enabled: !canGrade && canRead,
  });
  const active = canGrade ? grading : result;
  return {
    result: canGrade ? grading.data?.result : result.data,
    rubrics: new Map((grading.data?.pendingGrades ?? []).map((g) => [g.questionId, g.gradingRubric])),
    isPending: active.isPending && (canGrade || canRead),
    error: active.error,
    refetch: active.refetch,
    isFetching: active.isFetching,
  };
}

export function useGradeAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: GradeAttemptInput }) => quizAttemptsService.grade(id, input),
    onSuccess: (result: AttemptResult, { id }) => {
      queryClient.setQueryData<AttemptGradingView>([...queryKeys.quizzes.attempt(id), 'grading'], (old) => (old ? { ...old, status: result.status, evaluationStatus: result.evaluationStatus, result } : old));
      queryClient.setQueryData([...queryKeys.quizzes.attempt(id), 'result'], result);
      queryClient.setQueriesData<{ attempts: QuizAttemptRow[] }>({ queryKey: queryKeys.quizzes.attemptLists() }, (old) =>
        old?.attempts
          ? {
              ...old,
              attempts: old.attempts.map((a) =>
                a.id === id
                  ? { ...a, status: result.status, evaluationStatus: result.evaluationStatus, obtainedMarks: result.obtainedMarks ?? a.obtainedMarks, percentage: result.percentage ?? a.percentage, passed: result.passed ?? a.passed }
                  : a
              ),
            }
          : old
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.attemptLists() });
      for (const key of ['attempts', 'pending', 'evaluated'] satisfies QuizStatKey[]) queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.stat(key) });
      queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.analytics(result.quizId) });
    },
  });
}

export function useBankList(params: BankListParams, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.quizzes.bankList(params),
    queryFn: () => questionBankService.list(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useBankCategories(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.quizzes.bankCategories(),
    queryFn: () => questionBankService.categories(),
    enabled,
    staleTime: 10 * 60_000,
  });
}

/** Fresh bank item for the detail view; the list row shows until it settles. */
export function useBankQuestion(id: string | null, seed?: BankQuestion) {
  return useQuery({
    queryKey: queryKeys.quizzes.bankDetail(id ?? ''),
    queryFn: () => questionBankService.get(id as string),
    enabled: Boolean(id),
    placeholderData: seed,
  });
}

/** Lists, categories and the bank total can all change after a write. */
function useApplyBankItem() {
  const queryClient = useQueryClient();
  return (item: BankQuestion, { removed = false }: { removed?: boolean } = {}) => {
    if (removed) queryClient.removeQueries({ queryKey: queryKeys.quizzes.bankDetail(item.id) });
    else queryClient.setQueryData(queryKeys.quizzes.bankDetail(item.id), item);
    queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.bankLists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.bankCategories() });
    queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.stat('bank') });
  };
}

export function useCreateBankQuestion() {
  const apply = useApplyBankItem();
  return useMutation({ mutationFn: (input: BankQuestionInput) => questionBankService.create(input), onSuccess: (item) => apply(item) });
}

export function useUpdateBankQuestion() {
  const apply = useApplyBankItem();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBankQuestionInput }) => questionBankService.update(id, input),
    onSuccess: (item) => apply(item),
  });
}

export function useArchiveBankQuestion() {
  const apply = useApplyBankItem();
  return useMutation({ mutationFn: (id: string) => questionBankService.archive(id), onSuccess: (item) => apply(item, { removed: true }) });
}
