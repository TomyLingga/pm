import { PenLine } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { DocumentSignature } from "@/types/common";
import { Section } from "./section";
import { SignatureLink } from "./signature-link";

/** "Pengesahan" block: one row per electronic signature (QR in the PDF). */
export function SignaturesSection({ signatures }: { signatures: DocumentSignature[] }) {
  return (
    <Section title="Pengesahan" icon={<PenLine className="h-4 w-4" aria-hidden />}>
      {signatures.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada pengesahan.</p>
      ) : (
        <ul className="divide-y">
          {signatures.map((signature) => (
            <li
              key={`${signature.role_key}-${signature.signed_at}`}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{signature.role_label}</p>
                <p className="mt-0.5 truncate text-sm font-semibold">{signature.signer_name}</p>
                <p className="tabular text-xs text-muted-foreground">{formatDateTime(signature.signed_at)}</p>
              </div>
              <SignatureLink verifyUrl={signature.verify_url} className="mt-0.5" />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
