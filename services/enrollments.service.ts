import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type {
  CreateEnrollmentInput,
  Enrollment,
  EnrollmentHistory,
  EnrollmentListParams,
  EnrollmentListResponse,
  EnrollmentProgress,
  EnrollmentRecord,
  EnrollmentStatus,
} from '@/types/enrollments';

type RecordEnvelope = ApiEnvelope<{ enrollment: EnrollmentRecord }>;

export const enrollmentsService = {
  /** Response: { success, data: { enrollments }, pagination }. */
  async list(params: EnrollmentListParams): Promise<EnrollmentListResponse> {
    const res = await apiClient.get<ApiEnvelope<{ enrollments: Enrollment[] }> & { pagination: Pagination }>('/admin/enrollments', {
      params: compactParams(params),
    });
    return { enrollments: res.data.data.enrollments, pagination: res.data.pagination };
  },

  async create(input: CreateEnrollmentInput): Promise<EnrollmentRecord> {
    const res = await apiClient.post<RecordEnvelope>('/admin/enrollments', input);
    return res.data.data.enrollment;
  },

  async updateStatus(id: string, status: EnrollmentStatus, reason?: string): Promise<EnrollmentRecord> {
    const res = await apiClient.patch<RecordEnvelope>(`/admin/enrollments/${id}/status`, { status, ...(reason ? { reason } : {}) });
    return res.data.data.enrollment;
  },

  async progress(id: string): Promise<EnrollmentProgress> {
    const res = await apiClient.get<ApiEnvelope<{ progress: EnrollmentProgress }>>(`/admin/enrollments/${id}/progress`);
    return res.data.data.progress;
  },

  async history(id: string): Promise<EnrollmentHistory> {
    const res = await apiClient.get<ApiEnvelope<EnrollmentHistory>>(`/admin/enrollments/${id}/history`);
    return res.data.data;
  },
};
