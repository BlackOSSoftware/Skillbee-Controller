import { isAxiosError } from 'axios';
import type { ApiErrorBody } from '@/types/api';

export interface FieldIssue {
  path: string;
  message: string;
}

export interface NormalizedApiError {
  status: number | null;
  code: string;
  message: string;
  /** Zod issues from backend VALIDATION_ERROR responses (`path` is dot-joined). */
  fieldErrors: FieldIssue[];
  /** Seconds to wait before retrying a 429; set only for rate-limit errors. */
  retryAfterSeconds?: number;
}

/** Used when the browser cannot read Retry-After (backend CORS does not expose it). */
export const RATE_LIMIT_FALLBACK_SECONDS = 30;

function toFieldIssues(details: unknown): FieldIssue[] {
  if (!Array.isArray(details)) return [];
  return details
    .filter((d): d is { path: unknown; message: unknown } => typeof d === 'object' && d !== null)
    .map((d) => ({ path: String(d.path ?? ''), message: String(d.message ?? '') }))
    .filter((d) => d.message);
}

function parseRetryAfter(headers: Record<string, unknown> | undefined): number {
  const raw = headers?.['retry-after'] ?? headers?.['ratelimit-reset'];
  if (raw === undefined || raw === null || raw === '') return RATE_LIMIT_FALLBACK_SECONDS;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(String(raw));
  if (!Number.isNaN(date)) return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  return RATE_LIMIT_FALLBACK_SECONDS;
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  if (isAxiosError<ApiErrorBody>(error)) {
    const status = error.response?.status ?? null;
    const body = error.response?.data;
    if (status === 429) {
      return {
        status,
        code: body?.error?.code ?? 'RATE_LIMITED',
        message: 'The API rate limit was reached. Wait a moment, then try again.',
        fieldErrors: [],
        retryAfterSeconds: parseRetryAfter(error.response?.headers as Record<string, unknown> | undefined),
      };
    }
    if (body?.error) {
      return {
        status,
        code: body.error.code,
        message: body.error.message,
        fieldErrors: toFieldIssues(body.error.details),
      };
    }
    if (!error.response) {
      return {
        status: null,
        code: 'NETWORK_ERROR',
        message: 'Cannot reach the SkillBee API. Check that the backend is running and CORS allows this origin.',
        fieldErrors: [],
      };
    }
    return { status, code: 'HTTP_ERROR', message: error.message, fieldErrors: [] };
  }
  if (error instanceof Error) {
    return { status: null, code: 'UNKNOWN_ERROR', message: error.message, fieldErrors: [] };
  }
  return { status: null, code: 'UNKNOWN_ERROR', message: 'Something went wrong', fieldErrors: [] };
}

export function isForbidden(error: unknown): boolean {
  return normalizeApiError(error).status === 403;
}
