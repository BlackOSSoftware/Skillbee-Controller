import { apiClient } from '@/lib/api-client';
import { compactParams } from '@/lib/compact-params';
import type { ApiEnvelope, Pagination } from '@/types/api';
import type { AdminReview, AdminReviewDetail, ModeratedReview, ModerateReviewInput, ReviewListParams, ReviewListResponse } from '@/types/reviews';

export const reviewsService = {
  /** Response: { success, data: { reviews }, pagination }; soft-deleted reviews are excluded. */
  async list(params: ReviewListParams): Promise<ReviewListResponse> {
    const res = await apiClient.get<ApiEnvelope<{ reviews: AdminReview[] }> & { pagination: Pagination }>('/admin/reviews', { params: compactParams(params) });
    return { reviews: res.data.data.reviews, pagination: res.data.pagination };
  },

  async get(id: string): Promise<AdminReviewDetail> {
    const res = await apiClient.get<ApiEnvelope<{ review: AdminReviewDetail }>>(`/admin/reviews/${id}`);
    return res.data.data.review;
  },

  /** Approve or reject; only approved reviews count towards a course's public rating. */
  async moderate(id: string, input: ModerateReviewInput): Promise<ModeratedReview> {
    const res = await apiClient.patch<ApiEnvelope<{ review: ModeratedReview }>>(`/admin/reviews/${id}/status`, input);
    return res.data.data.review;
  },

  /** Soft delete: sets `deletedAt`, hides the review everywhere and recalculates the course rating. */
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/admin/reviews/${id}`);
  },
};
