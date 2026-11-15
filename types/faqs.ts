import type { Paginated } from './instructors';

export type FaqStatus = 'draft' | 'published';

/** Faq.toAdminObject() */
export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  relatedCourseId: string | null;
  displayOrder: number;
  status: FaqStatus;
  isFeatured: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FaqsResponse = Paginated<Faq>;

/** GET /admin/faqs query (listQuery). */
export interface FaqListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: FaqStatus;
  category?: string;
  relatedCourseId?: string;
}

/** POST /admin/faqs body (createBody). */
export interface CreateFaqInput {
  question: string;
  answer: string;
  category?: string;
  relatedCourseId?: string | null;
  displayOrder?: number;
  isFeatured?: boolean;
}

/** PATCH /admin/faqs/:id — same shape, all optional. */
export type UpdateFaqInput = Partial<CreateFaqInput>;
