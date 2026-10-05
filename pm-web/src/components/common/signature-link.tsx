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
      className={cn("inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline", className)}
    >
      <QrCode className="h-3.5 w-3.5" aria-hidden />
      {label}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}
