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

/** The only elevated role: sees every unit's documents and manages access. */
export function isAdmin(me: Me | undefined): boolean {
  return me?.is_admin === true || hasGlobalRole(me, "admin");
}

/** Preventive Maintenance (and the equipment master) is for executor staff and admins. */
export function canAccessPm(me: Me | undefined): boolean {
  return isExecutorStaff(me) || isAdmin(me);
}

/** Executor units where the user is the lead (may write templates/schedules/equipment). */
export function leadUnits(me: Me | undefined) {
  return (me?.executor_units ?? []).filter((unit) => unit.is_lead);
}

/** Lead of at least one unit, or admin. */
export function canManagePm(me: Me | undefined): boolean {
  return isAdmin(me) || leadUnits(me).length > 0;
}

/** Most specific organisation label for the user ("Pengadaan"). */
export function orgUnitLabel(me: Me | undefined): string {
  if (!me) return "";
  return me.org_unit?.name || me.sub_bagian || me.bagian || "";
}
