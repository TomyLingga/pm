"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { LoadError } from "@/components/common/load-error";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/states";
import { usePmSchedule } from "@/components/pm/schedules/schedule-detail-view";
import { ScheduleForm } from "@/components/pm/schedules/schedule-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { parseId } from "@/lib/utils";

/** Placeholder shaped like the two form cards. */
function FormSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[6, 6].map((fields, card) => (
        <div key={card} className="panel p-4 sm:p-5">
          <Skeleton className="mb-1.5 h-4 w-32" />
          <Skeleton className="mb-5 h-3 w-64" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: fields }).map((_, index) => (
              <div key={index} className={index === 0 ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EditPmSchedulePage() {
  const params = useParams<{ id: string }>();
  const id = parseId(params?.id);
  const query = usePmSchedule(id);

  if (id === null) {
    return <EmptyState title="Jadwal PM tidak ditemukan" description="Alamat halaman tidak valid." />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        eyebrow="Jadwal PM"
        title={query.data ? `Ubah ${query.data.name}` : "Ubah Jadwal PM"}
        backHref={`/pm/schedules/${id}`}
        backLabel="Detail jadwal"
      />
      {query.isPending ? (
        <FormSkeleton />
      ) : query.isError ? (
        <LoadError error={query.error} onRetry={() => query.refetch()} entity="Jadwal PM" backHref="/pm/schedules" />
      ) : !query.data.permissions.can_update ? (
        <EmptyState
          title="Jadwal ini tidak dapat Anda ubah"
          description="Hanya pimpinan unit pelaksana jadwal ini atau admin yang dapat mengubahnya."
          action={
            <Button asChild variant="outline">
              <Link href={`/pm/schedules/${id}`}>Lihat detail</Link>
            </Button>
          }
        />
      ) : (
        <ScheduleForm key={query.data.id} schedule={query.data} />
      )}
    </div>
  );
}
