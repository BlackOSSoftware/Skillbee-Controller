'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { isSuperAdmin } from '@/lib/roles';
import { lessonsService, topicsService } from '@/services/curriculum.service';
import { lessonAttachmentsService, lessonVideoService, type UploadOptions } from '@/services/lesson-media.service';
import type { AuthUser } from '@/types/auth';
import type { AdminLesson, AttachmentMetaInput, CreateLessonInput, LessonStatus, TopicInput, UpdateAttachmentInput, UpdateLessonInput } from '@/types/curriculum';

function any(user: AuthUser | null, codes: string[]): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const owned = new Set(user.role?.permissions ?? []);
  return codes.some((c) => owned.has(c));
}

const MANAGE = 'courses.curriculum.manage';
const INSTRUCTOR = 'instructor.curriculum.manage';

/** Mirrors the permission sets in lesson.routes.js and curriculum.routes.js. */
export const curriculumPolicy = {
  canWriteTopics: (u: AuthUser | null) => any(u, [MANAGE, 'courses.curriculum.create', 'courses.curriculum.update', INSTRUCTOR]),
  canDeleteTopics: (u: AuthUser | null) => any(u, [MANAGE, 'courses.curriculum.delete', INSTRUCTOR]),
  canWriteLessons: (u: AuthUser | null) => any(u, [MANAGE, 'courses.lessons.create', 'courses.lessons.update', INSTRUCTOR]),
  canDeleteLessons: (u: AuthUser | null) => any(u, [MANAGE, 'courses.lessons.delete', INSTRUCTOR]),
  canPublishLessons: (u: AuthUser | null) => any(u, [MANAGE, 'courses.lessons.publish', INSTRUCTOR]),
  canUploadVideo: (u: AuthUser | null) => any(u, [MANAGE, 'courses.media.upload', INSTRUCTOR, 'instructor.resources.manage']),
  canDeleteVideo: (u: AuthUser | null) => any(u, [MANAGE, 'courses.media.delete', INSTRUCTOR]),
  canManageAttachments: (u: AuthUser | null) => any(u, [MANAGE, 'courses.attachments.manage', 'courses.resources.manage', 'instructor.resources.manage', INSTRUCTOR]),
};

export function useAdminLesson(id: string | null) {
  return useQuery({
    queryKey: queryKeys.curriculum.lesson(id ?? ''),
    queryFn: () => lessonsService.get(id as string),
    enabled: Boolean(id),
  });
}

export function useLessonPreview(id: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.curriculum.preview(id), queryFn: () => lessonsService.preview(id), enabled, staleTime: 0 });
}

const IN_FLIGHT = new Set(['pending', 'processing']);

/** Polls every 4 s only while the backend reports pending/processing; stops on ready/failed. */
export function useVideoStatus(id: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.curriculum.videoStatus(id),
    queryFn: () => lessonVideoService.status(id),
    enabled,
    staleTime: 0,
    refetchInterval: (query) => (IN_FLIGHT.has(query.state.data?.processingStatus ?? '') ? 4000 : false),
  });
}

export function useLessonAttachments(id: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.curriculum.attachments(id), queryFn: () => lessonAttachmentsService.list(id), enabled });
}

export function useAttachmentDetail(lessonId: string, fileId: string | null) {
  return useQuery({
    queryKey: queryKeys.curriculum.attachment(lessonId, fileId ?? ''),
    queryFn: () => lessonAttachmentsService.get(lessonId, fileId as string),
    enabled: Boolean(fileId),
    staleTime: 0,
  });
}

/** Outline, analytics and learner views all derive from lessons, so they refresh together. */
function useCurriculumInvalidation() {
  const queryClient = useQueryClient();
  return {
    outline: (courseId: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.topics(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.analytics(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.learning.curriculum(courseId) });
    },
    lesson: (lesson: AdminLesson) => {
      queryClient.setQueryData(queryKeys.curriculum.lesson(lesson.id), lesson);
      queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.preview(lesson.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.videoStatus(lesson.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.learning.lesson(lesson.id) });
    },
    removeLesson: (id: string) => queryClient.removeQueries({ queryKey: queryKeys.curriculum.lesson(id) }),
    attachments: (lessonId: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.attachments(lessonId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.learning.attachments(lessonId) });
    },
  };
}

export function useCreateTopic(courseId: string) {
  const inv = useCurriculumInvalidation();
  return useMutation({ mutationFn: (input: TopicInput & { title: string }) => topicsService.create(courseId, input), onSuccess: () => inv.outline(courseId) });
}

export function useUpdateTopic(courseId: string) {
  const inv = useCurriculumInvalidation();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: TopicInput }) => topicsService.update(id, input), onSuccess: () => inv.outline(courseId) });
}

export function useArchiveTopic(courseId: string) {
  const inv = useCurriculumInvalidation();
  return useMutation({ mutationFn: (id: string) => topicsService.remove(id), onSuccess: () => inv.outline(courseId) });
}

export function useCreateLesson(courseId: string) {
  const inv = useCurriculumInvalidation();
  return useMutation({
    mutationFn: ({ topicId, input }: { topicId: string; input: CreateLessonInput }) => lessonsService.create(topicId, input),
    onSuccess: (lesson) => {
      inv.lesson(lesson);
      inv.outline(courseId);
    },
  });
}

export function useUpdateLesson() {
  const inv = useCurriculumInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLessonInput }) => lessonsService.update(id, input),
    onSuccess: (lesson) => {
      inv.lesson(lesson);
      inv.outline(lesson.courseId);
    },
  });
}

export function useLessonStatus() {
  const inv = useCurriculumInvalidation();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LessonStatus }) => lessonsService.changeStatus(id, status),
    onSuccess: (lesson) => {
      inv.lesson(lesson);
      inv.outline(lesson.courseId);
    },
  });
}

export function useDuplicateLesson() {
  const inv = useCurriculumInvalidation();
  return useMutation({
    mutationFn: (id: string) => lessonsService.duplicate(id),
    onSuccess: (lesson) => {
      inv.lesson(lesson);
      inv.outline(lesson.courseId);
    },
  });
}

export function useArchiveLesson() {
  const inv = useCurriculumInvalidation();
  return useMutation({
    mutationFn: (id: string) => lessonsService.archive(id),
    onSuccess: (lesson) => {
      inv.removeLesson(lesson.id);
      inv.outline(lesson.courseId);
    },
  });
}

/**
 * Moves within the same course, then rewrites the target topic's order so the lesson lands at the
 * chosen position (the move endpoint only sets the moved lesson's sortOrder).
 */
export function useMoveLesson() {
  const inv = useCurriculumInvalidation();
  return useMutation({
    mutationFn: async ({ lesson, targetTopicId, position, targetOrder }: { lesson: AdminLesson; targetTopicId: string; position: number; targetOrder: string[] }) => {
      const moved = await lessonsService.move(lesson.id, { targetTopicId, targetPosition: position });
      const order = targetOrder.filter((id) => id !== lesson.id);
      order.splice(Math.min(position, order.length), 0, lesson.id);
      await lessonsService.reorder(targetTopicId, order);
      return moved;
    },
    onSuccess: (lesson) => {
      inv.lesson(lesson);
      inv.outline(lesson.courseId);
    },
  });
}

export function useUploadVideo() {
  const inv = useCurriculumInvalidation();
  return useMutation({
    mutationFn: ({ id, file, options }: { id: string; file: File; options: UploadOptions }) => lessonVideoService.upload(id, file, options),
    onSuccess: (lesson) => {
      inv.lesson(lesson);
      inv.outline(lesson.courseId);
    },
  });
}

export function useDeleteVideo() {
  const inv = useCurriculumInvalidation();
  return useMutation({
    mutationFn: (id: string) => lessonVideoService.remove(id),
    onSuccess: (lesson) => {
      inv.lesson(lesson);
      inv.outline(lesson.courseId);
    },
  });
}

export function useUploadAttachment(lessonId: string) {
  const inv = useCurriculumInvalidation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, meta, options }: { file: File; meta: AttachmentMetaInput; options: UploadOptions }) => lessonAttachmentsService.upload(lessonId, file, meta, options),
    onSuccess: () => {
      inv.attachments(lessonId);
      // Resource lessons link uploaded files into resourceContent.resourceIds
      queryClient.invalidateQueries({ queryKey: queryKeys.curriculum.lesson(lessonId) });
    },
  });
}

export function useUpdateAttachment(lessonId: string) {
  const inv = useCurriculumInvalidation();
  return useMutation({
    mutationFn: ({ fileId, input }: { fileId: string; input: UpdateAttachmentInput }) => lessonAttachmentsService.update(lessonId, fileId, input),
    onSuccess: () => inv.attachments(lessonId),
  });
}

export function useArchiveAttachment(lessonId: string) {
  const inv = useCurriculumInvalidation();
  return useMutation({ mutationFn: (fileId: string) => lessonAttachmentsService.archive(lessonId, fileId), onSuccess: () => inv.attachments(lessonId) });
}
