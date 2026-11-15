'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { emailLogsService, emailTemplatesService } from '@/services/email.service';
import type {
  CreateEmailTemplateInput,
  EmailLogListParams,
  UpdateEmailTemplateInput,
} from '@/types/email';

// ---- Templates ----

export function useEmailTemplates() {
  return useQuery({
    queryKey: queryKeys.emailTemplates.list(),
    queryFn: () => emailTemplatesService.list(),
    staleTime: 60 * 1000,
  });
}

export function useEmailTemplate(id: string | null) {
  return useQuery({
    queryKey: queryKeys.emailTemplates.detail(id ?? ''),
    queryFn: () => emailTemplatesService.get(id as string),
    enabled: Boolean(id),
  });
}

function useInvalidateTemplates() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.all });
}

export function useCreateEmailTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (input: CreateEmailTemplateInput) => emailTemplatesService.create(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateEmailTemplate(id: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (input: UpdateEmailTemplateInput) => emailTemplatesService.update(id, input),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.emailTemplates.detail(id), data);
      invalidate();
    },
  });
}

export function useSetTemplateStatus() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => emailTemplatesService.setStatus(id, isActive),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.emailTemplates.detail(data.id), data);
      invalidate();
    },
  });
}

// ---- Logs ----

export function useEmailLogs(params: EmailLogListParams) {
  return useQuery({
    queryKey: queryKeys.emailLogs.list(params),
    queryFn: () => emailLogsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useEmailLog(id: string | null) {
  return useQuery({
    queryKey: queryKeys.emailLogs.detail(id ?? ''),
    queryFn: () => emailLogsService.get(id as string),
    enabled: Boolean(id),
  });
}
