import type { Metadata } from "next";
import { PendingApprovalsView } from "@/components/approvals/pending-approvals-view";

export const metadata: Metadata = { title: "Menunggu Persetujuan" };

export default function ApprovalsPage() {
  return <PendingApprovalsView />;
}
