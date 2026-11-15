import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type {
  AttemptGradingView,
  AttemptListParams,
  AttemptListResponse,
  AttemptResult,
  BankListParams,
  BankListResponse,
  BankQuestion,
  BankQuestionInput,
  CreateQuizInput,
  GradeAttemptInput,
  QuestionInput,
  Quiz,
  QuizAnalytics,
  QuizAttemptRow,
  QuizListParams,
  QuizListResponse,
  QuizQuestion,
  QuizStatus,
  UpdateBankQuestionInput,
  UpdateQuizInput,
} from '@/types/quizzes';

type Listed<T> = ApiEnvelope<T> & { pagination: Pagination };

export const quizzesService = {
  /** Response: { success, data: { quizzes }, pagination }. */
  async list(params: QuizListParams): Promise<QuizListResponse> {
    const res = await apiClient.get<Listed<{ quizzes: Quiz[] }>>('/admin/quizzes', { params: compactParams(params) });
    return { quizzes: res.data.data.quizzes, pagination: res.data.pagination };
  },

  async get(id: string): Promise<Quiz> {
    const res = await apiClient.get<ApiEnvelope<{ quiz: Quiz }>>(`/admin/quizzes/${id}`);
    return res.data.data.quiz;
  },

  async questions(id: string): Promise<QuizQuestion[]> {
    const res = await apiClient.get<ApiEnvelope<{ questions: QuizQuestion[] }>>(`/admin/quizzes/${id}/questions`);
    return res.data.data.questions;
  },

  async analytics(id: string): Promise<QuizAnalytics> {
    const res = await apiClient.get<ApiEnvelope<{ analytics: QuizAnalytics }>>(`/admin/quizzes/${id}/analytics`);
    return res.data.data.analytics;
  },

  async create(input: CreateQuizInput): Promise<Quiz> {
    const res = await apiClient.post<QuizEnvelope>('/admin/quizzes', input);
    return res.data.data.quiz;
  },

  async update(id: string, input: UpdateQuizInput): Promise<Quiz> {
    const res = await apiClient.patch<QuizEnvelope>(`/admin/quizzes/${id}`, input);
    return res.data.data.quiz;
  },

  /** Archives and soft-deletes; attempts are kept for history. */
  async remove(id: string): Promise<Quiz> {
    const res = await apiClient.delete<QuizEnvelope>(`/admin/quizzes/${id}`);
    return res.data.data.quiz;
  },

  async changeStatus(id: string, status: QuizStatus): Promise<Quiz> {
    const res = await apiClient.patch<QuizEnvelope>(`/admin/quizzes/${id}/status`, { status });
    return res.data.data.quiz;
  },

  /** Creates a draft copy with all active questions. */
  async duplicate(id: string): Promise<Quiz> {
    const res = await apiClient.post<QuizEnvelope>(`/admin/quizzes/${id}/duplicate`);
    return res.data.data.quiz;
  },

  async addQuestion(quizId: string, input: QuestionInput): Promise<QuizQuestion> {
    const res = await apiClient.post<QuestionEnvelope>(`/admin/quizzes/${quizId}/questions`, input);
    return res.data.data.question;
  },

  async updateQuestion(questionId: string, input: Partial<QuestionInput>): Promise<QuizQuestion> {
    const res = await apiClient.patch<QuestionEnvelope>(`/admin/quizzes/questions/${questionId}`, input);
    return res.data.data.question;
  },

  /** Archives the question; past attempts keep their snapshot. */
  async deleteQuestion(questionId: string): Promise<QuizQuestion> {
    const res = await apiClient.delete<QuestionEnvelope>(`/admin/quizzes/questions/${questionId}`);
    return res.data.data.question;
  },

  /** `questionIds` must list every active question exactly once. */
  async reorderQuestions(quizId: string, questionIds: string[]): Promise<QuizQuestion[]> {
    const res = await apiClient.patch<ApiEnvelope<{ questions: QuizQuestion[] }>>(`/admin/quizzes/${quizId}/questions/reorder`, { questionIds });
    return res.data.data.questions;
  },

  /** Copies bank items into the quiz (1–50 per call). */
  async importFromBank(quizId: string, questionBankIds: string[]): Promise<QuizQuestion[]> {
    const res = await apiClient.post<ApiEnvelope<{ questions: QuizQuestion[] }>>(`/admin/quizzes/${quizId}/questions/from-bank`, { questionBankIds });
    return res.data.data.questions;
  },

  /** Same row shape and filters as GET /admin/quiz-attempts, scoped to one quiz. */
  async attempts(quizId: string, params: Omit<AttemptListParams, 'quizId'>): Promise<AttemptListResponse> {
    const res = await apiClient.get<Listed<{ attempts: QuizAttemptRow[] }>>(`/admin/quizzes/${quizId}/attempts`, { params: compactParams(params) });
    return { attempts: res.data.data.attempts, pagination: res.data.pagination };
  },
};

type QuizEnvelope = ApiEnvelope<{ quiz: Quiz }>;
type QuestionEnvelope = ApiEnvelope<{ question: QuizQuestion }>;

export const quizAttemptsService = {
  /** Response: { success, data: { attempts }, pagination }. */
  async list(params: AttemptListParams): Promise<AttemptListResponse> {
    const res = await apiClient.get<Listed<{ attempts: QuizAttemptRow[] }>>('/admin/quiz-attempts', { params: compactParams(params) });
    return { attempts: res.data.data.attempts, pagination: res.data.pagination };
  },

  /** Needs quizzes.attempts.read or quizzes.results.read. */
  async detail(id: string): Promise<AttemptResult> {
    const res = await apiClient.get<ApiEnvelope<{ result: AttemptResult }>>(`/admin/quiz-attempts/${id}`);
    return res.data.data.result;
  },

  /** Needs quizzes.results.read; same admin result payload. */
  async result(id: string): Promise<AttemptResult> {
    const res = await apiClient.get<ApiEnvelope<{ result: AttemptResult }>>(`/admin/quiz-attempts/${id}/result`);
    return res.data.data.result;
  },

  /** Needs quizzes.grade; includes the full admin result plus rubrics for manually graded questions. */
  async grading(id: string): Promise<AttemptGradingView> {
    const res = await apiClient.get<ApiEnvelope<AttemptGradingView>>(`/admin/quiz-attempts/${id}/grading`);
    return res.data.data;
  },

  async grade(id: string, input: GradeAttemptInput): Promise<AttemptResult> {
    const res = await apiClient.patch<ApiEnvelope<{ result: AttemptResult }>>(`/admin/quiz-attempts/${id}/grade`, input);
    return res.data.data.result;
  },
};

export const questionBankService = {
  /** Response: { success, data: { questions }, pagination }. Defaults to active items. */
  async list(params: BankListParams): Promise<BankListResponse> {
    const res = await apiClient.get<Listed<{ questions: BankQuestion[] }>>('/admin/question-bank', { params: compactParams(params) });
    return { questions: res.data.data.questions, pagination: res.data.pagination };
  },

  /** Distinct categories of active items, sorted. */
  async categories(): Promise<string[]> {
    const res = await apiClient.get<ApiEnvelope<{ categories: string[] }>>('/admin/question-bank/categories');
    return res.data.data.categories;
  },

  async get(id: string): Promise<BankQuestion> {
    const res = await apiClient.get<BankEnvelope>(`/admin/question-bank/${id}`);
    return res.data.data.question;
  },

  async create(input: BankQuestionInput): Promise<BankQuestion> {
    const res = await apiClient.post<BankEnvelope>('/admin/question-bank', input);
    return res.data.data.question;
  },

  async update(id: string, input: UpdateBankQuestionInput): Promise<BankQuestion> {
    const res = await apiClient.patch<BankEnvelope>(`/admin/question-bank/${id}`, input);
    return res.data.data.question;
  },

  /** Archives and soft-deletes: the item leaves the bank; quiz copies made earlier are unaffected. */
  async archive(id: string): Promise<BankQuestion> {
    const res = await apiClient.delete<BankEnvelope>(`/admin/question-bank/${id}`);
    return res.data.data.question;
  },
};

type BankEnvelope = ApiEnvelope<{ question: BankQuestion }>;
