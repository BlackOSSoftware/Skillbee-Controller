import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { env } from './env';
import { tokenStore } from './token-store';
import type { ApiEnvelope } from '@/types/api';
import type { AuthSession } from '@/types/auth';

const baseConfig: AxiosRequestConfig = {
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    // Bearer-token app: backend must not read/write the shared localhost auth cookies.
    'X-App-Scope': 'admin',
  },
};

export const apiClient = axios.create(baseConfig);

/** Separate instance so refresh calls never recurse through the 401 interceptor. */
const refreshClient = axios.create(baseConfig);

const AUTH_PATHS_WITHOUT_REFRESH = ['/auth/login', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];

let refreshPromise: Promise<AuthSession> | null = null;

/** Single-flight refresh: concurrent 401s share one refresh request. */
export function refreshSession(): Promise<AuthSession> {
  if (!refreshPromise) {
    const refreshToken = tokenStore.getRefresh();
    refreshPromise = refreshClient
      .post<ApiEnvelope<AuthSession>>('/auth/refresh', refreshToken ? { refreshToken } : {})
      .then((res) => {
        tokenStore.set(res.data.data.accessToken);
        if (res.data.data.refreshToken) tokenStore.setRefresh(res.data.data.refreshToken);
        return res.data.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url || '';
    const skipRefresh = AUTH_PATHS_WITHOUT_REFRESH.some((p) => url.startsWith(p));

    // Learner 403s (not enrolled, scheduled) are content gates, not role changes
    if (status === 403 && !url.startsWith('/auth/') && !url.startsWith('/learning/')) {
      tokenStore.emitForbidden();
    }

    if (status === 401 && original && !original._retried && !skipRefresh) {
      original._retried = true;
      try {
        await refreshSession();
        return apiClient(original);
      } catch (refreshError) {
        // Rate limits and network failures are transient; only a rejected refresh ends the session.
        const refreshStatus = refreshError instanceof AxiosError ? refreshError.response?.status : undefined;
        if (refreshStatus === 401 || refreshStatus === 403) tokenStore.emitUnauthorized();
      }
    }
    return Promise.reject(error);
  }
);
