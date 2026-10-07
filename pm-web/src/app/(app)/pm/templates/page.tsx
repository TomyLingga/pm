import { Suspense } from "react";
import type { Metadata } from "next";
import { LoadingState } from "@/components/common/states";
import { TemplateListView } from "@/components/pm/templates/template-list-view";

export const metadata: Metadata = { title: "Template Checklist" };

export default function PmTemplatesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TemplateListView />
    </Suspense>
  );
}
