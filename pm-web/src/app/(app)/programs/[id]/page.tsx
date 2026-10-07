"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { EmptyState, LoadingState } from "@/components/common/states";
import { ProgramDetailView } from "@/components/programs/program-detail-view";
import { parseId } from "@/lib/utils";

export default function ProgramDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseId(params?.id);

  if (id === null) {
    return <EmptyState title="Program kerja tidak ditemukan" description="Alamat halaman tidak valid." />;
  }

  // The view keeps the selected sub-item in `?item=` (useSearchParams), hence the boundary.
  return (
    <Suspense fallback={<LoadingState />}>
      <ProgramDetailView key={id} id={id} />
    </Suspense>
  );
}
