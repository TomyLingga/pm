// Target of the same-origin proxy. The browser only ever talks to the Next.js origin;
// /api and /sanctum are forwarded to Laravel (pm-api) so the session cookie stays first-party.
// NOTE: rewrites are resolved at build time (`next build`) and when `next dev` starts.
const BACKEND_URL = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // Lets `next build` write somewhere else (e.g. NEXT_DIST_DIR=.next-build) while `next dev`
  // is using the default `.next` directory; both commands on one dist dir corrupt each other.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: "/sanctum/:path*",
        destination: `${BACKEND_URL}/sanctum/:path*`,
      },
    ];
  },
};

export default nextConfig;
