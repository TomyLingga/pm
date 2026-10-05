import * as React from "react";
import { Wrench } from "lucide-react";

/** Minimal centred layout for public pages (SSO, access denied, QR verification). */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Wrench className="h-4 w-4" aria-hidden />
        </span>
        PM-App PT INL
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
