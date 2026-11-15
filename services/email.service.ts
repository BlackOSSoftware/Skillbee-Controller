import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type {
  CreateEmailTemplateInput,
  EmailLog,
  EmailLogListParams,
  EmailLogListResponse,
  EmailTemplate,
  UpdateEmailTemplateInput,
} from '@/types/email';

export const emailTemplatesService = {
  /** GET /admin/email-templates — returns the full list (no pagination). */
  async list(): Promise<EmailTemplate[]> {
    const res = await apiClient.get<ApiEnvelope<EmailTemplate[]>>('/admin/email-templates');
    return res.data.data;
  },
  async get(id: string): Promise<EmailTemplate> {
    const res = await apiClient.get<ApiEnvelope<EmailTemplate>>(`/admin/email-templates/${encodeURIComponent(id)}`);
    return res.data.data;
  },
  async create(input: CreateEmailTemplateInput): Promise<EmailTemplate> {
    const res = await apiClient.post<ApiEnvelope<EmailTemplate>>('/admin/email-templates', input);
    return res.data.data;
  },
  async update(id: string, input: UpdateEmailTemplateInput): Promise<EmailTemplate> {
    const res = await apiClient.patch<ApiEnvelope<EmailTemplate>>(`/admin/email-templates/${encodeURIComponent(id)}`, input);
    return res.data.data;
  },
  async setStatus(id: string, isActive: boolean): Promise<EmailTemplate> {
    const res = await apiClient.patch<ApiEnvelope<EmailTemplate>>(`/admin/email-templates/${encodeURIComponent(id)}/status`, { isActive });
    return res.data.data;
  },
};

export const emailLogsService = {
  /** GET /admin/email-logs — response is { success, data, pagination }. */
  async list(params: EmailLogListParams): Promise<EmailLogListResponse> {
    const res = await apiClient.get<ApiEnvelope<EmailLog[]> & { pagination: Pagination }>('/admin/email-logs', {
      params: compactParams(params),
    });
    return { data: res.data.data, pagination: res.data.pagination };
  },
  async get(id: string): Promise<EmailLog> {
    const res = await apiClient.get<ApiEnvelope<EmailLog>>(`/admin/email-logs/${encodeURIComponent(id)}`);
    return res.data.data;
  },
};
