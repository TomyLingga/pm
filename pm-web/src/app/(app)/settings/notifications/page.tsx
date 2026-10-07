import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { NotificationPreferences } from "@/components/settings/notification-preferences";

export const metadata: Metadata = { title: "Pengaturan Notifikasi" };

export default function NotificationSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        eyebrow="Pengaturan"
        title="Pengaturan notifikasi"
        description="Atur lewat kanal apa saja Anda ingin menerima pemberitahuan."
        backHref="/dashboard"
        backLabel="Dashboard"
      />
      <NotificationPreferences />
    </div>
  );
}
