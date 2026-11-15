export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Backend envelopes vary by module: `{ data }`, `{ data, pagination }`, or `{ data: { items, pagination } }`. */
export interface ApiEnvelope<T> {
  success: true;
  data: T;
  pagination?: Pagination;
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
}
