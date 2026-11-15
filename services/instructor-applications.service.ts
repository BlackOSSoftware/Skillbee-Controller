import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope } from '@/types/api';
import type {
  InstructorApplication,
  InstructorApplicationListParams,
  InstructorApplicationsResponse,
  UpdateApplicationStatusInput,
} from '@/types/instructor-applications';

export interface ResumeDownload {
  blob: Blob;
  fileName: string;
}

function filenameFromDisposition(header: string | undefined, fallback: string): string {
  if (!header) return fallback;
  // filename*=UTF-8''… takes precedence over plain filename=
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return utf8[1];
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] ?? fallback;
}

export const instructorApplicationsService = {
  /** GET /admin/instructor-applications — response is { success, data, pagination } (pagination top-level). */
  async list(params: InstructorApplicationListParams): Promise<InstructorApplicationsResponse> {
    const res = await apiClient.get<InstructorApplicationsResponse>('/admin/instructor-applications', {
      params: compactParams(params),
    });
    return { data: res.data.data, pagination: res.data.pagination };
  },

  /** GET /admin/instructor-applications/:id */
  async get(id: string): Promise<InstructorApplication> {
    const res = await apiClient.get<ApiEnvelope<InstructorApplication>>(`/admin/instructor-applications/${id}`);
    return res.data.data;
  },

  /** PATCH /admin/instructor-applications/:id/status */
  async updateStatus(id: string, input: UpdateApplicationStatusInput): Promise<InstructorApplication> {
    const res = await apiClient.patch<ApiEnvelope<InstructorApplication>>(
      `/admin/instructor-applications/${id}/status`,
      input
    );
    return res.data.data;
  },

  /** DELETE /admin/instructor-applications/:id — soft delete. */
  async remove(id: string): Promise<InstructorApplication> {
    const res = await apiClient.delete<ApiEnvelope<InstructorApplication>>(`/admin/instructor-applications/${id}`);
    return res.data.data;
  },

  /**
   * GET /admin/instructor-applications/:id/resume — authenticated binary download.
   * Returns the blob plus a filename parsed from Content-Disposition.
   */
  async downloadResume(id: string, fallbackName: string): Promise<ResumeDownload> {
    const res = await apiClient.get<Blob>(`/admin/instructor-applications/${id}/resume`, {
      responseType: 'blob',
    });
    const disposition = res.headers['content-disposition'] as string | undefined;
    return { blob: res.data, fileName: filenameFromDisposition(disposition, fallbackName) };
  },
};
