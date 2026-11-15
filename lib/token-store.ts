/**
 * Access token lives in memory only. The refresh token is persisted in
 * localStorage and sent in the request body — each frontend origin (admin,
 * instructor, student) keeps its own session instead of sharing the
 * localhost-wide httpOnly cookie.
 */
const REFRESH_KEY = 'sb.refreshToken';

let accessToken: string | null = null;
let refreshToken: string | null =
  typeof window !== 'undefined' ? window.localStorage.getItem(REFRESH_KEY) : null;

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();
const forbiddenListeners = new Set<Listener>();

function persistRefresh(token: string | null) {
  refreshToken = token;
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(REFRESH_KEY, token);
  else window.localStorage.removeItem(REFRESH_KEY);
}

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
  getRefresh: () => refreshToken,
  setRefresh: (token: string | null) => persistRefresh(token),
  clear: () => {
    accessToken = null;
    persistRefresh(null);
  },
  onUnauthorized: (listener: Listener) => {
    unauthorizedListeners.add(listener);
    return () => {
      unauthorizedListeners.delete(listener);
    };
  },
  emitUnauthorized: () => {
    accessToken = null;
    unauthorizedListeners.forEach((listener) => listener());
  },
  /** A 403 means the role's permissions may have changed since the session was loaded. */
  onForbidden: (listener: Listener) => {
    forbiddenListeners.add(listener);
    return () => {
      forbiddenListeners.delete(listener);
    };
  },
  emitForbidden: () => {
    forbiddenListeners.forEach((listener) => listener());
  },
};
