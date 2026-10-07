import * as React from "react";

/** Minimal centred layout for public pages (SSO, access denied, QR verification). */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-grid relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.10),transparent_55%),radial-gradient(ellipse_at_center,transparent_40%,hsl(var(--background))_80%)]"
        aria-hidden
      />
      <div className="relative flex items-center gap-2.5 text-sm font-semibold">
        {/* eslint-disable-next-line @next/next/no-img-element -- static logo from /public */}
        <img src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full" aria-hidden />
        <span className="leading-tight">
          <span className="block">PrevenTech</span>
          <span className="block text-xs font-normal text-muted-foreground">PT Industri Nabati Lestari</span>
        </span>
      </div>
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
