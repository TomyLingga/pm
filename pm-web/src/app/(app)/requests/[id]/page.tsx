"use client";

import { useParams } from "next/navigation";
import { EmptyState } from "@/components/common/states";
import { RequestDetailView } from "@/components/service-requests/detail/request-detail-view";
import { parseId } from "@/lib/utils";

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseId(params?.id);

  if (id === null) {
    return <EmptyState title="Form Request tidak ditemukan" description="Alamat halaman tidak valid." />;
  }

  return <RequestDetailView key={id} id={id} />;
}
