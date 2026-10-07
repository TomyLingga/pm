import { Suspense } from "react";
import type { Metadata } from "next";
import { LoadingState } from "@/components/common/states";
import { ProgramListView } from "@/components/programs/program-list-view";

export const metadata: Metadata = { title: "Program Kerja Tahunan" };

export default function ProgramsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ProgramListView />
    </Suspense>
  );
}
