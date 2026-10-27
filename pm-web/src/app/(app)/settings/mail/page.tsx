import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { MailSettingsPanel } from "@/components/settings/mail-settings";

export const metadata: Metadata = { title: "Email Notifikasi" };

export default function MailSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        eyebrow="Pengaturan"
        title="Email notifikasi"
        description="Atur server email (SMTP) untuk mengirim notifikasi lewat email, lalu uji pengirimannya."
        backHref="/dashboard"
        backLabel="Dashboard"
      />
      <MailSettingsPanel />
    </div>
  );
}
