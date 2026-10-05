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
      setError("Token SSO tidak ditemukan. Silakan buka PM-App melalui Portal INTES.");
      return;
    }

    loginWithSso(token, appId)
      .then((me) => {
        queryClient.setQueryData(queryKeys.me, me);
        // Remove the token from the address bar/history before navigating.
        window.history.replaceState(null, "", window.location.pathname);
        router.replace("/work-orders");
      })
      .catch((err: unknown) => {
        window.history.replaceState(null, "", window.location.pathname);
        setError(errorMessage(err, "Gagal memverifikasi token SSO."));
      });
  }, [queryClient, router, searchParams]);

  const portalUrl = PORTAL_LAUNCH_URL || PORTAL_HOME_URL;

  return (
    <PublicShell>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center sm:py-10">
          {error ? (
            <>
              <ShieldAlert className="h-10 w-10 text-destructive" aria-hidden />
              <div>
                <h1 className="text-lg font-semibold">Autentikasi gagal</h1>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
              {portalUrl ? (
                <Button onClick={() => (window.location.href = portalUrl)}>Kembali ke Portal</Button>
              ) : null}
            </>
          ) : (
            <>
              <Spinner className="h-8 w-8" />
              <div>
                <h1 className="text-lg font-semibold">Memverifikasi sesi...</h1>
                <p className="mt-1 text-sm text-muted-foreground">Mohon tunggu sebentar.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PublicShell>
  );
}
