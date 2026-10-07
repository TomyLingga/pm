import type { Metadata } from "next";
import { Suspense } from "react";
import { MonitorView } from "@/components/dashboard/monitor-view";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = { title: "Papan Monitor" };

export default function MonitorPage() {
  return (
    // `useSearchParams` (scope) needs a Suspense boundary for static prerendering.
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center">
          <Spinner label="Memuat papan monitor…" />
        </div>
      }
    >
      <MonitorView />
    </Suspense>
  );
}
