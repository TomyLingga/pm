// NEXT_PUBLIC_* values are inlined at build time, so they must be referenced literally.

/** Portal launch URL for this app (used when there is no session / on 401). */
export const PORTAL_LAUNCH_URL = process.env.NEXT_PUBLIC_PORTAL_LAUNCH_URL || "";

/** Portal home page (target after logout). */
export const PORTAL_HOME_URL = process.env.NEXT_PUBLIC_PORTAL_HOME_URL || "";

/** UUID of PM-App in the Portal `aplikasi` table. */
export const PORTAL_APP_ID = process.env.NEXT_PUBLIC_PORTAL_APP_ID || "";

/** Where to send a browser that has no valid session. */
export function portalLaunchTarget(): string {
  return PORTAL_LAUNCH_URL || "/akses-ditolak";
}

/** Where to send the browser after logging out. */
export function portalHomeTarget(): string {
  return PORTAL_HOME_URL || PORTAL_LAUNCH_URL || "/akses-ditolak";
}
