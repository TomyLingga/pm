import { Suspense } from "react";
import type { Metadata } from "next";
import { LoadingState } from "@/components/common/states";
import { EquipmentListView } from "@/components/equipment/equipment-list-view";

export const metadata: Metadata = { title: "Equipment" };

export default function EquipmentPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <EquipmentListView />
    </Suspense>
  );
}
