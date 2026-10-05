import { PenLine } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { DocumentSignature } from "@/types/common";
import { Section } from "./section";
import { SignatureLink } from "./signature-link";

/** "Pengesahan" block: one card per electronic signature (QR in the PDF). */
export function SignaturesSection({ signatures }: { signatures: DocumentSignature[] }) {
  return (
    <Section title="Pengesahan" icon={<PenLine className="h-4 w-4" aria-hidden />}>
      {signatures.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada pengesahan.</p>
      ) : (
        <ul className="grid gap-3">
          {signatures.map((signature) => (
            <li key={`${signature.role_key}-${signature.signed_at}`} className="rounded-md border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {signature.role_label}
              </p>
              <p className="mt-1 text-sm font-semibold">{signature.signer_name}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(signature.signed_at)}</p>
              <SignatureLink verifyUrl={signature.verify_url} className="mt-2" />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
