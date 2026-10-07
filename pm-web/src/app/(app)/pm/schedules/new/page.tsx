"use client";

import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { useCurrentUser } from "@/components/layout/current-user";
import { ScheduleForm } from "@/components/pm/schedules/schedule-form";
import { Button } from "@/components/ui/button";
import { canManagePm } from "@/lib/auth";

export default function NewPmSchedulePage() {
  const me = useCurrentUser();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        eyebrow="Jadwal PM"
        title="Buat Jadwal PM"
        description="Jadwal berulang yang men-generate tugas preventive maintenance."
        backHref="/pm/schedules"
        backLabel="Daftar Jadwal PM"
      />
      {canManagePm(me) ? (
        <ScheduleForm />
      ) : (
        <EmptyState
          title="Hanya pimpinan unit pelaksana yang dapat membuat jadwal"
          description="Hubungi pimpinan unit Anda atau admin untuk membuat jadwal PM."
          action={
            <Button asChild variant="outline">
              <Link href="/pm/schedules">Kembali ke daftar</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
