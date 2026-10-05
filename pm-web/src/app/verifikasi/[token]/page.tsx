import type { Metadata } from "next";
import { SignatureVerification } from "./signature-verification";

export const metadata: Metadata = { title: "Verifikasi Tanda Tangan" };

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function VerifySignaturePage({ params }: { params: { token: string } }) {
  return <SignatureVerification token={safeDecode(params.token)} />;
}
