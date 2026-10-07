import { ExternalLink, QrCode } from "lucide-react";
import { tokenFromVerifyUrl } from "@/lib/public";
import { cn } from "@/lib/utils";

/** Link to the public `/verifikasi/{token}` page derived from a signature `verify_url`. */
export function SignatureLink({
  verifyUrl,
  label = "Verifikasi tanda tangan",
  className,
}: {
  verifyUrl: string | null | undefined;
  label?: string;
  className?: string;
}) {
  const token = tokenFromVerifyUrl(verifyUrl);
  if (!token) return null;
  return (
    <a
      href={`/verifikasi/${encodeURIComponent(token)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <QrCode className="h-3.5 w-3.5" aria-hidden />
      {label}
      <ExternalLink className="h-3 w-3" aria-hidden />
      <span className="sr-only">(buka di tab baru)</span>
    </a>
  );
}
