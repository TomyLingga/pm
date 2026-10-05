import { API_URL } from './config';

/** Error thrown for any non-2xx response or network failure. */
export class ApiError extends Error {
  readonly status: number;
  readonly errors: Record<string, string[]>;

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }

  /** First validation message for a field, if any. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, QueryValue>;
  /** JSON body (ignored when `formData` is set). */
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  /** Do not trigger the global 401 handler (used by login endpoints). */
  skipAuthHandler?: boolean;
}

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

/** Registered by AuthContext: clears the session and routes back to login. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `${url}?${parts.join('&')}` : url;
}

function defaultMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Sesi Anda telah berakhir. Silakan masuk kembali.';
    case 403:
      return 'Anda tidak berwenang melakukan aksi ini.';
    case 404:
      return 'Data tidak ditemukan.';
    case 409:
      return 'Status Work Order sudah berubah. Muat ulang lalu coba lagi.';
    case 413:
      return 'Ukuran file terlalu besar.';
    case 422:
      return 'Data yang diisi belum valid.';
    case 429:
      return 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.';
    default:
      return status >= 500 ? 'Terjadi kesalahan pada server. Coba lagi nanti.' : `Permintaan gagal (${status}).`;
  }
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, formData, signal, skipAuthHandler } = options;
  const headers: Record<string, string> = { Accept: 'application/json', ...authHeaders() };

  let payload: string | FormData | undefined;
  if (formData) {
    // Let fetch set the multipart boundary.
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), { method, headers, body: payload, signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let json: unknown = undefined;
  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }

  if (!res.ok) {
    const obj = (json && typeof json === 'object' ? json : {}) as {
      message?: unknown;
      errors?: unknown;
    };
    const errors =
      obj.errors && typeof obj.errors === 'object' ? (obj.errors as Record<string, string[]>) : {};
    const firstFieldError = Object.values(errors)[0]?.[0];
    const serverMessage = typeof obj.message === 'string' && obj.message.trim() ? obj.message : undefined;
    // Laravel 429 responses carry an English "Too Many Attempts." message; prefer Indonesian.
    const message =
      res.status === 429 && serverMessage === 'Too Many Attempts.'
        ? defaultMessage(429)
        : serverMessage ?? firstFieldError ?? defaultMessage(res.status);

    if (res.status === 401 && !skipAuthHandler && authToken) {
      unauthorizedHandler?.();
    }
    throw new ApiError(res.status, message, errors);
  }

  return json as T;
}

/** Human readable message for any thrown error (used in Alerts). */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 422) {
      const lines = Object.values(e.errors)
        .flat()
        .filter((m): m is string => typeof m === 'string');
      if (lines.length > 1) return lines.slice(0, 5).join('\n');
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return 'Terjadi kesalahan yang tidak diketahui.';
}
