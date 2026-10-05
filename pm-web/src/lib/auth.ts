import type { ApiEnvelope } from "@/types/api";
import type { Me } from "@/types/auth";
import { api, ensureCsrfToken, unwrap } from "./api";
import { portalHomeTarget } from "./env";

export function getMe(signal?: AbortSignal): Promise<Me> {
  return unwrap(api.get<ApiEnvelope<Me>>("/auth/me", undefined, { signal }));
}

/** Exchanges the single-use Portal token for a Sanctum session cookie. */
export async function loginWithSso(token: string, appId: string | null): Promise<Me> {
  await ensureCsrfToken(true);
  return unwrap(
    api.post<ApiEnvelope<Me>>(
      "/auth/sso",
      { token, app_id: appId },
      // A failed exchange must show the error page, not bounce back to the Portal.
      { redirectOnUnauthorized: false },
    ),
  );
}

/** Ends the local session and returns to the Portal home (the Portal session stays alive). */
export async function logout(): Promise<void> {
  try {
    await api.post<void>("/auth/logout", {}, { redirectOnUnauthorized: false });
  } finally {
    window.location.href = portalHomeTarget();
  }
}

export function hasGlobalRole(me: Me | undefined, ...roles: string[]): boolean {
  return !!me?.roles?.some((role) => roles.includes(role));
}

export function isExecutorStaff(me: Me | undefined): boolean {
  return (me?.executor_units?.length ?? 0) > 0;
}

/** Most specific organisation label for the user ("Pengadaan"). */
export function orgUnitLabel(me: Me | undefined): string {
  if (!me) return "";
  return me.org_unit?.name || me.sub_bagian || me.bagian || "";
}
