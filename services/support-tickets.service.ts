import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type {
  SupportStatus,
  SupportTicket,
  TicketHistoryResponse,
  TicketListParams,
  TicketListResponse,
  TicketReplyInput,
} from '@/types/contact';

export const supportTicketsService = {
  // ---------- Admin-facing (/admin/support/tickets) ----------

  /** GET /admin/support/tickets */
  async listAdmin(params: TicketListParams): Promise<TicketListResponse> {
    const res = await apiClient.get<ApiEnvelope<SupportTicket[]> & { pagination: Pagination }>(
      '/admin/support/tickets',
      { params: compactParams(params) }
    );
    return { data: res.data.data, pagination: res.data.pagination };
  },

  /** GET /admin/support/tickets/:id — includes internal notes. */
  async getAdmin(id: string): Promise<SupportTicket> {
    const res = await apiClient.get<ApiEnvelope<SupportTicket>>(`/admin/support/tickets/${id}`);
    return res.data.data;
  },

  /** POST /admin/support/tickets/:id/replies — public reply to student. */
  async replyAdmin(id: string, input: TicketReplyInput): Promise<SupportTicket> {
    const res = await apiClient.post<ApiEnvelope<SupportTicket>>(`/admin/support/tickets/${id}/replies`, input);
    return res.data.data;
  },

  /** POST /admin/support/tickets/:id/notes — internal note. */
  async addNote(id: string, message: string): Promise<SupportTicket> {
    const res = await apiClient.post<ApiEnvelope<SupportTicket>>(`/admin/support/tickets/${id}/notes`, { message });
    return res.data.data;
  },

  /** PATCH /admin/support/tickets/:id/status */
  async updateStatus(id: string, status: SupportStatus): Promise<SupportTicket> {
    const res = await apiClient.patch<ApiEnvelope<SupportTicket>>(`/admin/support/tickets/${id}/status`, { status });
    return res.data.data;
  },

  /** PATCH /admin/support/tickets/:id/assign — null unassigns. */
  async assign(id: string, assignedTo: string | null): Promise<SupportTicket> {
    const res = await apiClient.patch<ApiEnvelope<SupportTicket>>(`/admin/support/tickets/${id}/assign`, { assignedTo });
    return res.data.data;
  },

  /** GET /admin/support/tickets/:id/history */
  async history(id: string): Promise<TicketHistoryResponse> {
    const res = await apiClient.get<ApiEnvelope<TicketHistoryResponse>>(`/admin/support/tickets/${id}/history`);
    return res.data.data;
  },
};
