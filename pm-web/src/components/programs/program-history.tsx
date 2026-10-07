"use client";

import * as React from "react";
import { ChevronDown, History } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityLog } from "@/types/common";
import { LogList } from "./log-list";
import { PROGRAM_STATUS_LABELS } from "./program-badges";

/**
 * Programme audit trail (create / update / close / reopen / sub-item changes), newest first.
 * Collapsed by default: the per-activity log in the activity dialog is what people look for.
 */
export function ProgramHistory({ logs }: { logs: ActivityLog[] }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const panelId = `${id}-panel`;
  const titleId = `${id}-title`;

  return (
    <section className="panel overflow-hidden" aria-labelledby={titleId}>
      <h2 id={titleId} className="text-sm font-semibold">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left transition-[background-color] duration-150 hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
        >
          <History className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>Riwayat program</span>
          <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {logs.length} catatan
          </span>
          <ChevronDown
            className={cn(
              "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out-expo",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </h2>
      <div
        id={panelId}
        aria-hidden={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out-expo",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t px-4 py-4 sm:px-5">
            <LogList logs={logs} statusLabels={PROGRAM_STATUS_LABELS} />
          </div>
        </div>
      </div>
    </section>
  );
}
