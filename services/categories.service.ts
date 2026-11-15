import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type {
  BlogCategory,
  BlogCategoryInput,
  CategoryInput,
  CategoryOrderItem,
  CourseCategory,
  UpdateCategoryInput,
} from '@/types/categories';

type CategoryEnvelope = ApiEnvelope<{ category: CourseCategory }>;

/** Backend caps `limit` at 100. */
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const REORDER_BATCH = 200;

export const categoriesService = {
  /**
   * Every category in backend order (sortOrder, then name). Reordering needs the full list,
   * so pages are fetched until `totalPages` is reached.
   */
  async listAll(): Promise<CourseCategory[]> {
    const byId = new Map<string, CourseCategory>();
    let page = 1;
    let totalPages = 1;
    do {
      const res = await apiClient.get<ApiEnvelope<CourseCategory[]> & { pagination: Pagination }>(
        '/admin/course-categories',
        { params: { page, limit: PAGE_SIZE } }
      );
      for (const category of res.data.data) byId.set(category.id, category);
      totalPages = res.data.pagination.totalPages;
      page += 1;
    } while (page <= Math.min(totalPages, MAX_PAGES));
    return [...byId.values()];
  },

  async create(input: CategoryInput): Promise<CourseCategory> {
    const res = await apiClient.post<CategoryEnvelope>('/admin/course-categories', input);
    return res.data.data.category;
  },

  async update(id: string, input: UpdateCategoryInput): Promise<CourseCategory> {
    const res = await apiClient.patch<CategoryEnvelope>(`/admin/course-categories/${id}`, input);
    return res.data.data.category;
  },

  /** `reorderCategoriesSchema` accepts 1–200 items per request. */
  async reorder(items: CategoryOrderItem[]): Promise<void> {
    for (let i = 0; i < items.length; i += REORDER_BATCH) {
      await apiClient.patch('/admin/course-categories/reorder', { items: items.slice(i, i + REORDER_BATCH) });
    }
  },
};

export const blogCategoriesService = {
  /** Response: { success, data: BlogCategory } (category is `data` itself). */
  async create(input: BlogCategoryInput): Promise<BlogCategory> {
    const res = await apiClient.post<ApiEnvelope<BlogCategory>>('/admin/blogs/categories', input);
    return res.data.data;
  },

  /** No admin list endpoint exists; the public endpoint returns published categories only. */
  async listPublished(): Promise<BlogCategory[]> {
    const res = await apiClient.get<ApiEnvelope<BlogCategory[]>>('/public/blog-categories');
    return res.data.data;
  },
};
