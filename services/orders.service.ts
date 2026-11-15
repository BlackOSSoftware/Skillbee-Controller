import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import { fetchDownload, type DownloadedFile } from '@/lib/download';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type { Order, OrderHistory, OrderListParams, OrderListResponse, OrderStatusInput, Payment } from '@/types/commerce';

type Listed<T> = ApiEnvelope<T> & { pagination: Pagination };
type OrderEnvelope = ApiEnvelope<{ order: Order }>;

async function listFrom(path: string, params: OrderListParams): Promise<OrderListResponse> {
  const res = await apiClient.get<Listed<{ orders: Order[] }>>(path, { params: compactParams(params) });
  return { orders: res.data.data.orders, pagination: res.data.pagination };
}

export const ordersService = {
  /** Response: { success, data: { orders }, pagination }; newest first. */
  list(params: OrderListParams): Promise<OrderListResponse> {
    return listFrom('/admin/orders', params);
  },

  /** Same filters, scoped to orders containing the course. */
  listForCourse(courseId: string, params: Omit<OrderListParams, 'courseId'>): Promise<OrderListResponse> {
    return listFrom(`/admin/courses/${courseId}/orders`, params);
  },

  /** Same filters, scoped to one learner. */
  listForStudent(studentId: string, params: Omit<OrderListParams, 'studentId'>): Promise<OrderListResponse> {
    return listFrom(`/admin/students/${studentId}/orders`, params);
  },

  async get(id: string): Promise<Order> {
    const res = await apiClient.get<OrderEnvelope>(`/admin/orders/${id}`);
    return res.data.data.order;
  },

  /** 400 STATUS_REQUIRES_PAYMENT for `completed`: only a verified payment completes an order. */
  async updateStatus(id: string, input: OrderStatusInput): Promise<Order> {
    const res = await apiClient.patch<OrderEnvelope>(`/admin/orders/${id}/status`, input);
    return res.data.data.order;
  },

  async history(id: string): Promise<OrderHistory> {
    const res = await apiClient.get<ApiEnvelope<OrderHistory>>(`/admin/orders/${id}/history`);
    return res.data.data;
  },

  /** PDF stream; 404 INVOICE_NOT_FOUND until the order is paid and the invoice generated. */
  async invoice(id: string, fallbackName: string): Promise<DownloadedFile> {
    const result = await fetchDownload(`/admin/orders/${id}/invoice`, fallbackName);
    if ('url' in result) throw new Error('Unexpected response for an invoice download');
    return result;
  },
};

export const paymentsService = {
  /** Gateway payment records for an order (transaction ids, captured and refunded amounts). */
  async forOrder(orderId: string): Promise<Payment[]> {
    const res = await apiClient.get<Listed<{ payments: Payment[] }>>('/admin/payments', { params: { orderId, page: 1, limit: 20 } });
    return res.data.data.payments;
  },
};
