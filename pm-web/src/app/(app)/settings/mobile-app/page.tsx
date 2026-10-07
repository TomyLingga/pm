import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { MobileAppSettings } from "@/components/settings/mobile-app-settings";

export const metadata: Metadata = { title: "Aplikasi Mobile" };

export default function MobileAppSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        eyebrow="Pengaturan"
        title="Aplikasi mobile"
        description="Atur tautan unduhan aplikasi PrevenTech untuk Android dan iPhone yang tampil di Dashboard."
        backHref="/dashboard"
        backLabel="Dashboard"
      />
      <MobileAppSettings />
    </div>
  );
}
