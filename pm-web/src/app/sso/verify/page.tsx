import { Suspense } from "react";
import type { Metadata } from "next";
import { SsoVerify, SsoVerifying } from "./sso-verify";

export const metadata: Metadata = { title: "Verifikasi SSO" };

export default function SsoVerifyPage() {
  return (
    <Suspense fallback={<SsoVerifying />}>
      <SsoVerify />
    </Suspense>
  );
}
