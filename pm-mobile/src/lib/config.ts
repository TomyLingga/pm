// Runtime configuration. EXPO_PUBLIC_* variables are inlined at bundle time,
// so they must be referenced statically (no dynamic process.env lookups).

const DEFAULT_API_URL = 'https://pm.inl.co.id/api/v1';

function normalizeBaseUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  return (value.length > 0 ? value : DEFAULT_API_URL).replace(/\/+$/, '');
}

/** Base URL including the `/api/v1` prefix, without trailing slash. */
export const API_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_PM_API_URL);

/** Scheme + host (+ port) of the API, e.g. `https://pm.inl.co.id`. */
export const API_ORIGIN = (() => {
  const match = /^(https?:\/\/[^/]+)/i.exec(API_URL);
  return match ? match[1] : API_URL;
})();

/**
 * Builds an absolute URL for a server path. Attachment `url` values are paths such as
 * `/api/v1/attachments/5` (relative to the origin); paths without a leading slash are
 * treated as relative to the API base URL.
 */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith('/')) return `${API_ORIGIN}${pathOrUrl}`;
  return `${API_URL}/${pathOrUrl}`;
}

export const MAX_ATTACHMENTS_PER_WO = 10;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
