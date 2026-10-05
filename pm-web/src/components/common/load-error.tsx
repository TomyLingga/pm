import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ApiError, errorMessage } from "@/lib/api";
import { EmptyState, ErrorState } from "./states";

interface LoadErrorProps {
  error: unknown;
  onRetry?: () => void;
  /** e.g. "Work Order", "Form Request" */
  entity: string;
  backHref: string;
}

/** Error view for detail/edit pages: 404, 403 or a generic retryable error. */
export function LoadError({ error, onRetry, entity, backHref }: LoadErrorProps) {
  const status = error instanceof ApiError ? error.status : 0;

  if (status === 404 || status === 403) {
    return (
      <EmptyState
        title={status === 404 ? `${entity} tidak ditemukan` : `Anda tidak berwenang melihat ${entity} ini`}
        description={
          status === 404 ? "Dokumen mungkin sudah dihapus atau alamatnya salah." : "Hubungi pemohon atau unit pelaksananya."
        }
        action={
          <Button asChild variant="outline">
            <Link href={backHref}>Kembali ke daftar</Link>
          </Button>
        }
      />
    );
  }

  return <ErrorState message={errorMessage(error)} onRetry={onRetry} />;
}
