"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CircleX, QrCode } from "lucide-react";
import { PublicShell } from "@/components/common/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, errorMessage } from "@/lib/api";
import { formatDateTimeLong } from "@/lib/format";
import { getPublicSignature } from "@/lib/public";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

const ROW_LABELS = [
  "Jenis dokumen",
  "Nomor dokumen",
  "Sebagai",
  "Penanda tangan",
  "NRK",
  "Jabatan",
  "Waktu tanda tangan",
  "Status dokumen",
];

function Row({ label, value, tabular }: { label: string; value: React.ReactNode; tabular?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b py-2.5 last:border-0 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</dt>
      <dd className={cn("break-words text-sm font-medium", tabular && "tabular")}>{value || "-"}</dd>
    </div>
  );
}

/** Loading card shaped like the result (status header + detail rows). */
function VerifyingCard() {
  return (
    <Card>
      <CardHeader className="items-center border-b text-center" role="status" aria-live="polite">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
          <Spinner className="h-6 w-6" />
        </span>
        <h1 className="text-lg font-semibold tracking-tight">Memeriksa tanda tangan…</h1>
        <p className="text-sm text-muted-foreground">Mohon tunggu sebentar.</p>
      </CardHeader>
      <CardContent className="pt-2 sm:pt-2">
        <dl aria-hidden>
          {ROW_LABELS.map((label) => (
            <div
              key={label}
              className="grid grid-cols-1 gap-1 border-b py-2.5 last:border-0 sm:grid-cols-[10rem_1fr] sm:gap-3"
            >
              <dt className="text-xs text-muted-foreground sm:text-sm">{label}</dt>
              <dd>
                <Skeleton className="h-4 w-2/3" />
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
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
        <VerifyingCard />
      </PublicShell>
    );
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <PublicShell>
        <Card className="border-danger/30">
          <CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:p-8" role="alert">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger-foreground">
              <QrCode className="h-6 w-6" aria-hidden />
            </span>
            <div className="space-y-1.5">
              <h1 className="text-lg font-semibold tracking-tight">{notFound ? "QR tidak dikenal" : "Verifikasi gagal"}</h1>
              <p className="text-sm text-muted-foreground">
                {notFound
                  ? "Kode QR ini tidak terdaftar di PrevenTech. Dokumen mungkin bukan dokumen resmi."
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
      <Card className={cn("overflow-hidden", valid ? "border-success/30" : "border-danger/30")}>
        <CardHeader
          className={cn(
            "items-center border-b text-center",
            valid ? "bg-success-soft text-success-foreground" : "bg-danger-soft text-danger-foreground",
          )}
        >
          <span
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full",
              valid ? "bg-success text-success-on-solid" : "bg-danger text-danger-on-solid",
            )}
          >
            {valid ? <BadgeCheck className="h-7 w-7" aria-hidden /> : <CircleX className="h-7 w-7" aria-hidden />}
          </span>
          <h1 className="text-lg font-semibold tracking-tight">{valid ? "Tanda tangan valid" : "Tanda tangan tidak valid"}</h1>
          <p className="text-sm opacity-80">
            {valid
              ? "Dokumen ini ditandatangani secara elektronik melalui PrevenTech."
              : "Tanda tangan ini sudah tidak berlaku untuk dokumen tersebut."}
          </p>
        </CardHeader>
        <CardContent className="pt-2 sm:pt-2">
          <dl>
            <Row label="Jenis dokumen" value={signature.document_type_label} />
            <Row label="Nomor dokumen" value={<span className="font-mono">{signature.document_number}</span>} />
            <Row label="Sebagai" value={signature.role_label} />
            <Row label="Penanda tangan" value={signature.signer_name} />
            <Row label="NRK" value={signature.signer_nrk} tabular />
            <Row label="Jabatan" value={signature.signer_position} />
            <Row label="Waktu tanda tangan" value={formatDateTimeLong(signature.signed_at)} tabular />
            <Row
              label="Status dokumen"
              value={<Badge variant={valid ? "success" : "neutral"}>{signature.document_status_label}</Badge>}
            />
          </dl>
        </CardContent>
      </Card>
    </PublicShell>
  );
}
