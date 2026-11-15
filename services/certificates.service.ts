import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import { fetchDownload, type DownloadedFile } from '@/lib/download';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type {
  Certificate,
  CertificateEligibility,
  CertificateHistory,
  CertificateListParams,
  CertificateListResponse,
  CertificateTemplate,
  CreateTemplateInput,
  IssueCertificateInput,
  TemplateListParams,
  TemplateListResponse,
  TemplateStatus,
  UpdateTemplateInput,
} from '@/types/certificates';

type Listed<T> = ApiEnvelope<T> & { pagination: Pagination };
type TemplateEnvelope = ApiEnvelope<{ template: CertificateTemplate }>;
type CertificateEnvelope = ApiEnvelope<{ certificate: Certificate }>;

export const certificateTemplatesService = {
  /** Response: { success, data: { templates }, pagination }; default template first. */
  async list(params: TemplateListParams): Promise<TemplateListResponse> {
    const res = await apiClient.get<Listed<{ templates: CertificateTemplate[] }>>('/admin/certificate-templates', { params: compactParams(params) });
    return { templates: res.data.data.templates, pagination: res.data.pagination };
  },

  async get(id: string): Promise<CertificateTemplate> {
    const res = await apiClient.get<TemplateEnvelope>(`/admin/certificate-templates/${id}`);
    return res.data.data.template;
  },

  async create(input: CreateTemplateInput): Promise<CertificateTemplate> {
    const res = await apiClient.post<TemplateEnvelope>('/admin/certificate-templates', input);
    return res.data.data.template;
  },

  /** Issued certificates keep their own template snapshot, so edits only affect future issues. */
  async update(id: string, input: UpdateTemplateInput): Promise<CertificateTemplate> {
    const res = await apiClient.patch<TemplateEnvelope>(`/admin/certificate-templates/${id}`, input);
    return res.data.data.template;
  },

  async setStatus(id: string, status: TemplateStatus): Promise<CertificateTemplate> {
    const res = await apiClient.patch<TemplateEnvelope>(`/admin/certificate-templates/${id}/status`, { status });
    return res.data.data.template;
  },

  /** Clears the previous default and activates this template. */
  async setDefault(id: string): Promise<CertificateTemplate> {
    const res = await apiClient.patch<TemplateEnvelope>(`/admin/certificate-templates/${id}/default`);
    return res.data.data.template;
  },

  /** Creates a draft "(Copy)" with a new code. */
  async duplicate(id: string): Promise<CertificateTemplate> {
    const res = await apiClient.post<TemplateEnvelope>(`/admin/certificate-templates/${id}/duplicate`);
    return res.data.data.template;
  },

  /** Soft-delete; 409 TEMPLATE_IN_USE when any certificate references the template. */
  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const res = await apiClient.delete<ApiEnvelope<{ id: string; deleted: boolean }>>(`/admin/certificate-templates/${id}`);
    return res.data.data;
  },
};

export const certificatesService = {
  /** Response: { success, data: { certificates }, pagination }; newest issue first. */
  async list(params: CertificateListParams): Promise<CertificateListResponse> {
    const res = await apiClient.get<Listed<{ certificates: Certificate[] }>>('/admin/certificates', { params: compactParams(params) });
    return { certificates: res.data.data.certificates, pagination: res.data.pagination };
  },

  async get(id: string): Promise<Certificate> {
    const res = await apiClient.get<CertificateEnvelope>(`/admin/certificates/${id}`);
    return res.data.data.certificate;
  },

  /** The backend re-runs eligibility and rejects with 400 NOT_ELIGIBLE or 409 DUPLICATE_CERTIFICATE. */
  async issue(input: IssueCertificateInput): Promise<Certificate> {
    const res = await apiClient.post<CertificateEnvelope>('/admin/certificates/issue', input, { timeout: 120_000 });
    return res.data.data.certificate;
  },

  async revoke(id: string, reason?: string): Promise<Certificate> {
    const res = await apiClient.post<CertificateEnvelope>(`/admin/certificates/${id}/revoke`, reason ? { reason } : {});
    return res.data.data.certificate;
  },

  /** Re-renders the PDF from the stored snapshot; only issued certificates. */
  async regenerate(id: string): Promise<Certificate> {
    const res = await apiClient.post<CertificateEnvelope>(`/admin/certificates/${id}/regenerate`, undefined, { timeout: 120_000 });
    return res.data.data.certificate;
  },

  async history(id: string): Promise<CertificateHistory> {
    const res = await apiClient.get<ApiEnvelope<CertificateHistory>>(`/admin/certificates/${id}/history`);
    return res.data.data;
  },

  /** PDF stream with `Content-Disposition: attachment; filename="…"`. */
  async download(id: string, fallbackName: string): Promise<DownloadedFile> {
    const result = await fetchDownload(`/admin/certificates/${id}/download`, fallbackName);
    if ('url' in result) throw new Error('Unexpected response for a certificate download');
    return result;
  },

  async eligibility(studentId: string, courseId: string): Promise<CertificateEligibility> {
    const res = await apiClient.get<ApiEnvelope<{ eligibility: CertificateEligibility }>>(`/admin/students/${studentId}/certificate-eligibility/${courseId}`);
    return res.data.data.eligibility;
  },
};
