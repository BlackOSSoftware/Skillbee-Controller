import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type {
  Course,
  CourseAnalytics,
  CourseInput,
  CourseListParams,
  CourseListResponse,
  CourseStatus,
  CourseTopic,
  UpdateCourseInput,
} from '@/types/courses';

type CourseEnvelope = ApiEnvelope<{ course: Course }>;

export const coursesService = {
  /** Response: { success, data: Course[], pagination } (pagination at top level). */
  async list(params: CourseListParams): Promise<CourseListResponse> {
    const res = await apiClient.get<ApiEnvelope<Course[]> & { pagination: Pagination }>('/admin/courses', {
      params: compactParams(params),
    });
    return { data: res.data.data, pagination: res.data.pagination };
  },

  async get(id: string): Promise<Course> {
    const res = await apiClient.get<CourseEnvelope>(`/admin/courses/${id}`);
    return res.data.data.course;
  },

  async create(input: CourseInput): Promise<Course> {
    const res = await apiClient.post<CourseEnvelope>('/admin/courses', input);
    return res.data.data.course;
  },

  async update(id: string, input: UpdateCourseInput): Promise<Course> {
    const res = await apiClient.patch<CourseEnvelope>(`/admin/courses/${id}`, input);
    return res.data.data.course;
  },

  async updateStatus(id: string, status: CourseStatus): Promise<Course> {
    const res = await apiClient.patch<CourseEnvelope>(`/admin/courses/${id}/status`, { status });
    return res.data.data.course;
  },

  async analytics(id: string): Promise<CourseAnalytics> {
    const res = await apiClient.get<ApiEnvelope<{ analytics: CourseAnalytics }>>(`/admin/courses/${id}/analytics`);
    return res.data.data.analytics;
  },

  /** Backend caps limit at 100; one page covers a course outline. */
  async topics(courseId: string): Promise<{ topics: CourseTopic[]; pagination: Pagination }> {
    const res = await apiClient.get<ApiEnvelope<{ topics: CourseTopic[] }> & { pagination: Pagination }>(
      `/admin/courses/${courseId}/topics`,
      { params: { page: 1, limit: 100, includeLessons: true } }
    );
    return { topics: res.data.data.topics, pagination: res.data.pagination };
  },
};
