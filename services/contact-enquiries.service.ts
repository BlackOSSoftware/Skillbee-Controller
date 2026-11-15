import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type {
  ContactEnquiry,
  EnquiryListParams,
  EnquiryListResponse,
  SubmitEnquiryInput,
  SupportStatus,
  TicketHistoryResponse,
} from '@/types/contact';

export const contactEnquiriesService = {
  /** POST /contact-enquiries — public website form, no auth required. */
  async submit(input: SubmitEnquiryInput): Promise<ContactEnquiry> {
    const res = await apiClient.post<ApiEnvelope<ContactEnquiry>>('/contact-enquiries', input);
    return res.data.data;
  },

  /** GET /admin/contact-enquiries */
  async list(params: EnquiryListParams): Promise<EnquiryListResponse> {
    const res = await apiClient.get<ApiEnvelope<ContactEnquiry[]> & { pagination: Pagination }>(
      '/admin/contact-enquiries',
      { params: compactParams(params) }
    );
    return { data: res.data.data, pagination: res.data.pagination };
  },

  /** GET /admin/contact-enquiries/:id — includes internalNotes (admin only). */
  async get(id: string): Promise<ContactEnquiry> {
    const res = await apiClient.get<ApiEnvelope<ContactEnquiry>>(`/admin/contact-enquiries/${id}`);
    return res.data.data;
  },

  /** PATCH /admin/contact-enquiries/:id/status */
  async updateStatus(id: string, status: SupportStatus): Promise<ContactEnquiry> {
    const res = await apiClient.patch<ApiEnvelope<ContactEnquiry>>(`/admin/contact-enquiries/${id}/status`, { status });
    return res.data.data;
  },

  /** POST /admin/contact-enquiries/:id/replies */
  async reply(id: string, message: string, idempotencyKey?: string): Promise<ContactEnquiry> {
    const res = await apiClient.post<ApiEnvelope<ContactEnquiry>>(`/admin/contact-enquiries/${id}/replies`, {
      message,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
    return res.data.data;
  },

  /** POST /admin/contact-enquiries/:id/notes — internal note, never public. */
  async addNote(id: string, message: string): Promise<ContactEnquiry> {
    const res = await apiClient.post<ApiEnvelope<ContactEnquiry>>(`/admin/contact-enquiries/${id}/notes`, { message });
    return res.data.data;
  },

  /** GET /admin/contact-enquiries/:id/history */
  async history(id: string): Promise<TicketHistoryResponse> {
    const res = await apiClient.get<ApiEnvelope<TicketHistoryResponse>>(`/admin/contact-enquiries/${id}/history`);
    return res.data.data;
  },
};
