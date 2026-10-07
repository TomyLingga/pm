"use client";

import { useParams } from "next/navigation";
import { EmptyState } from "@/components/common/states";
import { EquipmentDetailView } from "@/components/equipment/equipment-detail-view";
import { parseId } from "@/lib/utils";

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseId(params?.id);

  if (id === null) {
    return <EmptyState title="Equipment tidak ditemukan" description="Alamat halaman tidak valid." />;
  }

  return <EquipmentDetailView key={id} id={id} />;
}
