import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope } from '@/types/api';
import type { CreateFaqInput, Faq, FaqListParams, FaqsResponse, FaqStatus, UpdateFaqInput } from '@/types/faqs';

export const faqsService = {
  async list(params: FaqListParams): Promise<FaqsResponse> {
    const res = await apiClient.get<FaqsResponse>('/admin/faqs', { params: compactParams(params) });
    return { data: res.data.data, pagination: res.data.pagination };
  },

  async get(id: string): Promise<Faq> {
    const res = await apiClient.get<ApiEnvelope<Faq>>(`/admin/faqs/${id}`);
    return res.data.data;
  },

  async create(input: CreateFaqInput): Promise<Faq> {
    const res = await apiClient.post<ApiEnvelope<Faq>>('/admin/faqs', input);
    return res.data.data;
  },

  async update(id: string, input: UpdateFaqInput): Promise<Faq> {
    const res = await apiClient.patch<ApiEnvelope<Faq>>(`/admin/faqs/${id}`, input);
    return res.data.data;
  },

  async setStatus(id: string, status: FaqStatus): Promise<Faq> {
    const res = await apiClient.patch<ApiEnvelope<Faq>>(`/admin/faqs/${id}/status`, { status });
    return res.data.data;
  },

  /** PATCH /admin/faqs/reorder — orderedIds become displayOrder 0..n. */
  async reorder(orderedIds: string[]): Promise<{ updated: number }> {
    const res = await apiClient.patch<ApiEnvelope<{ updated: number }>>('/admin/faqs/reorder', { orderedIds });
    return res.data.data;
  },

  async remove(id: string): Promise<Faq> {
    const res = await apiClient.delete<ApiEnvelope<Faq>>(`/admin/faqs/${id}`);
    return res.data.data;
  },
};
