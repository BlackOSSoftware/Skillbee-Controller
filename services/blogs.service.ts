import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope } from '@/types/api';
import type {
  Blog,
  BlogCategory,
  BlogListParams,
  BlogPreview,
  BlogsResponse,
  BlogSeoResponse,
  BlogStatus,
  CreateBlogCategoryInput,
  CreateBlogInput,
  UpdateBlogInput,
  UpdateBlogSeoInput,
} from '@/types/blogs';

/** Public site origin used to open private blog previews (served by the public app, not the API). */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const blogsService = {
  async list(params: BlogListParams): Promise<BlogsResponse> {
    const res = await apiClient.get<BlogsResponse>('/admin/blogs', { params: compactParams(params) });
    return { data: res.data.data, pagination: res.data.pagination };
  },

  async get(id: string): Promise<Blog> {
    const res = await apiClient.get<ApiEnvelope<Blog>>(`/admin/blogs/${id}`);
    return res.data.data;
  },

  async create(input: CreateBlogInput): Promise<Blog> {
    const res = await apiClient.post<ApiEnvelope<Blog>>('/admin/blogs', input);
    return res.data.data;
  },

  async update(id: string, input: UpdateBlogInput): Promise<Blog> {
    const res = await apiClient.patch<ApiEnvelope<Blog>>(`/admin/blogs/${id}`, input);
    return res.data.data;
  },

  async setStatus(id: string, status: BlogStatus): Promise<Blog> {
    const res = await apiClient.patch<ApiEnvelope<Blog>>(`/admin/blogs/${id}/status`, { status });
    return res.data.data;
  },

  /** Soft delete — backend archives + sets deletedAt. */
  async remove(id: string): Promise<Blog> {
    const res = await apiClient.delete<ApiEnvelope<Blog>>(`/admin/blogs/${id}`);
    return res.data.data;
  },

  async createCategory(input: CreateBlogCategoryInput): Promise<BlogCategory> {
    const res = await apiClient.post<ApiEnvelope<BlogCategory>>('/admin/blogs/categories', input);
    return res.data.data;
  },

  async getSeo(id: string): Promise<BlogSeoResponse> {
    const res = await apiClient.get<ApiEnvelope<BlogSeoResponse>>(`/admin/blogs/${id}/seo`);
    return res.data.data;
  },

  async updateSeo(id: string, input: UpdateBlogSeoInput): Promise<BlogSeoResponse> {
    const res = await apiClient.patch<ApiEnvelope<BlogSeoResponse>>(`/admin/blogs/${id}/seo`, input);
    return res.data.data;
  },

  /** Returns a short-lived private preview URL on the public site. */
  async createPreview(id: string): Promise<BlogPreview & { url: string }> {
    const res = await apiClient.post<ApiEnvelope<BlogPreview>>(`/admin/blogs/${id}/preview`);
    const data = res.data.data;
    return { ...data, url: `${SITE_URL}${data.path}` };
  },

  /** Published categories — only public listing endpoint exists; reused for admin pickers. */
  async listCategories(): Promise<BlogCategory[]> {
    const res = await apiClient.get<ApiEnvelope<BlogCategory[]>>('/public/blog-categories');
    return res.data.data;
  },
};
