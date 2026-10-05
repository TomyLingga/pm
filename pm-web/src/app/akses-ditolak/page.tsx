import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { PublicShell } from "@/components/common/public-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PORTAL_HOME_URL, PORTAL_LAUNCH_URL } from "@/lib/env";

export const metadata: Metadata = { title: "Akses Ditolak" };

export default function AccessDeniedPage() {
  const portalUrl = PORTAL_LAUNCH_URL || PORTAL_HOME_URL;

  return (
    <PublicShell>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center sm:py-10">
          <Lock className="h-10 w-10 text-muted-foreground" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold">Akses ditolak</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Anda belum masuk atau sesi Anda telah berakhir. PM-App hanya dapat dibuka melalui Portal INTES.
            </p>
          </div>
          {portalUrl ? (
            <Button asChild>
              <a href={portalUrl}>Buka melalui Portal</a>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Hubungi tim Sistem &amp; IT bila masalah berlanjut.</p>
          )}
        </CardContent>
      </Card>
    </PublicShell>
  );
}
