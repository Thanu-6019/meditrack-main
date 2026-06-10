// src/utils/api.ts
// ============================================================
// Client-side API helper — typed fetch wrapper
// Auth via HTTP-only cookie (credentials: 'include'). No localStorage.
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}


export class ApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/**
 * apiFetch
 * Core request function. Unwraps the { success, data } envelope.
 * Throws ApiError on non-2xx or { success: false } responses.
 */
async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, signal, headers = {} } = options;

  const res = await fetch(path, {
    method,
    credentials: 'include', // send/receive the HTTP-only auth cookie
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    cache: 'no-store',
  });

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    // Non-JSON response
    if (!res.ok) {
      throw new ApiError(`Request failed (${res.status})`, res.status);
    }
    throw new ApiError('Invalid server response', res.status);
  }

  if (!res.ok || !payload.success) {
    const message =
      (payload && !payload.success && payload.error?.message) ||
      `Request failed (${res.status})`;
    const code =
      (payload && !payload.success && payload.error?.code) || null;
    throw new ApiError(message, res.status, code);
  }

  return payload.data;
}

// ─── Convenience methods ─────────────────────
export const api = {
  get: <T>(path: string, signal?: AbortSignal) =>
    apiFetch<T>(path, { method: 'GET', signal }),

  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiFetch<T>(path, { method: 'POST', body, signal }),

  put: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiFetch<T>(path, { method: 'PUT', body, signal }),

  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiFetch<T>(path, { method: 'PATCH', body, signal }),

  delete: <T>(path: string, signal?: AbortSignal) =>
    apiFetch<T>(path, { method: 'DELETE', signal }),
};