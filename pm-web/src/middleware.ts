import { NextResponse, type NextRequest } from "next/server";

/** Laravel session cookie set by `POST /api/v1/auth/sso` (SESSION_COOKIE on the backend). */
const SESSION_COOKIE = "pm_app_session";
const SSO_VERIFY_PATH = "/sso/verify";

/** Pages reachable without a session. */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === SSO_VERIFY_PATH ||
    pathname === "/akses-ditolak" ||
    pathname === "/verifikasi" ||
    pathname.startsWith("/verifikasi/")
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  // 1) Portal redirects to `{app url}?token=...&appId=...`: hand the token to /sso/verify,
  //    keeping the whole query string.
  if (searchParams.has("token") && pathname !== SSO_VERIFY_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = SSO_VERIFY_PATH;
    url.search = search;
    return NextResponse.redirect(url);
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  // 2) Protected pages need the session cookie; otherwise go (back) to the Portal launcher.
  if (!request.cookies.has(SESSION_COOKIE)) {
    const launchUrl = process.env.NEXT_PUBLIC_PORTAL_LAUNCH_URL;
    const target = launchUrl ? new URL(launchUrl) : new URL("/akses-ditolak", request.url);
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except the proxied backend paths, Next internals and static files.
  matcher: [
    "/((?!api(?:/|$)|sanctum(?:/|$)|_next/static|_next/image|favicon\\.ico|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest|woff2?)$).*)",
  ],
};
