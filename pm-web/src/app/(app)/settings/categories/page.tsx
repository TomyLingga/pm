import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { ServiceCategories } from "@/components/settings/service-categories";

export const metadata: Metadata = { title: "Kategori Layanan" };

export default function CategorySettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        eyebrow="Pengaturan"
        title="Kategori layanan"
        description="Unit pelaksana adalah seksi. Setiap anggota seksi dapat menambah kategori layanan seksinya; pimpinan seksi serta Kasubag/Kabag di atasnya dapat mengubah atau menonaktifkannya."
        backHref="/dashboard"
        backLabel="Dashboard"
      />
      <ServiceCategories />
    </div>
  );
}
