import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { UserAccess } from "@/components/settings/user-access";

export const metadata: Metadata = { title: "Hak Akses" };

export default function AccessSettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        eyebrow="Pengaturan"
        title="Hak akses"
        description="Dua peran: admin melihat dan mengelola semua unit, user biasa hanya melihat unit dan dokumennya sendiri."
        backHref="/dashboard"
        backLabel="Dashboard"
      />
      <UserAccess />
    </div>
  );
}
