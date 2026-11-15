'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { saveBlob } from '@/lib/download';
import { queryKeys } from '@/lib/query-keys';
import { certificatesService, certificateTemplatesService } from '@/services/certificates.service';
import { dashboardService } from '@/services/dashboard.service';
import { enrollmentsService } from '@/services/enrollments.service';
import { mediaService } from '@/services/media.service';
import type {
  Certificate,
  CertificateListParams,
  CertificateTemplate,
  CreateTemplateInput,
  IssueCertificateInput,
  TemplateListParams,
  TemplateStatus,
  UpdateTemplateInput,
} from '@/types/certificates';
import type { EnrollmentListParams } from '@/types/enrollments';
export const CERT_STAT_KEYS = ['issued', 'revoked', 'templates', 'activeTemplates'] as const;
export type CertStatKey = (typeof CERT_STAT_KEYS)[number];

const STAT_SOURCES: Record<CertStatKey, { path: string; params: Record<string, string> }> = {
  issued: { path: '/admin/certificates', params: { status: 'issued' } },
  revoked: { path: '/admin/certificates', params: { status: 'revoked' } },
  templates: { path: '/admin/certificate-templates', params: {} },
  activeTemplates: { path: '/admin/certificate-templates', params: { status: 'active' } },
};

/** Totals from list pagination (no aggregate endpoint exists). */
export function useCertificateStats() {
  const results = useQueries({
    queries: CERT_STAT_KEYS.map((key) => ({
      queryKey: queryKeys.certificates.stat(key),
      queryFn: () => dashboardService.count(STAT_SOURCES[key].path, STAT_SOURCES[key].params),
    })),
  });
  return CERT_STAT_KEYS.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<CertStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

/* ----------------------------- Templates ----------------------------- */

export function useTemplateList(params: TemplateListParams) {
  return useQuery({ queryKey: queryKeys.certificates.templateList(params), queryFn: () => certificateTemplatesService.list(params), placeholderData: keepPreviousData });
}

/** Active templates for the issue form (one page covers realistic template counts). */
export const ACTIVE_TEMPLATE_PARAMS: TemplateListParams = { page: 1, limit: 100, status: 'active' };

export function useActiveTemplates(enabled: boolean) {
  return useQuery({ queryKey: queryKeys.certificates.templateList(ACTIVE_TEMPLATE_PARAMS), queryFn: () => certificateTemplatesService.list(ACTIVE_TEMPLATE_PARAMS), enabled });
}

/** Fresh template record; the list row shows until it settles. */
export function useTemplate(id: string | null, seed?: CertificateTemplate) {
  return useQuery({ queryKey: queryKeys.certificates.template(id ?? ''), queryFn: () => certificateTemplatesService.get(id as string), enabled: Boolean(id), placeholderData: seed });
}

/** Defaults move between templates, so every template list and the counters refresh after a write. */
function useApplyTemplate() {
  const queryClient = useQueryClient();
  return (template: CertificateTemplate | null, removedId?: string) => {
    if (template) queryClient.setQueryData(queryKeys.certificates.template(template.id), template);
    if (removedId) queryClient.removeQueries({ queryKey: queryKeys.certificates.template(removedId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.certificates.templateLists() });
    for (const key of ['templates', 'activeTemplates'] satisfies CertStatKey[]) queryClient.invalidateQueries({ queryKey: queryKeys.certificates.stat(key) });
  };
}

export function useCreateTemplate() {
  const apply = useApplyTemplate();
  return useMutation({ mutationFn: (input: CreateTemplateInput) => certificateTemplatesService.create(input), onSuccess: (t) => apply(t) });
}

export function useUpdateTemplate() {
  const apply = useApplyTemplate();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateTemplateInput }) => certificateTemplatesService.update(id, input), onSuccess: (t) => apply(t) });
}

export function useTemplateStatus() {
  const apply = useApplyTemplate();
  return useMutation({ mutationFn: ({ id, status }: { id: string; status: TemplateStatus }) => certificateTemplatesService.setStatus(id, status), onSuccess: (t) => apply(t) });
}

export function useSetDefaultTemplate() {
  const queryClient = useQueryClient();
  const apply = useApplyTemplate();
  return useMutation({
    mutationFn: (id: string) => certificateTemplatesService.setDefault(id),
    onSuccess: (t) => {
      // The previous default lost its flag server-side; drop cached details so they refetch.
      queryClient.removeQueries({ queryKey: [...queryKeys.certificates.templates(), 'detail'], predicate: (q) => q.queryKey[3] !== t.id });
      apply(t);
    },
  });
}

export function useDuplicateTemplate() {
  const apply = useApplyTemplate();
  return useMutation({ mutationFn: (id: string) => certificateTemplatesService.duplicate(id), onSuccess: (t) => apply(t) });
}

export function useDeleteTemplate() {
  const apply = useApplyTemplate();
  return useMutation({ mutationFn: (id: string) => certificateTemplatesService.remove(id), onSuccess: (r) => apply(null, r.id) });
}

/** Uploads a template image to the media library (Cloudinary); the template then references the asset. */
export function useUploadTemplateImage() {
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (percent: number) => void }) => mediaService.uploadImage(file, { category: 'other' }, onProgress),
  });
}

/* ------------------------- Issued certificates ------------------------ */

export function useCertificateList(params: CertificateListParams) {
  return useQuery({ queryKey: queryKeys.certificates.list(params), queryFn: () => certificatesService.list(params), placeholderData: keepPreviousData });
}

export function useCertificate(id: string | null, seed?: Certificate) {
  return useQuery({ queryKey: queryKeys.certificates.detail(id ?? ''), queryFn: () => certificatesService.get(id as string), enabled: Boolean(id), placeholderData: seed });
}

export function useCertificateHistory(id: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.certificates.history(id), queryFn: () => certificatesService.history(id), enabled });
}

/** Always evaluated by the backend; never cached across selections and never retried blindly. */
export function useEligibility(studentId: string | null, courseId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.certificates.eligibility(studentId ?? '', courseId ?? ''),
    queryFn: () => certificatesService.eligibility(studentId as string, courseId as string),
    enabled: enabled && Boolean(studentId && courseId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

/** A certificate write changes its record, history, the lists, counters and the learner's eligibility. */
function useApplyCertificate() {
  const queryClient = useQueryClient();
  return (c: Certificate) => {
    queryClient.setQueryData(queryKeys.certificates.detail(c.id), c);
    queryClient.invalidateQueries({ queryKey: queryKeys.certificates.history(c.id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.certificates.lists() });
    queryClient.removeQueries({ queryKey: queryKeys.certificates.eligibility(c.studentId, c.courseId) });
    for (const key of ['issued', 'revoked'] satisfies CertStatKey[]) queryClient.invalidateQueries({ queryKey: queryKeys.certificates.stat(key) });
  };
}

export function useIssueCertificate() {
  const queryClient = useQueryClient();
  const apply = useApplyCertificate();
  return useMutation({
    mutationFn: (input: IssueCertificateInput) => certificatesService.issue(input),
    onSuccess: (c, input) => {
      apply(c);
      if (input.replaceRevokedId) queryClient.invalidateQueries({ queryKey: queryKeys.certificates.detail(input.replaceRevokedId) });
    },
  });
}

export function useRevokeCertificate() {
  const apply = useApplyCertificate();
  return useMutation({ mutationFn: ({ id, reason }: { id: string; reason?: string }) => certificatesService.revoke(id, reason), onSuccess: apply });
}

export function useRegenerateCertificate() {
  const apply = useApplyCertificate();
  return useMutation({ mutationFn: (id: string) => certificatesService.regenerate(id), onSuccess: apply });
}

export function useDownloadCertificate() {
  return useMutation({
    mutationFn: async (c: Pick<Certificate, 'id' | 'certificateNumber' | 'pdfFileName'>) => saveBlob(await certificatesService.download(c.id, c.pdfFileName || `${c.certificateNumber}.pdf`)),
  });
}

/* ------------------------------ Lookups ------------------------------- */

/** Enrollment rows pair a learner with a course, which is exactly what issuance needs. */
export function useEnrollmentPicker(search: string, courseId: string, enabled: boolean) {
  const params: EnrollmentListParams = { page: 1, limit: 8, search: search || undefined, courseId: courseId || undefined, sortBy: 'updatedAt', sortOrder: 'desc' };
  return useQuery({ queryKey: queryKeys.enrollments.list(params), queryFn: () => enrollmentsService.list(params), enabled, placeholderData: keepPreviousData });
}

export { useCourseCatalog, useLearnerSearch, useUserNames } from '@/features/shared/lookups';
