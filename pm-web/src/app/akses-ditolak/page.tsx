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
        <CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:p-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-warning-soft text-warning-foreground">
            <Lock className="h-6 w-6" aria-hidden />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight">Akses ditolak</h1>
            <p className="text-sm text-muted-foreground">
              Anda belum masuk atau sesi Anda telah berakhir. PrevenTech hanya dapat dibuka melalui Portal INTES.
            </p>
          </div>
          {portalUrl ? (
            <Button asChild className="w-full sm:w-auto">
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
