"use client";

import { useParams } from "next/navigation";
import { EmptyState } from "@/components/common/states";
import { TemplateDetailView } from "@/components/pm/templates/template-detail-view";
import { parseId } from "@/lib/utils";

export default function PmTemplateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseId(params?.id);

  if (id === null) {
    return <EmptyState title="Template checklist tidak ditemukan" description="Alamat halaman tidak valid." />;
  }

  return <TemplateDetailView key={id} id={id} />;
}
