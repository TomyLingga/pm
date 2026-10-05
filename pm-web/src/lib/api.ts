import type { ApiEnvelope, ValidationErrors } from "@/types/api";
import { portalLaunchTarget } from "./env";

/** All pm-api endpoints live under this prefix (proxied to Laravel by next.config rewrites). */
export const API_PREFIX = "/api/v1";

const XSRF_COOKIE = "XSRF-TOKEN";

export class ApiError extends Error {
  readonly status: number;
  readonly errors: ValidationErrors;

  constructor(status: number, message: string, errors: ValidationErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }

  /** First validation message for a field (exact key), if any. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function errorMessage(error: unknown, fallback = "Terjadi kesalahan. Silakan coba lagi."): string {
  if (error instanceof ApiError || error instanceof Error) return error.message || fallback;
  return fallback;
}

type QueryPrimitive = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryPrimitive | QueryPrimitive[]>;

/** Builds `?a=1&b=2`, skipping empty values. Arrays are joined with commas. */
export function buildQuery(params?: QueryParams | object): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, raw] of Object.entries(params as QueryParams)) {
    if (Array.isArray(raw)) {
      const values = raw.filter((v) => v !== null && v !== undefined && v !== "");
      if (values.length) search.set(key, values.join(","));
      continue;
    }
    if (raw === null || raw === undefined || raw === "") continue;
    search.set(key, String(raw));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const row = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  if (!row) return null;
  try {
    return decodeURIComponent(row.slice(prefix.length));
  } catch {
    return row.slice(prefix.length);
  }
}

let csrfRequest: Promise<void> | null = null;

/**
 * Returns the decoded `XSRF-TOKEN` cookie, calling `GET /sanctum/csrf-cookie` first when
 * the cookie is missing (or when `force` is set, e.g. after a 419).
 */
export async function ensureCsrfToken(force = false): Promise<string> {
  if (!force) {
    const existing = readCookie(XSRF_COOKIE);
    if (existing) return existing;
  }
  if (!csrfRequest) {
    csrfRequest = fetch("/sanctum/csrf-cookie", {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then((res) => {
        if (!res.ok) {
          throw new ApiError(res.status, "Gagal menyiapkan sesi keamanan (CSRF). Silakan muat ulang halaman.");
        }
      })
      .finally(() => {
        csrfRequest = null;
      });
  }
  await csrfRequest;
  const token = readCookie(XSRF_COOKIE);
  if (!token) throw new ApiError(0, "Cookie keamanan (XSRF-TOKEN) tidak ditemukan. Pastikan cookie diizinkan.");
  return token;
}

let redirecting = false;

/** Sends the browser to the Portal launch URL (once, even if several requests fail together). */
export function redirectToPortal(): void {
  if (typeof window === "undefined" || redirecting) return;
  redirecting = true;
  window.location.href = portalLaunchTarget();
}

function defaultMessage(status: number): string {
  switch (status) {
    case 401:
      return "Sesi Anda telah berakhir. Silakan masuk kembali melalui Portal.";
    case 403:
      return "Anda tidak berwenang melakukan tindakan ini.";
    case 404:
      return "Data tidak ditemukan.";
    case 409:
      return "Status dokumen sudah berubah. Muat ulang halaman lalu coba lagi.";
    case 413:
      return "Ukuran file terlalu besar.";
    case 419:
      return "Sesi keamanan kedaluwarsa. Muat ulang halaman lalu coba lagi.";
    case 422:
      return "Data yang dikirim belum valid. Periksa kembali isian Anda.";
    case 429:
      return "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.";
    default:
      return status >= 500 ? "Terjadi kesalahan pada server. Silakan coba lagi." : "Permintaan gagal diproses.";
  }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  query?: QueryParams | object;
  /** Plain objects are sent as JSON; FormData is sent as multipart. */
  body?: unknown;
  signal?: AbortSignal;
  /** Redirect the browser to the Portal on 401 (default true). */
  redirectOnUnauthorized?: boolean;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Low-level request against `/api/v1`. Returns the parsed JSON body (or undefined for 204). */
export async function apiRequest<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  let body: BodyInit | undefined;
  if (typeof FormData !== "undefined" && options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  if (method !== "GET") {
    headers["X-XSRF-TOKEN"] = await ensureCsrfToken(isRetry);
  }

  let res: Response;
  try {
    res = await fetch(`${API_PREFIX}${path}${buildQuery(options.query)}`, {
      method,
      headers,
      body,
      credentials: "include",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
  }

  // CSRF token mismatch: refresh the cookie once and retry.
  if (res.status === 419 && method !== "GET" && !isRetry) {
    return apiRequest<T>(path, options, true);
  }

  if (res.status === 204) return undefined as T;

  const payload = (await parseBody(res)) as { message?: string; errors?: ValidationErrors } | undefined;

  if (!res.ok) {
    if (res.status === 401 && options.redirectOnUnauthorized !== false) {
      redirectToPortal();
    }
    throw new ApiError(res.status, payload?.message || defaultMessage(res.status), payload?.errors ?? {});
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"], options?: Omit<RequestOptions, "method" | "query">) =>
    apiRequest<T>(path, { ...options, method: "GET", query }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "POST", body: body ?? {} }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PUT", body: body ?? {} }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method">) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
};

/** Unwraps the `{ data }` envelope. */
export async function unwrap<T>(request: Promise<ApiEnvelope<T>>): Promise<T> {
  const res = await request;
  return res.data;
}
