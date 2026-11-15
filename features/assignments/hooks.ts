'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { PERSIST_META } from '@/lib/query-persist';
import { hasPermissions } from '@/lib/roles';
import { assignmentsService } from '@/services/assignments.service';
import { dashboardService } from '@/services/dashboard.service';
import { enrollmentsService } from '@/services/enrollments.service';
import type { AuthUser } from '@/types/auth';
import type {
  Assignment,
  AssignmentListParams,
  AssignmentStatus,
  CreateAssignmentInput,
  GradeSubmissionInput,
  Submission,
  SubmissionListParams,
  UpdateAssignmentInput,
} from '@/types/assignments';
import type { EnrollmentListParams } from '@/types/enrollments';

/** Mirrors the route guards in adminAssignment.routes.js. */
export const assignmentPolicy = {
  canCreate: (u: AuthUser | null) => hasPermissions(u, ['assignments.create']),
  canUpdate: (u: AuthUser | null) => hasPermissions(u, ['assignments.update']),
  canDelete: (u: AuthUser | null) => hasPermissions(u, ['assignments.delete']),
  canChangeStatus: (u: AuthUser | null) => hasPermissions(u, ['assignments.publish']),
  canReadSubmissions: (u: AuthUser | null) => hasPermissions(u, ['assignments.submissions.read']),
  canGrade: (u: AuthUser | null) => hasPermissions(u, ['assignments.grade']),
};

/** Fresh details for the open assignment; the list row is shown until the request settles. */
export function useAssignmentDetail(id: string, seed: Assignment) {
  return useQuery({
    queryKey: queryKeys.assignments.detail(id),
    queryFn: () => assignmentsService.get(id),
    placeholderData: seed,
  });
}

function useApplyAssignment() {
  const queryClient = useQueryClient();
  return (assignment: Assignment, { removed = false }: { removed?: boolean } = {}) => {
    if (removed) queryClient.removeQueries({ queryKey: queryKeys.assignments.detail(assignment.id) });
    else queryClient.setQueryData(queryKeys.assignments.detail(assignment.id), assignment);
    queryClient.invalidateQueries({ queryKey: queryKeys.assignments.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.assignments.stats() });
  };
}

export function useCreateAssignment() {
  const apply = useApplyAssignment();
  return useMutation({
    mutationFn: (input: CreateAssignmentInput) => assignmentsService.create(input),
    onSuccess: (a) => apply(a),
  });
}

export function useUpdateAssignment() {
  const apply = useApplyAssignment();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAssignmentInput }) => assignmentsService.update(id, input),
    onSuccess: (a) => apply(a),
  });
}

export function useAssignmentStatus() {
  const apply = useApplyAssignment();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AssignmentStatus }) => assignmentsService.changeStatus(id, status),
    onSuccess: (a) => apply(a),
  });
}

export function useDeleteAssignment() {
  const apply = useApplyAssignment();
  return useMutation({
    mutationFn: (id: string) => assignmentsService.remove(id),
    onSuccess: (a) => apply(a, { removed: true }),
  });
}

/** Full submission (feedback + history); the list row is shown until it loads. */
export function useSubmissionDetail(submission: Submission, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.assignments.submission(submission.id),
    queryFn: () => assignmentsService.submission(submission.id),
    enabled,
    placeholderData: submission,
  });
}

/** Loaded only when the reviewer opens the history panel. */
export function useSubmissionHistory(id: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.assignments.submissionHistory(id),
    queryFn: () => assignmentsService.submissionHistory(id),
    enabled,
  });
}

export function useAssignmentsList(params: AssignmentListParams) {
  return useQuery({
    queryKey: queryKeys.assignments.list(params),
    queryFn: () => assignmentsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export const ASSIGNMENT_STAT_KEYS = ['all', 'published', 'draft', 'closed'] as const;
export type AssignmentStatKey = (typeof ASSIGNMENT_STAT_KEYS)[number];

/** Totals from list pagination (no aggregate endpoint); persisted across reloads. */
export function useAssignmentStats() {
  const results = useQueries({
    queries: ASSIGNMENT_STAT_KEYS.map((key) => ({
      queryKey: queryKeys.assignments.stat(key),
      queryFn: () => dashboardService.count('/admin/assignments', key === 'all' ? {} : { status: key }),
      meta: PERSIST_META,
    })),
  });
  return ASSIGNMENT_STAT_KEYS.reduce(
    (acc, key, i) => {
      acc[key] = { value: results[i].data ?? null, isLoading: results[i].isPending, error: results[i].error };
      return acc;
    },
    {} as Record<AssignmentStatKey, { value: number | null; isLoading: boolean; error: unknown }>
  );
}

export function useSubmissions(assignmentId: string | null, params: SubmissionListParams, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.assignments.submissions(assignmentId ?? '', params),
    queryFn: () => assignmentsService.submissions(assignmentId as string, params),
    enabled: Boolean(assignmentId) && enabled,
    placeholderData: keepPreviousData,
  });
}

/**
 * Submissions only carry `studentId`. Every submitter is enrolled in the course, so one
 * course-filtered enrollment page (shared enrollments cache) resolves names and emails.
 */
export function useCourseLearners(courseId: string | null, enabled: boolean) {
  const params: EnrollmentListParams = { page: 1, limit: 100, courseId: courseId ?? undefined };
  const query = useQuery({
    queryKey: queryKeys.enrollments.list(params),
    queryFn: () => enrollmentsService.list(params),
    enabled: Boolean(courseId) && enabled,
    staleTime: 5 * 60_000,
  });
  const byId = new Map<string, { name: string; email: string }>();
  for (const e of query.data?.enrollments ?? []) {
    if (e.student) byId.set(e.studentId, { name: [e.student.firstName, e.student.lastName].filter(Boolean).join(' ') || e.student.email, email: e.student.email });
  }
  return { byId, isPending: query.isPending && Boolean(courseId) && enabled };
}

function useApplySubmission() {
  const queryClient = useQueryClient();
  return (submission: Submission) => {
    // Grade/return responses include history; keep list rows in sync without waiting for the refetch
    queryClient.setQueriesData<{ submissions: Submission[] }>({ queryKey: queryKeys.assignments.submissionsOf(submission.assignmentId) }, (old) =>
      old ? { ...old, submissions: old.submissions.map((s) => (s.id === submission.id ? { ...s, ...submission } : s)) } : old
    );
    queryClient.setQueryData(queryKeys.assignments.submission(submission.id), submission);
    queryClient.invalidateQueries({ queryKey: queryKeys.assignments.submissionsOf(submission.assignmentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.assignments.submissionHistory(submission.id) });
  };
}

export function useGradeSubmission() {
  const apply = useApplySubmission();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: GradeSubmissionInput }) => assignmentsService.grade(id, input),
    onSuccess: apply,
  });
}

export function useReturnSubmission() {
  const apply = useApplySubmission();
  return useMutation({
    mutationFn: ({ id, feedback }: { id: string; feedback?: string }) => assignmentsService.returnForCorrection(id, feedback),
    onSuccess: apply,
  });
}

export function useDownloadAttachment() {
  return useMutation({
    mutationFn: async ({ submissionId, attachment }: { submissionId: string; attachment: { id: string; originalFileName: string } }) => {
      const blob = await assignmentsService.downloadAttachment(submissionId, attachment.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.originalFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
  });
}
