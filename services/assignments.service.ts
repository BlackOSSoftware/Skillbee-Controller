import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type {
  Assignment,
  AssignmentListParams,
  AssignmentListResponse,
  AssignmentStatus,
  CreateAssignmentInput,
  GradeSubmissionInput,
  Submission,
  SubmissionListParams,
  SubmissionListResponse,
  UpdateAssignmentInput,
} from '@/types/assignments';

type AssignmentEnvelope = ApiEnvelope<{ assignment: Assignment }>;
type SubmissionEnvelope = ApiEnvelope<{ submission: Submission }>;

export const assignmentsService = {
  /** Response: { success, data: { assignments }, pagination }. */
  async list(params: AssignmentListParams): Promise<AssignmentListResponse> {
    const res = await apiClient.get<ApiEnvelope<{ assignments: Assignment[] }> & { pagination: Pagination }>('/admin/assignments', {
      params: compactParams(params),
    });
    return { assignments: res.data.data.assignments, pagination: res.data.pagination };
  },

  async get(id: string): Promise<Assignment> {
    const res = await apiClient.get<AssignmentEnvelope>(`/admin/assignments/${id}`);
    return res.data.data.assignment;
  },

  async create(input: CreateAssignmentInput): Promise<Assignment> {
    const res = await apiClient.post<AssignmentEnvelope>('/admin/assignments', input);
    return res.data.data.assignment;
  },

  async update(id: string, input: UpdateAssignmentInput): Promise<Assignment> {
    const res = await apiClient.patch<AssignmentEnvelope>(`/admin/assignments/${id}`, input);
    return res.data.data.assignment;
  },

  /** Soft-delete; assignments with submissions are archived first so history is preserved. */
  async remove(id: string): Promise<Assignment> {
    const res = await apiClient.delete<AssignmentEnvelope>(`/admin/assignments/${id}`);
    return res.data.data.assignment;
  },

  async changeStatus(id: string, status: AssignmentStatus): Promise<Assignment> {
    const res = await apiClient.patch<AssignmentEnvelope>(`/admin/assignments/${id}/status`, { status });
    return res.data.data.assignment;
  },

  async submissions(assignmentId: string, params: SubmissionListParams): Promise<SubmissionListResponse> {
    const res = await apiClient.get<ApiEnvelope<{ submissions: Submission[] }> & { pagination: Pagination }>(
      `/admin/assignments/${assignmentId}/submissions`,
      { params: compactParams(params) }
    );
    return { submissions: res.data.data.submissions, pagination: res.data.pagination };
  },

  async submission(id: string): Promise<Submission> {
    const res = await apiClient.get<SubmissionEnvelope>(`/admin/submissions/${id}`);
    return res.data.data.submission;
  },

  /** Same submission payload with `evaluationHistory` and `versionHistory`. */
  async submissionHistory(id: string): Promise<Submission> {
    const res = await apiClient.get<SubmissionEnvelope>(`/admin/submissions/${id}/history`);
    return res.data.data.submission;
  },

  async grade(submissionId: string, input: GradeSubmissionInput): Promise<Submission> {
    const res = await apiClient.patch<SubmissionEnvelope>(`/admin/submissions/${submissionId}/grade`, input);
    return res.data.data.submission;
  },

  async returnForCorrection(submissionId: string, feedback?: string): Promise<Submission> {
    const res = await apiClient.patch<SubmissionEnvelope>(`/admin/submissions/${submissionId}/return`, feedback !== undefined ? { feedback } : {});
    return res.data.data.submission;
  },

  /** Streams the stored file; requires the bearer token, so it cannot be a plain link. */
  async downloadAttachment(submissionId: string, attachmentId: string): Promise<Blob> {
    try {
      const res = await apiClient.get<Blob>(`/admin/submissions/${submissionId}/attachments/${attachmentId}/download`, {
        responseType: 'blob',
        timeout: 120_000,
      });
      return res.data;
    } catch (error) {
      // Error bodies arrive as Blobs with responseType 'blob'; parse them so normalizeApiError can read the message
      if (isAxiosError(error) && error.response?.data instanceof Blob) {
        try {
          error.response.data = JSON.parse(await error.response.data.text());
        } catch {
          /* leave the original body */
        }
      }
      throw error;
    }
  },
};
