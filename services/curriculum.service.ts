import { apiClient } from '@/lib/api-client';
import type { ApiEnvelope } from '@/types/api';
import type { CourseTopic } from '@/types/courses';
import type { AdminLesson, CreateLessonInput, LessonStatus, MoveLessonInput, TopicInput, UpdateLessonInput } from '@/types/curriculum';

type LessonEnvelope = ApiEnvelope<{ lesson: AdminLesson }>;
type TopicEnvelope = ApiEnvelope<{ topic: CourseTopic }>;

/** Course topics (existing topic endpoints only). */
export const topicsService = {
  async create(courseId: string, input: TopicInput & { title: string }): Promise<CourseTopic> {
    const res = await apiClient.post<TopicEnvelope>(`/admin/courses/${courseId}/topics`, input);
    return res.data.data.topic;
  },

  async update(topicId: string, input: TopicInput): Promise<CourseTopic> {
    const res = await apiClient.patch<TopicEnvelope>(`/admin/topics/${topicId}`, input);
    return res.data.data.topic;
  },

  /** Soft-archives the topic and its lessons; lesson IDs are preserved for history. */
  async remove(topicId: string): Promise<void> {
    await apiClient.delete(`/admin/topics/${topicId}`);
  },
};

/** Admin lesson management. */
export const lessonsService = {
  async create(topicId: string, input: CreateLessonInput): Promise<AdminLesson> {
    const res = await apiClient.post<LessonEnvelope>(`/admin/topics/${topicId}/lessons`, input);
    return res.data.data.lesson;
  },

  async get(id: string): Promise<AdminLesson> {
    const res = await apiClient.get<LessonEnvelope>(`/admin/lessons/${id}`);
    return res.data.data.lesson;
  },

  async update(id: string, input: UpdateLessonInput): Promise<AdminLesson> {
    const res = await apiClient.patch<LessonEnvelope>(`/admin/lessons/${id}`, input);
    return res.data.data.lesson;
  },

  /** Soft archive; the lesson ID stays valid for progress history. */
  async archive(id: string): Promise<AdminLesson> {
    const res = await apiClient.delete<LessonEnvelope>(`/admin/lessons/${id}`);
    return res.data.data.lesson;
  },

  /** Publishing runs the backend readiness checks (content, video ready, live schedule…). */
  async changeStatus(id: string, status: LessonStatus): Promise<AdminLesson> {
    const res = await apiClient.patch<LessonEnvelope>(`/admin/lessons/${id}/status`, { status });
    return res.data.data.lesson;
  },

  /** Draft copy with a new slug, placed after the original. */
  async duplicate(id: string): Promise<AdminLesson> {
    const res = await apiClient.post<LessonEnvelope>(`/admin/lessons/${id}/duplicate`);
    return res.data.data.lesson;
  },

  /** Same-course topics only; the backend rejects cross-course moves with 422. */
  async move(id: string, input: MoveLessonInput): Promise<AdminLesson> {
    const res = await apiClient.post<LessonEnvelope>(`/admin/lessons/${id}/move`, input);
    return res.data.data.lesson;
  },

  /** `lessonIds` must list every active lesson in the topic exactly once. */
  async reorder(topicId: string, lessonIds: string[]): Promise<AdminLesson[]> {
    const res = await apiClient.patch<ApiEnvelope<{ lessons: AdminLesson[] }>>(`/admin/topics/${topicId}/lessons/reorder`, { lessonIds });
    return res.data.data.lessons;
  },

  /** Authorized staff preview (draft lessons included). */
  async preview(id: string): Promise<AdminLesson> {
    const res = await apiClient.get<LessonEnvelope>(`/admin/lessons/${id}/preview`);
    return res.data.data.lesson;
  },
};
