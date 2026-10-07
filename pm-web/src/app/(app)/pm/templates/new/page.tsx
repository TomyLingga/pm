"use client";

import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { useCurrentUser } from "@/components/layout/current-user";
import { TemplateForm } from "@/components/pm/templates/template-form";
import { Button } from "@/components/ui/button";
import { canManagePm } from "@/lib/auth";

export default function NewPmTemplatePage() {
  const me = useCurrentUser();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        eyebrow="Template checklist"
        title="Buat Template Checklist"
        description="Daftar butir pemeriksaan yang diisi teknisi saat mengerjakan tugas PM."
        backHref="/pm/templates"
        backLabel="Daftar Template"
      />
      {canManagePm(me) ? (
        <TemplateForm />
      ) : (
        <EmptyState
          title="Hanya pimpinan unit pelaksana yang dapat membuat template"
          description="Hubungi pimpinan unit Anda atau admin untuk membuat template checklist."
          action={
            <Button asChild variant="outline">
              <Link href="/pm/templates">Kembali ke daftar</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
