import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope } from '@/types/api';
import type {
  ConvertLiveApplicationResult,
  LiveApplicationListParams,
  LiveApplicationsResponse,
  LiveCourseApplication,
  UpdateLiveApplicationRemarksInput,
  UpdateLiveApplicationStatusInput,
} from '@/types/live-applications';

export const liveApplicationsService = {
  /** GET /admin/live-course-applications — { success, data, pagination }. */
  async list(params: LiveApplicationListParams): Promise<LiveApplicationsResponse> {
    const res = await apiClient.get<LiveApplicationsResponse>('/admin/live-course-applications', {
      params: compactParams(params),
    });
    return { data: res.data.data, pagination: res.data.pagination };
  },

  /** GET /admin/live-course-applications/:id */
  async get(id: string): Promise<LiveCourseApplication> {
    const res = await apiClient.get<ApiEnvelope<LiveCourseApplication>>(
      `/admin/live-course-applications/${id}`
    );
    return res.data.data;
  },

  /** PATCH /admin/live-course-applications/:id/status */
  async updateStatus(
    id: string,
    input: UpdateLiveApplicationStatusInput
  ): Promise<LiveCourseApplication> {
    const res = await apiClient.patch<ApiEnvelope<{ application: LiveCourseApplication }>>(
      `/admin/live-course-applications/${id}/status`,
      input
    );
    return res.data.data.application;
  },

  /** PATCH /admin/live-course-applications/:id/remarks */
  async updateRemarks(
    id: string,
    input: UpdateLiveApplicationRemarksInput
  ): Promise<LiveCourseApplication> {
    const res = await apiClient.patch<ApiEnvelope<{ application: LiveCourseApplication }>>(
      `/admin/live-course-applications/${id}/remarks`,
      input
    );
    return res.data.data.application;
  },

  /** POST /admin/live-course-applications/:id/convert — creates pending enrollment. */
  async convert(id: string): Promise<ConvertLiveApplicationResult> {
    const res = await apiClient.post<ApiEnvelope<ConvertLiveApplicationResult>>(
      `/admin/live-course-applications/${id}/convert`
    );
    return res.data.data;
  },
};
