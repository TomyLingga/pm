"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { PublicShell } from "@/components/common/public-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/api";
import { loginWithSso } from "@/lib/auth";
import { PORTAL_APP_ID, PORTAL_HOME_URL, PORTAL_LAUNCH_URL } from "@/lib/env";
import { queryKeys } from "@/lib/query-keys";

/** "Memverifikasi sesi…" card, also used as the route's Suspense fallback. */
export function SsoVerifying() {
  return (
    <PublicShell>
      <Card>
        <CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:p-8" role="status" aria-live="polite">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
            <Spinner className="h-6 w-6" />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight">Memverifikasi sesi…</h1>
            <p className="text-sm text-muted-foreground">Mohon tunggu sebentar.</p>
          </div>
        </CardContent>
      </Card>
    </PublicShell>
  );
}

export function SsoVerify() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);
  // The Portal token is single-use: never send it twice (React StrictMode mounts effects twice in dev).
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;

    const fromUrl = new URLSearchParams(window.location.search);
    const token = searchParams.get("token") || fromUrl.get("token");
    const appId = searchParams.get("appId") || fromUrl.get("appId") || PORTAL_APP_ID || null;

    if (!token) {
      setError("Token SSO tidak ditemukan. Silakan buka PrevenTech melalui Portal INTES.");
      return;
    }

    loginWithSso(token, appId)
      .then((me) => {
        queryClient.setQueryData(queryKeys.me, me);
        // Remove the token from the address bar/history before navigating.
        window.history.replaceState(null, "", window.location.pathname);
        router.replace("/dashboard");
      })
      .catch((err: unknown) => {
        window.history.replaceState(null, "", window.location.pathname);
        setError(errorMessage(err, "Gagal memverifikasi token SSO."));
      });
  }, [queryClient, router, searchParams]);

  const portalUrl = PORTAL_LAUNCH_URL || PORTAL_HOME_URL;

  if (!error) return <SsoVerifying />;

  return (
    <PublicShell>
      <Card className="border-danger/30">
        <CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:p-8" role="alert">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger-foreground">
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight">Autentikasi gagal</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          {portalUrl ? (
            <Button asChild className="w-full sm:w-auto">
              <a href={portalUrl}>Kembali ke Portal</a>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </PublicShell>
  );
}
