import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { WorkOrderForm } from "@/components/work-orders/work-order-form";

export const metadata: Metadata = { title: "Buat Work Order" };

export default function NewWorkOrderPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Buat Work Order"
        description="Ajukan permintaan perbaikan atau dukungan ke unit pelaksana."
        backHref="/work-orders"
        backLabel="Daftar Work Order"
      />
      <WorkOrderForm />
    </div>
  );
}
