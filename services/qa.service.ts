import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type {
  CourseQuestion,
  CreateReplyInput,
  QuestionDetail,
  QuestionListParams,
  QuestionReply,
  QuestionStatus,
} from '@/types/qa';

export const qaService = {
  /** GET /admin/questions-answers → `{ success, data: [...], pagination }`. */
  async list(params: QuestionListParams): Promise<{ questions: CourseQuestion[]; pagination: Pagination }> {
    const res = await apiClient.get<ApiEnvelope<CourseQuestion[]> & { pagination: Pagination }>('/admin/questions-answers', {
      params: compactParams(params),
    });
    return { questions: res.data.data, pagination: res.data.pagination };
  },

  /** GET /admin/questions-answers/:id → question with populated student/course and chronological replies. */
  async get(id: string): Promise<QuestionDetail> {
    const res = await apiClient.get<ApiEnvelope<QuestionDetail>>(`/admin/questions-answers/${id}`);
    return res.data.data;
  },

  /** POST /admin/questions-answers/:id/replies → created reply (`createReplyBody`). */
  async reply(id: string, input: CreateReplyInput): Promise<QuestionReply> {
    const res = await apiClient.post<ApiEnvelope<QuestionReply>>(`/admin/questions-answers/${id}/replies`, input);
    return res.data.data;
  },

  /** PATCH /admin/questions-answers/:id/status → `{ status: 'open' | 'resolved' }`. */
  async updateStatus(id: string, status: QuestionStatus): Promise<CourseQuestion> {
    const res = await apiClient.patch<ApiEnvelope<CourseQuestion>>(`/admin/questions-answers/${id}/status`, { status });
    return res.data.data;
  },

  /** DELETE /admin/questions-answers/:id → soft-deletes the question and its replies. */
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/admin/questions-answers/${id}`);
  },
};
