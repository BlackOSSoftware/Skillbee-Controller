import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type {
  CourseSeoData,
  CreateRedirectInput,
  PageSeo,
  RedirectListParams,
  RedirectListResponse,
  SeoCourseOption,
  SeoRedirect,
  SeoSettings,
  UpdateCourseSeoInput,
  UpdatePageSeoInput,
  UpdateRedirectInput,
  UpdateSeoSettingsInput,
} from '@/types/seo';

export const seoService = {
  // ---- Global settings ----
  async getSettings(): Promise<SeoSettings> {
    const res = await apiClient.get<ApiEnvelope<SeoSettings>>('/admin/seo/settings');
    return res.data.data;
  },
  async updateSettings(input: UpdateSeoSettingsInput): Promise<SeoSettings> {
    const res = await apiClient.patch<ApiEnvelope<SeoSettings>>('/admin/seo/settings', input);
    return res.data.data;
  },

  // ---- Page SEO ----
  async getPageSeo(id: string): Promise<PageSeo> {
    const res = await apiClient.get<ApiEnvelope<PageSeo>>(`/admin/seo/pages/${encodeURIComponent(id)}`);
    return res.data.data;
  },
  async updatePageSeo(id: string, input: UpdatePageSeoInput): Promise<PageSeo> {
    const res = await apiClient.patch<ApiEnvelope<PageSeo>>(`/admin/seo/pages/${encodeURIComponent(id)}`, input);
    return res.data.data;
  },

  /** Minimal course list for the picker — guarded by seo.manage, not courses.read. */
  async listCoursesForSeo(params: { page?: number; limit?: number; search?: string }): Promise<{ data: SeoCourseOption[]; pagination: Pagination }> {
    const res = await apiClient.get<ApiEnvelope<SeoCourseOption[]> & { pagination: Pagination }>('/admin/seo/courses', {
      params: compactParams(params),
    });
    return { data: res.data.data, pagination: res.data.pagination };
  },
  // ---- Course SEO ----
  async getCourseSeo(id: string): Promise<CourseSeoData> {
    const res = await apiClient.get<ApiEnvelope<CourseSeoData>>(`/admin/seo/courses/${encodeURIComponent(id)}`);
    return res.data.data;
  },
  async updateCourseSeo(id: string, input: UpdateCourseSeoInput): Promise<CourseSeoData> {
    const res = await apiClient.patch<ApiEnvelope<CourseSeoData>>(`/admin/seo/courses/${encodeURIComponent(id)}`, input);
    return res.data.data;
  },

  // ---- Redirects ----
  async listRedirects(params: RedirectListParams): Promise<RedirectListResponse> {
    const res = await apiClient.get<ApiEnvelope<SeoRedirect[]> & { pagination: Pagination }>('/admin/seo/redirects', {
      params: compactParams(params),
    });
    return { data: res.data.data, pagination: res.data.pagination };
  },
  async createRedirect(input: CreateRedirectInput): Promise<SeoRedirect> {
    const res = await apiClient.post<ApiEnvelope<SeoRedirect>>('/admin/seo/redirects', input);
    return res.data.data;
  },
  async updateRedirect(id: string, input: UpdateRedirectInput): Promise<SeoRedirect> {
    const res = await apiClient.patch<ApiEnvelope<SeoRedirect>>(`/admin/seo/redirects/${encodeURIComponent(id)}`, input);
    return res.data.data;
  },
  async deleteRedirect(id: string): Promise<SeoRedirect> {
    const res = await apiClient.delete<ApiEnvelope<SeoRedirect>>(`/admin/seo/redirects/${encodeURIComponent(id)}`);
    return res.data.data;
  },
};
