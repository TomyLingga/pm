import type { ApiEnvelope } from "@/types/api";
import type { PublicSignature } from "@/types/signature";
import { api, unwrap } from "./api";

/** Public QR verification (no login). */
export function getPublicSignature(token: string, signal?: AbortSignal): Promise<PublicSignature> {
  return unwrap(
    api.get<ApiEnvelope<PublicSignature>>(`/public/signatures/${encodeURIComponent(token)}`, undefined, {
      signal,
      redirectOnUnauthorized: false,
    }),
  );
}

/**
 * Extracts the verification token from a signature `verify_url`
 * (e.g. `https://pm.inl.co.id/verifikasi/abc123` -> `abc123`).
 */
export function tokenFromVerifyUrl(verifyUrl: string | null | undefined): string | null {
  if (!verifyUrl) return null;
  let pathname = verifyUrl;
  try {
    pathname = new URL(verifyUrl, "http://localhost").pathname;
  } catch {
    // keep the raw value
  }
  const match = pathname.match(/\/verifikasi\/([^/?#]+)/);
  if (match) return decodeURIComponent(match[1]);
  const last = pathname.split("/").filter(Boolean).pop();
  return last ? decodeURIComponent(last) : null;
}
