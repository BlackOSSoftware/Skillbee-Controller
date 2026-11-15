import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope } from '@/types/api';
import type { UserStatus } from '@/types/auth';
import type { Instructor, InstructorCourse, InstructorListParams, Paginated } from '@/types/instructors';

function compact<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;
}

export const instructorsService = {
  /** Response: { success, data: Instructor[], pagination } (pagination at top level). */
  async list(params: InstructorListParams): Promise<Paginated<Instructor>> {
    const res = await apiClient.get<Paginated<Instructor>>('/admin/instructors', { params: compact(params) });
    return { data: res.data.data, pagination: res.data.pagination };
  },

  async get(id: string): Promise<Instructor> {
    const res = await apiClient.get<ApiEnvelope<{ instructor: Instructor }>>(`/admin/instructors/${id}`);
    return res.data.data.instructor;
  },

  async courses(id: string, page: number, limit: number): Promise<Paginated<InstructorCourse>> {
    const res = await apiClient.get<Paginated<InstructorCourse>>(`/admin/instructors/${id}/courses`, {
      params: { page, limit },
    });
    return { data: res.data.data, pagination: res.data.pagination };
  },

  async updateStatus(id: string, status: UserStatus): Promise<Instructor> {
    const res = await apiClient.patch<ApiEnvelope<{ instructor: Instructor }>>(`/admin/instructors/${id}/status`, {
      status,
    });
    return res.data.data.instructor;
  },
};
