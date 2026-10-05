import { Suspense } from "react";
import type { Metadata } from "next";
import { PublicShell } from "@/components/common/public-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { SsoVerify } from "./sso-verify";

export const metadata: Metadata = { title: "Verifikasi SSO" };

function Fallback() {
  return (
    <PublicShell>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 sm:py-10">
          <Spinner className="h-8 w-8" />
          <p className="font-semibold">Memverifikasi sesi...</p>
        </CardContent>
      </Card>
    </PublicShell>
  );
}

export default function SsoVerifyPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <SsoVerify />
    </Suspense>
  );
}
