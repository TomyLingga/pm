import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { RequestForm } from "@/components/service-requests/request-form";

export const metadata: Metadata = { title: "Buat Form Request" };

export default function NewRequestPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Buat Form Request"
        description="Permintaan yang membutuhkan biaya/persetujuan (formulir INLHO/BSIS-ITC/F-004)."
        backHref="/requests"
        backLabel="Daftar Form Request"
      />
      <RequestForm />
    </div>
  );
}
