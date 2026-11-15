'use client';

import { useCallback, useEffect, useRef } from 'react';
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { saveBlob } from '@/lib/download';
import { queryKeys } from '@/lib/query-keys';
import { dashboardService } from '@/services/dashboard.service';
import { gatewaysService, type GatewayProvider } from '@/services/gateways.service';
import { ordersService, paymentsService } from '@/services/orders.service';
import { refundsService } from '@/services/refunds.service';
import type { CreateRefundInput, Order, OrderListParams, OrderStatusInput, Refund, RefundListParams } from '@/types/commerce';

export const COMMERCE_STAT_KEYS = ['orders', 'completed', 'pending', 'refunds'] as const;
export type CommerceStatKey = (typeof COMMERCE_STAT_KEYS)[number];

const STAT_SOURCES: Record<CommerceStatKey, { path: string; params: Record<string, string> }> = {
  orders: { path: '/admin/orders', params: {} },
  completed: { path: '/admin/orders', params: { orderStatus: 'completed' } },
  pending: { path: '/admin/orders', params: { orderStatus: 'pending' } },
  refunds: { path: '/admin/refunds', params: {} },
};

/** Totals from list pagination (the backend has no aggregate endpoint). */
export function useCommerceStats() {
  const results = useQueries({
    queries: COMMERCE_STAT_KEYS.map((key) => ({
      queryKey: queryKeys.commerce.stat(key),
      queryFn: () => dashboardService.count(STAT_SOURCES[key].path, STAT_SOURCES[key].params),
    })),
  });
  return COMMERCE_STAT_KEYS.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<CommerceStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

/* ------------------------------- Orders ------------------------------- */

/**
 * A single course or learner filter uses the dedicated course-wise / student-wise endpoints;
 * any other combination uses the main list, which accepts both filters.
 */
export function orderListScope(params: OrderListParams): 'course' | 'student' | 'all' {
  if (params.courseId && !params.studentId) return 'course';
  if (params.studentId && !params.courseId) return 'student';
  return 'all';
}

export function useOrderList(params: OrderListParams) {
  const scope = orderListScope(params);
  return useQuery({
    queryKey: queryKeys.commerce.orderList(scope, params),
    queryFn: () => {
      if (scope === 'course') {
        const { courseId, ...rest } = params;
        return ordersService.listForCourse(courseId as string, rest);
      }
      if (scope === 'student') {
        const { studentId, ...rest } = params;
        return ordersService.listForStudent(studentId as string, rest);
      }
      return ordersService.list(params);
    },
    placeholderData: keepPreviousData,
  });
}

/** Other orders by the same learner, shown in the order drawer. */
export function useStudentOrders(studentId: string | null) {
  const params: OrderListParams = { page: 1, limit: 6 };
  return useQuery({
    queryKey: queryKeys.commerce.orderList('student', { ...params, studentId: studentId ?? '' }),
    queryFn: () => ordersService.listForStudent(studentId as string, params),
    enabled: Boolean(studentId),
  });
}

export function useOrder(id: string, seed?: Order) {
  return useQuery({ queryKey: queryKeys.commerce.order(id), queryFn: () => ordersService.get(id), placeholderData: seed });
}

export function useOrderHistory(id: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.commerce.orderHistory(id), queryFn: () => ordersService.history(id), enabled });
}

export function useOrderPayments(id: string) {
  return useQuery({ queryKey: queryKeys.commerce.orderPayments(id), queryFn: () => paymentsService.forOrder(id) });
}

const SETTLEMENT_POLL_MS = 10_000;

/**
 * Initiated refunds settle through the gateway webhook, so while one is open on this order the list is
 * polled; when it settles, the order record and everything derived from it is refreshed.
 */
export function useOrderRefunds(orderId: string) {
  const params: RefundListParams = { page: 1, limit: 50, orderId };
  const queryClient = useQueryClient();
  const invalidate = useInvalidateOrder();
  const query = useQuery({
    queryKey: queryKeys.commerce.refundList(params),
    queryFn: () => refundsService.list(params),
    refetchInterval: (q) => (q.state.data?.refunds.some((r) => r.status === 'initiated') ? SETTLEMENT_POLL_MS : false),
  });
  const openRefunds = query.data?.refunds.filter((r) => r.status === 'initiated').map((r) => r.id).join(',');
  const previous = useRef(openRefunds);
  useEffect(() => {
    const before = previous.current;
    previous.current = openRefunds;
    if (before === undefined || openRefunds === undefined || before === openRefunds) return;
    const stillOpen = new Set(openRefunds.split(','));
    if (!before.split(',').filter(Boolean).some((id) => !stillOpen.has(id))) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.commerce.refundLists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.commerce.orderPayments(orderId) });
    invalidate(orderId);
  }, [openRefunds, orderId, queryClient, invalidate]);
  return query;
}

/** Status and refunds change the order record, its history, lists and counters. */
function useInvalidateOrder() {
  const queryClient = useQueryClient();
  return useCallback(
    (orderId: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commerce.order(orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.commerce.orderHistory(orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.commerce.orderLists() });
      for (const key of COMMERCE_STAT_KEYS) queryClient.invalidateQueries({ queryKey: queryKeys.commerce.stat(key) });
    },
    [queryClient]
  );
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateOrder();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: OrderStatusInput }) => ordersService.updateStatus(id, input),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.commerce.order(order.id), order);
      invalidate(order.id);
    },
  });
}

export function useDownloadInvoice() {
  return useMutation({
    mutationFn: async (order: Pick<Order, 'id' | 'orderNumber' | 'invoiceNumber' | 'invoiceFileName'>) =>
      saveBlob(await ordersService.invoice(order.id, order.invoiceFileName || `${order.invoiceNumber || order.orderNumber}.pdf`)),
  });
}

/* ------------------------------- Refunds ------------------------------ */

export function useRefundList(params: RefundListParams) {
  return useQuery({
    queryKey: queryKeys.commerce.refundList(params),
    queryFn: () => refundsService.list(params),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.refunds.some((r) => r.status === 'initiated') ? SETTLEMENT_POLL_MS : false),
  });
}

/** A refund's status is settled by the gateway webhook, so the detail is always re-read on open. */
export function useRefund(id: string, seed?: Refund) {
  return useQuery({ queryKey: queryKeys.commerce.refund(id), queryFn: () => refundsService.get(id), placeholderData: seed, staleTime: 0 });
}

export function useCreateRefund() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateOrder();
  return useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: CreateRefundInput }) => refundsService.create(orderId, input),
    onSuccess: (refund) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commerce.refundLists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.commerce.orderPayments(refund.orderId) });
      invalidate(refund.orderId);
    },
  });
}

/* ------------------------------ Gateways ------------------------------ */

export function useGateways() {
  return useQuery({ queryKey: queryKeys.commerce.gateways(), queryFn: () => gatewaysService.list() });
}

export function useGatewayStatus(provider: GatewayProvider) {
  return useQuery({ queryKey: queryKeys.commerce.gatewayStatus(provider), queryFn: () => gatewaysService.status(provider) });
}

/** Test results are shown once and never cached. */
export function useTestGateway(provider: GatewayProvider) {
  return useMutation({ mutationFn: () => gatewaysService.test(provider) });
}
