import type { Paginated } from './instructors';

export type ReferralStatus = 'pending' | 'contacted' | 'converted' | 'rejected';

/** Shape returned by toAdminObject() on the backend. adminNotes is admin-only. */
export interface Referral {
  id: string;
  referrerName: string;
  referrerEmail: string;
  referrerPhone: string;
  friendName: string;
  friendPhone: string;
  message: string;
  status: ReferralStatus;
  adminNotes: string;
  handledBy: string | null;
  handledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReferralsResponse = Paginated<Referral>;

/** Query params accepted by GET /admin/referrals (listQuery). */
export interface ReferralListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ReferralStatus;
  startDate?: string;
  endDate?: string;
  sort?: 'newest' | 'oldest';
}

/** Body for PATCH /admin/referrals/:id/status. */
export interface UpdateReferralStatusInput {
  status: ReferralStatus;
  adminNotes?: string;
}
