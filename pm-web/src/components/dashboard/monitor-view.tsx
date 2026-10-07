"use client";

import { useSearchParams } from "next/navigation";
import { KioskShell } from "@/components/layout/kiosk-shell";
import { isDashboardScope } from "./use-dashboard-params";
import { LiveBoard } from "./live-board";

/** `/monitor?scope=unit|all`: the live board alone, for a TV or a second screen in the workshop. */
export function MonitorView() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("scope");
  const scope = isDashboardScope(raw) ? raw : undefined;

  return (
    <KioskShell title="Papan monitor">
      <LiveBoard scope={scope} kiosk className="h-full" />
    </KioskShell>
  );
}
