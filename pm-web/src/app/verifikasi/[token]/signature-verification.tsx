"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CircleX, QrCode } from "lucide-react";
import { PublicShell } from "@/components/common/public-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, errorMessage } from "@/lib/api";
import { formatDateTimeLong } from "@/lib/format";
import { getPublicSignature } from "@/lib/public";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b py-2.5 last:border-0 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
        {label}
      </dt>
      <dd className="text-sm font-medium">{value || "-"}</dd>
    </div>
  );
}

export function SignatureVerification({ token }: { token: string }) {
  const query = useQuery({
    queryKey: queryKeys.publicSignature(token),
    queryFn: ({ signal }) => getPublicSignature(token, signal),
    retry: false,
  });

  if (query.isPending) {
    return (
      <PublicShell>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 sm:py-10">
            <Spinner className="h-8 w-8" />
            <p className="font-semibold">Memeriksa tanda tangan...</p>
          </CardContent>
        </Card>
      </PublicShell>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <PublicShell>
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center sm:py-10">
            <QrCode className="h-10 w-10 text-destructive" aria-hidden />
            <div>
              <h1 className="text-lg font-semibold">{notFound ? "QR tidak dikenal" : "Verifikasi gagal"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {notFound
                  ? "Kode QR ini tidak terdaftar di PM-App PT INL. Dokumen mungkin bukan dokumen resmi."
                  : errorMessage(query.error)}
              </p>
            </div>
            {!notFound ? (
              <Button variant="outline" onClick={() => query.refetch()}>
                Coba lagi
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </PublicShell>
    );
  }

  const signature = query.data;
  const valid = signature.is_valid;

  return (
    <PublicShell>
      <Card className={cn(valid ? "border-emerald-300" : "border-destructive/50")}>
        <CardHeader
          className={cn(
            "items-center rounded-t-lg text-center",
            valid ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900",
          )}
        >
          {valid ? (
            <BadgeCheck className="h-12 w-12 text-emerald-600" aria-hidden />
          ) : (
            <CircleX className="h-12 w-12 text-red-600" aria-hidden />
          )}
          <h1 className="text-lg font-semibold">{valid ? "Tanda tangan valid" : "Tanda tangan tidak valid"}</h1>
          <p className="text-sm opacity-80">
            {valid
              ? "Dokumen ini ditandatangani secara elektronik melalui PM-App PT INL."
              : "Tanda tangan ini sudah tidak berlaku untuk dokumen tersebut."}
          </p>
        </CardHeader>
        <CardContent className="pt-2 sm:pt-2">
          <dl>
            <Row label="Jenis dokumen" value={signature.document_type_label} />
            <Row label="Nomor dokumen" value={<span className="font-mono">{signature.document_number}</span>} />
            <Row label="Sebagai" value={signature.role_label} />
            <Row label="Penanda tangan" value={signature.signer_name} />
            <Row label="NRK" value={signature.signer_nrk} />
            <Row label="Jabatan" value={signature.signer_position} />
            <Row label="Waktu tanda tangan" value={formatDateTimeLong(signature.signed_at)} />
            <Row label="Status dokumen" value={signature.document_status_label} />
          </dl>
        </CardContent>
      </Card>
    </PublicShell>
  );
}
